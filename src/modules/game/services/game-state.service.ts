import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../entities/game.entity';
import { GamePlayer } from '../entities/game-player.entity';
import { DeckService } from './deck.service';
import { HandEvaluatorService } from './hand-evaluator.service';
import { BettingService } from './betting.service';
import { GamePhase, GameStatus } from '../types/game-state.types';
import { Hand } from '../types/card.types';
import { BettingAction } from '../types/betting.types';
import { IWalletService, WALLET_SERVICE, WalletTransactionType } from '../interfaces/wallet.interface';

/**
 * GameStateService - Manages complete game flow for Seka Svara
 * 
 * Responsibilities:
 * - Game initialization
 * - Card dealing
 * - Turn management
 * - Showdown logic
 * - Winner determination
 * - Payout distribution
 */
@Injectable()
export class GameStateService {
  constructor(
    @InjectRepository(Game)
    private readonly gamesRepository: Repository<Game>,
    @InjectRepository(GamePlayer)
    private readonly gamePlayersRepository: Repository<GamePlayer>,
    private readonly deckService: DeckService,
    private readonly handEvaluatorService: HandEvaluatorService,
    private readonly bettingService: BettingService,
    @Inject(WALLET_SERVICE)
    private readonly walletService: IWalletService,
  ) {}

  /**
   * Initialize a new game
   */
  async initializeGame(game: Game, ante: number = 0): Promise<void> {
    const playerCount = game.players.length;
    
    // Calculate blind amounts (small blind = ante/2, big blind = ante)
    const smallBlindAmount = Math.floor(game.ante / 2);
    const bigBlindAmount = game.ante;
    
    // Determine positions (dealer, small blind, big blind)
    const dealerPosition = 0; // First player is dealer
    const smallBlindPosition = playerCount > 2 ? 1 : 0; // If only 2 players, dealer is also small blind
    const bigBlindPosition = playerCount > 2 ? 2 : 1; // If only 2 players, other player is big blind
    
    // Initialize game state with blind system
    game.state = {
      phase: GamePhase.WAITING, // Start in waiting phase for blind posting
      bettingRound: 0,
      currentPlayerId: null,
      pot: ante * game.players.length, // Collect antes
      currentBet: 0,
      bettingHistory: [],
      winners: [],
      playerStates: {},
      startedAt: new Date(),
      // Blind system properties
      smallBlindAmount,
      bigBlindAmount,
      dealerPosition,
      smallBlindPosition,
      bigBlindPosition,
      blindsPosted: false,
      gameStartDelay: 5, // 5 second delay before game starts
    };

    game.status = GameStatus.IN_PROGRESS;

    // Collect antes from all players
    if (ante > 0) {
      for (const player of game.players) {
        player.totalBet = ante;
        player.hasActed = false;
        
        // TODO: Integrate with Developer 3's wallet service
        // await this.walletService.deductBalance(player.userId, ante, {...});
      }
    }

    // Deal cards to all players
    await this.dealCards(game);

    // IMPORTANT: Persist dealt hands to the database so that
    // subsequent loads (e.g., see_cards handler that reloads the game)
    // have the players' hands available.
    await this.gamePlayersRepository.save(game.players);

    // Move to betting phase
    game.state.phase = GamePhase.BETTING;
    game.state.bettingRound = 1;

    // Set first player as current player
    const firstPlayer = game.players[0];
    if (firstPlayer) {
      game.state.currentPlayerId = firstPlayer.userId;
    }

    await this.gamesRepository.save(game);
  }

  /**
   * Deal 3 cards to each player
   */
  private async dealCards(game: Game): Promise<void> {
    // Create and shuffle deck
    const deck = this.deckService.createDeck();
    const shuffledDeck = this.deckService.secureShuffle(deck);

    // Deal 3 cards to each player
    const { hands } = this.deckService.dealToPlayers(
      shuffledDeck,
      game.players.length,
      3, // 3 cards per player in Seka
    );

    // Assign hands to players AND evaluate them
    for (let i = 0; i < game.players.length; i++) {
      game.players[i].hand = hands[i];
      
      // Evaluate hand and store score/description
      const evaluatedHand = this.handEvaluatorService.evaluateHand(hands[i]);
      game.players[i].handScore = evaluatedHand.value;
      game.players[i].handDescription = evaluatedHand.description;
    }
  }

