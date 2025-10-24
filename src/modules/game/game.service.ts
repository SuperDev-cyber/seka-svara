import { Injectable, NotFoundException, BadRequestException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from './entities/game.entity';
import { GamePlayer } from './entities/game-player.entity';
import { GameEngine } from './services/game-engine.service';
import { BettingAction } from './types/betting.types';
import { GameStatus, GamePhase } from './types/game-state.types';
import { IWalletService, WALLET_SERVICE } from './interfaces/wallet.interface';

/**
 * GameService - Main service for game operations
 * 
 * Provides high-level game management:
 * - Create/start games
 * - Process player actions
 * - Get game state
 * - End games
 * - User game history
 */
@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
    @InjectRepository(GamePlayer)
    private gamePlayersRepository: Repository<GamePlayer>,
    private gameEngine: GameEngine,
    @Inject(WALLET_SERVICE)
    private walletService: IWalletService,
  ) {}

  /**
   * Find a game by ID
   */
  async findOne(id: string): Promise<Game> {
    const game = await this.gamesRepository.findOne({
      where: { id },
      relations: ['players'],
    });

    if (!game) {
      throw new NotFoundException(`Game ${id} not found`);
    }

    return game;
  }

  /**
   * Save/update a game entity
   */
  async saveGame(game: Game): Promise<Game> {
    return await this.gamesRepository.save(game);
  }

  /**
   * Get current game state
   */
  async getGameState(id: string) {
    const game = await this.findOne(id);
    return this.gameEngine.getGameState(game);
  }

  /**
   * Create a new game
   * SEKA RULE: Minimum balance = ante² (e.g., ante=100 requires 10,000 balance)
   * Note: For testing, games can start with 1+ players and others can join later
   */
  async createGame(
    tableId: string,
    playerIds: string[],
    ante: number = 0,
    maxPlayers: number = 6, // Default to 6 (all tables are 6-player)
  ): Promise<Game> {
    // Force maxPlayers to 6 for consistency
    maxPlayers = 6;
    
    // Validate playerIds count
    if (playerIds.length < 1 || playerIds.length > 6) {
      throw new BadRequestException('Game requires 1-6 players to create');
    }

    // SEKA RULE: Balance validation moved to frontend
    // Frontend checks wallet SEKA balance before allowing join
    // Backend just logs for monitoring purposes
    if (ante > 0) {
      this.logger.log(`💰 Game entry fee: ${ante} SEKA (validated on frontend)`);
    }

    // Create game entity
    const game = this.gamesRepository.create({
      tableId,
      status: GameStatus.PENDING,
      pot: 0,
      currentBet: 0,
      maxPlayers, // Store max players limit
      ante, // Store ante (POT) for later use
      gameState: {
        phase: GamePhase.WAITING,
        bettingRound: 0,
        currentPlayerId: null,
        pot: 0,
        currentBet: 0,
        bettingHistory: [],
        winners: [],
        playerStates: {},
        startedAt: null,
      },
    });

    await this.gamesRepository.save(game);

    // Create player entities
    const players = playerIds.map((userId, index) =>
      this.gamePlayersRepository.create({
        gameId: game.id,
        userId,
        position: index,
        hand: [],
        betAmount: 0,
        totalBet: 0,
        status: 'active',
        isWinner: false,
        winnings: 0,
        hasActed: false,
      }),
    );

    await this.gamePlayersRepository.save(players);

    // Reload game with players
    const gameWithPlayers = await this.findOne(game.id);

    // DON'T initialize game yet - keep it in PENDING status
    // Game will be initialized when:
    // 1. Enough players join (2+), OR
    // 2. Creator manually calls startGame()
    // await this.gameEngine.initializeGame(gameWithPlayers, ante);

    return gameWithPlayers;
  }

  /**
   * Add a player to an existing game (if game hasn't started yet)
   */
  async addPlayerToGame(gameId: string, playerId: string): Promise<Game> {
    const game = await this.findOne(gameId);

    if (game.status !== GameStatus.PENDING) {
      throw new BadRequestException('Cannot join: Game has already started or finished');
    }

    if (game.players.length >= 6) {
      throw new BadRequestException('Game is full (max 6 players)');
    }

    // Check if player is already in the game
    const existingPlayer = game.players.find(p => p.userId === playerId);
    if (existingPlayer) {
      throw new BadRequestException('Player is already in this game');
    }

    // Balance validation moved to frontend
    if (game.ante > 0) {
      this.logger.log(`💰 Player ${playerId} joining game with entry fee: ${game.ante} SEKA (validated on frontend)`);
    }

    // Create new player entity
    const newPlayer = this.gamePlayersRepository.create({
      gameId: game.id,
      userId: playerId,
      position: game.players.length,
      betAmount: 0,
      totalBet: 0,
      status: 'active',
      hasActed: false,
      isWinner: false,
      winnings: 0,
    });

    await this.gamePlayersRepository.save(newPlayer);

    // Reload game with updated players
    const updatedGame = await this.findOne(gameId);

    // Auto-start game when room is full (reached maxPlayers)
    if (updatedGame.players.length >= updatedGame.maxPlayers) {
      this.logger.log(`Game ${gameId} is now full (${updatedGame.players.length}/${updatedGame.maxPlayers}) - auto-starting!`);
      // Initialize the game (deal cards, start betting)
      await this.gameEngine.initializeGame(updatedGame, updatedGame.ante);
      await this.gamesRepository.save(updatedGame);
    } else {
      this.logger.log(`Game ${gameId} waiting for more players (${updatedGame.players.length}/${updatedGame.maxPlayers})`);
    }

    return updatedGame;
  }

  /**
   * Start a game (if it's in WAITING state)
   */
  async startGame(id: string, ante: number = 0): Promise<Game> {
    const game = await this.findOne(id);

    if (game.status !== GameStatus.PENDING) {
      throw new BadRequestException('Game has already started or finished');
    }

    if (game.players.length < 2) {
      throw new BadRequestException('Need at least 2 players to start');
    }

    await this.gameEngine.initializeGame(game, ante);

    return game;
  }

  /**
   * Perform a player action
   */
  async performAction(
    gameId: string,
    userId: string,
    action: { type: string; amount?: number },
  ) {
    const game = await this.findOne(gameId);

    // Validate game is in progress
    if (game.status !== GameStatus.IN_PROGRESS) {
      throw new BadRequestException('Game is not in progress');
    }

    // Validate action type
    const bettingAction = this.parseBettingAction(action.type);
    if (!bettingAction) {
      throw new BadRequestException(`Invalid action type: ${action.type}`);
    }

    // Validate it's player's turn
    if (game.state.currentPlayerId !== userId) {
      throw new BadRequestException('Not your turn');
    }

    // Validate player is in game
    const player = game.players.find(p => p.userId === userId);
    if (!player) {
      throw new NotFoundException('Player not in game');
    }

    // Process the action
    const amount = action.amount || 0;
    await this.gameEngine.processPlayerAction(game, userId, bettingAction, amount);

    // Return updated game state
    return this.gameEngine.getGameState(game);
  }

  /**
   * End a game manually (admin/force end)
   */
  async endGame(gameId: string, winnerId?: string): Promise<Game> {
    const game = await this.findOne(gameId);

    if (game.status === GameStatus.COMPLETED) {
      throw new BadRequestException('Game already completed');
    }

    // If winner specified, set them as winner
    if (winnerId) {
      game.state.winners = [winnerId];
      const winner = game.players.find(p => p.userId === winnerId);
      if (winner) {
        winner.isWinner = true;
        winner.winnings = game.state.pot;
      }
    }

    game.status = GameStatus.COMPLETED;
    game.state.phase = GamePhase.COMPLETED;
    game.finishedAt = new Date();

    await this.gamesRepository.save(game);

    return game;
  }

  /**
   * Cancel a game (before it starts or early cancellation)
   */
  async cancelGame(gameId: string): Promise<Game> {
    const game = await this.findOne(gameId);

    if (game.status === GameStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel completed game');
    }

    game.status = GameStatus.CANCELLED;
    game.finishedAt = new Date();

    // TODO: Refund all bets to players via wallet service

    await this.gamesRepository.save(game);

    return game;
  }

  /**
   * Get user's game history
   */
  async getUserGameHistory(userId: string, limit: number = 20) {
    const gamePlayers = await this.gamePlayersRepository.find({
      where: { userId },
      relations: ['game'],
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return gamePlayers.map(gp => ({
      gameId: gp.game.id,
      tableId: gp.game.tableId,
      status: gp.game.status,
      position: gp.position,
      totalBet: gp.totalBet,
      winnings: gp.winnings,
      isWinner: gp.isWinner,
      createdAt: gp.createdAt,
      finishedAt: gp.game.finishedAt,
    }));
  }

  /**
   * Get user's active games
   */
  /**
   * Get all pending games (for game discovery)
   */
  /**
   * Clean up old pending games (manual cleanup)
   */
  async cleanupOldGames() {
    try {
      const allGames = await this.gamesRepository.find();
      
      const oldGames = allGames.filter(game =>
        game.status === 'pending' || game.status === GameStatus.PENDING
      );
      
      this.logger.log(`Cancelling ${oldGames.length} old pending games`);
      
      for (const game of oldGames) {
        game.status = GameStatus.CANCELLED;
        await this.gamesRepository.save(game);
      }
      
      return {
        success: true,
        cancelled: oldGames.length,
        message: `Cancelled ${oldGames.length} old pending games`
      };
    } catch (error) {
      this.logger.error(`Error cleaning up old games: ${error.message}`);
      throw error;
    }
  }

  async getPendingGames() {
    try {
      this.logger.log('Fetching pending games...');
      
      // Auto-cleanup: Remove games older than 1 hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Find all games
      const allGames = await this.gamesRepository.find({
        relations: ['players'],
        order: { createdAt: 'DESC' },
      });
      
      this.logger.log(`Found ${allGames.length} total games`);
      
      // Filter for RECENT pending games (created within last hour)
      const pendingGames = allGames.filter(game => 
        game.status === 'pending' && 
        new Date(game.createdAt) > oneHourAgo
      );
      
      // Mark old pending games as cancelled
      const oldPendingGames = allGames.filter(game =>
        game.status === 'pending' &&
        new Date(game.createdAt) <= oneHourAgo
      );
      
      if (oldPendingGames.length > 0) {
        this.logger.log(`Auto-cancelling ${oldPendingGames.length} old pending games`);
        for (const game of oldPendingGames) {
          game.status = GameStatus.CANCELLED;
          await this.gamesRepository.save(game);
        }
      }
      
      this.logger.log(`Found ${pendingGames.length} active pending games`);

      // Return games with full player information
      return pendingGames.map(game => ({
        id: game.id,
        tableId: game.tableId,
        status: game.status,
        pot: game.pot,
        ante: game.ante, // Entry fee (POT)
        maxPlayers: game.maxPlayers, // Maximum players allowed
        currentPlayers: game.players.length, // Current player count
        players: (game.players || []).map(p => ({
          userId: p.userId,
          position: p.position,
          status: p.status,
        })),
        state: game.state,
        createdAt: game.createdAt,
      }));
    } catch (error) {
      this.logger.error(`Error fetching pending games: ${error.message}`, error.stack);
      return [];
    }
  }

  async getUserActiveGames(userId: string) {
    const gamePlayers = await this.gamePlayersRepository.find({
      where: { userId },
      relations: ['game'],
      order: { createdAt: 'DESC' },
    });

    // Filter for games that are in progress
    const activeGames = gamePlayers.filter(
      gp => gp.game.status === GameStatus.IN_PROGRESS || gp.game.status === GameStatus.PENDING,
    );

    return activeGames.map(gp => ({
      gameId: gp.game.id,
      tableId: gp.game.tableId,
      status: gp.game.status,
      position: gp.position,
      phase: gp.game.state?.phase,
      pot: gp.game.pot,
      currentPlayerId: gp.game.state?.currentPlayerId,
      isMyTurn: gp.game.state?.currentPlayerId === userId,
    }));
  }

  /**
   * Get available actions for a player
   */
  async getAvailableActions(gameId: string, userId: string): Promise<string[]> {
    const game = await this.findOne(gameId);
    
    const actions = this.gameEngine.getAvailableActions(game, userId);
    
    return actions.map(action => action.toString());
  }

  /**
   * Parse betting action string to enum
   */
  private parseBettingAction(actionType: string): BettingAction | null {
    const actionMap: Record<string, BettingAction> = {
      'bet': BettingAction.BET,
      'raise': BettingAction.RAISE,
      'call': BettingAction.CALL,
      'fold': BettingAction.FOLD,
      'check': BettingAction.CHECK,
      'all_in': BettingAction.ALL_IN,
      'allin': BettingAction.ALL_IN,
      'reveal': BettingAction.REVEAL,    // Seka-specific
      'watch': BettingAction.WATCH,      // Seka-specific
    };

    return actionMap[actionType.toLowerCase()] || null;
  }
}