  /**
   * Execute showdown - evaluate all hands and determine winner(s)
   */
  async executeShowdown(game: Game): Promise<void> {
    game.state.phase = GamePhase.SHOWDOWN;

    // Get all active (non-folded) players
    const activePlayers = game.players.filter(p => !p.folded && p.isActive);

    if (activePlayers.length === 0) {
      throw new BadRequestException('No active players for showdown');
    }

    // If only one player, they win automatically
    if (activePlayers.length === 1) {
      game.state.winners = [activePlayers[0].userId];
      await this.distributePot(game);
      return;
    }

    // Evaluate all hands
    const evaluatedHands = new Map();
    
    for (const player of activePlayers) {
      const hand: Hand = player.hand as Hand;
      const evaluatedHand = this.handEvaluatorService.evaluateHand(hand);
      evaluatedHands.set(player.userId, evaluatedHand);
      
      // Store evaluated hand in player state (for display)
      if (!game.state.playerStates) {
        game.state.playerStates = {};
      }
      game.state.playerStates[player.userId] = {
        ...game.state.playerStates[player.userId],
        evaluatedHand,
      };
    }

    // Determine winner(s)
    const winners = this.handEvaluatorService.determineWinner(evaluatedHands);
    game.state.winners = winners;

    // Check for tie (Svara situation)
    if (winners.length > 1) {
      // Multiple winners with same points = Svara (tie-breaker needed)
      // For now, split pot equally
      console.log(`Svara detected! ${winners.length} players tied with same points`);
    }

    // Distribute winnings
    await this.distributePot(game);

    // Mark game as completed
    game.state.phase = GamePhase.COMPLETED;
    game.status = GameStatus.COMPLETED;
    game.finishedAt = new Date();

    await this.gamesRepository.save(game);
  }

  /**
   * Distribute pot to winner(s)
   */
  private async distributePot(game: Game): Promise<void> {
    const winners = game.state.winners;
    
    if (winners.length === 0) {
      throw new BadRequestException('No winners to distribute pot to');
    }

    // Calculate side pots if there are all-in players
    const sidePots = this.bettingService.calculateSidePots(game);

    if (sidePots.length > 0) {
      // Distribute side pots
      await this.distributeSidePots(game, sidePots);
    } else {
      // Simple case: split main pot among winners
      const potAmount = game.state.pot;
      const amountPerWinner = potAmount / winners.length;

      for (const winnerId of winners) {
        const winnerPlayer = game.players.find(p => p.userId === winnerId);
        if (winnerPlayer) {
          winnerPlayer.winnings = amountPerWinner;
          winnerPlayer.isWinner = true;

          // Credit winnings to winner's wallet
          await this.walletService.addBalance(winnerId, amountPerWinner, {
            type: WalletTransactionType.GAME_WINNINGS,
            gameId: game.id,
            description: `Won ${amountPerWinner} from pot in game ${game.id}`,
            timestamp: new Date(),
          });
        }
      }
    }

    await this.gamesRepository.save(game);
  }

  /**
   * Distribute side pots (for all-in scenarios)
   */
  private async distributeSidePots(game: Game, sidePots: any[]): Promise<void> {
    for (const pot of sidePots) {
      const eligiblePlayers = pot.eligiblePlayers;
      
      // Get active non-folded players from eligible list
      const activePlayers = game.players.filter(
        p => eligiblePlayers.includes(p.userId) && !p.folded
      );

      if (activePlayers.length === 0) continue;

      // Evaluate hands of eligible players
      const evaluatedHands = new Map();
      for (const player of activePlayers) {
        const hand: Hand = player.hand as Hand;
        const evaluatedHand = this.handEvaluatorService.evaluateHand(hand);
        evaluatedHands.set(player.userId, evaluatedHand);
      }

      // Determine winners for this pot
      const potWinners = this.handEvaluatorService.determineWinner(evaluatedHands);
      const amountPerWinner = pot.amount / potWinners.length;

      // Distribute this pot
      for (const winnerId of potWinners) {
        const winnerPlayer = game.players.find(p => p.userId === winnerId);
        if (winnerPlayer) {
          winnerPlayer.winnings += amountPerWinner;
          winnerPlayer.isWinner = true;

          // TODO: Integrate with Developer 3's wallet service
          // await this.walletService.addBalance(winnerId, amountPerWinner, {...});
        }
      }
    }
  }

  /**
   * Check if game should move to showdown
   */
  shouldMoveToShowdown(game: Game): boolean {
    // Move to showdown if:
    // 1. All betting rounds complete (3 rounds max)
    // 2. Only one active player remains (already handled in betting)
    // 3. All players have called/checked

    const activePlayers = game.players.filter(p => p.isActive && !p.folded && !p.allIn);
    
    // If only one non-all-in player, go to showdown
    if (activePlayers.length <= 1) {
      return true;
    }

    // If max betting rounds reached
    if (game.state.bettingRound >= 3) {
      return true;
    }

    return false;
  }

  /**
   * Advance game to next phase
   */
  async advancePhase(game: Game): Promise<void> {
    switch (game.state.phase) {
      case GamePhase.WAITING:
        // Start game
        await this.initializeGame(game);
        break;

      case GamePhase.DEALING:
        // Move to betting
        game.state.phase = GamePhase.BETTING;
        game.state.bettingRound = 1;
        break;

      case GamePhase.BETTING:
        // Check if should move to showdown
        if (this.shouldMoveToShowdown(game)) {
          await this.executeShowdown(game);
        } else {
          // Continue to next betting round
          game.state.bettingRound++;
          game.state.currentBet = 0;
          
          // Reset player actions
          game.players.forEach(p => {
            if (p.isActive && !p.folded) {
              p.hasActed = false;
              p.currentBet = 0;
            }
          });
        }
        break;

      case GamePhase.SHOWDOWN:
        // Game complete
        game.state.phase = GamePhase.COMPLETED;
        game.status = GameStatus.COMPLETED;
        break;

      case GamePhase.COMPLETED:
        // Nothing to do
        break;
    }

    await this.gamesRepository.save(game);
  }

  /**
   * Get game state summary for display
   */
  async getGameStateSummary(game: Game) {
    // Fetch current balance for each player
    const playersWithBalance = await Promise.all(
      game.players.map(async (p) => {
        const balance = await this.walletService.getBalance(p.userId);
        return {
          userId: p.userId,
          position: p.position,
          balance, // Include current wallet balance
          currentBet: p.currentBet,
          totalBet: p.totalBet,
          status: p.status,
          isWinner: p.isWinner,
          winnings: p.winnings,
          hasActed: p.hasActed,
          hasSeenCards: p.hasSeenCards, // For blind betting
          // ALWAYS include hand - frontend handles hiding based on hasSeenCards
          hand: p.hand,
          handScore: p.handScore, // Evaluated hand score
          handDescription: p.handDescription, // Hand description (e.g., "Three 7s")
        };
      })
    );

    return {
      gameId: game.id,
      dealerId: game.dealerId, // Current dealer
      phase: game.state.phase,
      status: game.status,
      bettingRound: game.state.bettingRound,
      currentPlayerId: game.state.currentPlayerId,
      pot: game.state.pot,
      currentBet: game.state.currentBet,
      winners: game.state.winners,
      players: playersWithBalance,
      bettingHistory: game.state.bettingHistory,
      startedAt: game.state.startedAt,
      finishedAt: game.finishedAt,
      // Blind system data
      smallBlindAmount: game.state.smallBlindAmount,
      bigBlindAmount: game.state.bigBlindAmount,
      dealerPosition: game.state.dealerPosition,
      smallBlindPosition: game.state.smallBlindPosition,
      bigBlindPosition: game.state.bigBlindPosition,
      blindsPosted: game.state.blindsPosted,
      gameStartDelay: game.state.gameStartDelay,
    };
  }

  /**
   * Post blinds for the current hand
   */
  async postBlinds(game: Game): Promise<void> {
    const { state } = game;
    const players = game.players;
    
    // Post small blind
    const smallBlindPlayer = players[state.smallBlindPosition];
    if (smallBlindPlayer) {
      await this.walletService.deductBalance(smallBlindPlayer.userId, state.smallBlindAmount, {
        type: WalletTransactionType.GAME_BLIND,
        gameId: game.id,
        description: 'Small blind posted'
      });
      state.pot += state.smallBlindAmount;
      state.playerStates[smallBlindPlayer.userId] = {
        ...state.playerStates[smallBlindPlayer.userId],
        currentBet: state.smallBlindAmount,
        totalBet: state.smallBlindAmount,
        isSmallBlind: true,
        blindAmount: state.smallBlindAmount,
      };
    }
    
    // Post big blind
    const bigBlindPlayer = players[state.bigBlindPosition];
    if (bigBlindPlayer) {
      await this.walletService.deductBalance(bigBlindPlayer.userId, state.bigBlindAmount, {
        type: WalletTransactionType.GAME_BLIND,
        gameId: game.id,
        description: 'Big blind posted'
      });
      state.pot += state.bigBlindAmount;
      state.currentBet = state.bigBlindAmount; // Big blind sets the current bet
      state.playerStates[bigBlindPlayer.userId] = {
        ...state.playerStates[bigBlindPlayer.userId],
        currentBet: state.bigBlindAmount,
        totalBet: state.bigBlindAmount,
        isBigBlind: true,
        blindAmount: state.bigBlindAmount,
      };
    }
    
    state.blindsPosted = true;
    await this.gamesRepository.save(game);
  }

  /**
   * Start the game after delay and blind posting
   */
  async startGameAfterDelay(game: Game): Promise<void> {
    const { state } = game;
    
    // Wait for the specified delay
    await new Promise(resolve => setTimeout(resolve, state.gameStartDelay * 1000));
    
    // Post blinds
    await this.postBlinds(game);
    
    // Deal cards
    await this.dealCards(game);
    
    // Set first player to act (left of big blind)
    const players = game.players;
    const firstToActPosition = (state.bigBlindPosition + 1) % players.length;
    state.currentPlayerId = players[firstToActPosition].userId;
    state.phase = GamePhase.BETTING;
    
    await this.gamesRepository.save(game);
  }

  /**
   * Handle player viewing their cards
   */
  async playerViewCards(game: Game, playerId: string): Promise<void> {
    const { state } = game;
    
    if (state.playerStates[playerId]) {
      state.playerStates[playerId].hasSeenCards = true;
      await this.gamesRepository.save(game);
    }
  }

  /**
   * Handle player playing blind (without seeing cards)
   */
  async playerPlayBlind(game: Game, playerId: string, action: string, amount?: number): Promise<void> {
    const { state } = game;
    
    if (state.playerStates[playerId]) {
      // Player is playing blind - they haven't seen their cards
      state.playerStates[playerId].inDark = true;
      
      // Process the action (call, raise, fold)
      const bettingAction = action as BettingAction;
      await this.bettingService.processBet(game, playerId, bettingAction, amount);
    }
  }

  /**
   * Rotate blinds for next hand
   */
  async rotateBlinds(game: Game): Promise<void> {
    const { state } = game;
    const playerCount = game.players.length;
    
    // Move dealer button clockwise
    state.dealerPosition = (state.dealerPosition + 1) % playerCount;
    
    // Adjust blind positions
    if (playerCount > 2) {
      state.smallBlindPosition = (state.smallBlindPosition + 1) % playerCount;
      state.bigBlindPosition = (state.bigBlindPosition + 1) % playerCount;
    } else {
      // Heads-up: dealer is small blind, other player is big blind
      state.smallBlindPosition = state.dealerPosition;
      state.bigBlindPosition = (state.dealerPosition + 1) % playerCount;
    }
    
    // Reset blind posting status
    state.blindsPosted = false;
    
    await this.gamesRepository.save(game);
  }
}

