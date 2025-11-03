import { Injectable, BadRequestException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../entities/game.entity';
import { GamePlayer } from '../entities/game-player.entity';
import { User } from '../../users/entities/user.entity'; // Added for user data fetch
import { DeckService } from './deck.service';
import { HandEvaluatorService } from './hand-evaluator.service';
import { BettingService } from './betting.service';
import { GamePhase, GameStatus } from '../types/game-state.types';
import { Hand } from '../types/card.types';
import { BettingAction } from '../types/betting.types';
import { PlatformBalanceService } from '../../users/services/platform-balance.service';

/**
 * GameStateService - Manages complete game flow for Seka Svara
 * 
 * Responsibilities:
 * - Game initialization
 * - Card dealing
 * - Turn management
 * - Showdown logic
 * - Winner determination
 * - Payout distribution (using platformScore - database only)
 */
@Injectable()
export class GameStateService {
  private readonly logger = new Logger(GameStateService.name);
  
  constructor(
    @InjectRepository(Game)
    private readonly gamesRepository: Repository<Game>,
    @InjectRepository(GamePlayer)
    private readonly gamePlayersRepository: Repository<GamePlayer>,
    @InjectRepository(User) // Added for fetching user data
    private readonly usersRepository: Repository<User>,
    private readonly deckService: DeckService,
    private readonly handEvaluatorService: HandEvaluatorService,
    private readonly bettingService: BettingService,
    private readonly platformBalanceService: PlatformBalanceService,
  ) {}

  /**
   * Initialize a new game
   */
  async initializeGame(game: Game, ante: number = 0): Promise<void> {
    const playerCount = game.players.length;
    
    // ✅ CRITICAL: Set game.ante from parameter (entry fee from table)
    game.ante = ante;
    
    // ✅ FIXED: For Seka Svara, each player contributes their entry fee to the pot
    // So small blind = entry fee, big blind = entry fee
    // This ensures pot = entry_fee × number_of_players
    const smallBlindAmount = game.ante; // Each player pays full entry fee
    const bigBlindAmount = game.ante;
    
    // Determine positions (dealer, small blind, big blind)
    const dealerPosition = 0; // First player is dealer
    const smallBlindPosition = playerCount > 2 ? 1 : 0; // If only 2 players, dealer is also small blind
    const bigBlindPosition = playerCount > 2 ? 2 : 1; // If only 2 players, other player is big blind
    
    // ✅ FIXED: Initial pot = entry fee × number of players
    // This represents all players' entry fees collected at the start
    const initialPot = game.ante * playerCount;
    
    this.logger.log(`💰 Initial pot calculation:`);
    this.logger.log(`   Entry fee (ante): ${game.ante} SEKA`);
    this.logger.log(`   Number of players: ${playerCount}`);
    this.logger.log(`   Initial pot: ${initialPot} SEKA (${game.ante} × ${playerCount})`);
    
    // Initialize game state with blind system
    // For Seka Svara: pot starts at entry_fee × player_count
    game.state = {
      phase: GamePhase.WAITING, // Start in waiting phase for blind posting
      bettingRound: 0,
      currentPlayerId: null,
      pot: initialPot, // ✅ FIXED: Start with all entry fees collected
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

    // ✅ NEW: Initialize comprehensive tracking fields
    game.cardViewers = []; // Empty array - no one has viewed cards yet
    game.blindPlayers = {}; // Empty object - no blind bets yet
    game.participantCount = playerCount; // Total number of players participating
    game.gameResults = {}; // Empty - will be populated when game ends

    // ✅ REMOVED: No longer collecting antes separately
    // The entry fee concept is handled by blinds:
    // - Small blind = entryFee / 2 (5 USDT if entry is 10 USDT)
    // - Big blind = entryFee (10 USDT)
    // - Total initial pot = 5 + 10 = 15 USDT for 2 players
    // However, for a simpler model where entry fee = pot contribution:
    // We should set blinds to equal the entry fee per player
    
    // ✅ CRITICAL: Always reset player state for new round (regardless of ante)
      for (const player of game.players) {
      player.totalBet = 0; // Start at 0, will increase when blinds are posted
        player.hasActed = false;
      player.hasSeenCards = false; // ✅ CRITICAL: Reset hasSeenCards for new round
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

    // ✅ Save final pot amount BEFORE distribution (for showdown broadcast)
    const finalPotAmount = game.state.pot;
    if (!game.state.finalPot) {
      game.state.finalPot = finalPotAmount;
    }
    this.logger.log(`💰 Saving final pot for showdown: ${finalPotAmount} SEKA`);

    // Get all active (non-folded) players
    const activePlayers = game.players.filter(p => !p.folded && p.isActive);

    if (activePlayers.length === 0) {
      throw new BadRequestException('No active players for showdown');
    }

    // If only one player, they win automatically
    if (activePlayers.length === 1) {
      game.state.winners = [activePlayers[0].userId];
      const updatedBalances = await this.distributePot(game);
      // Store for gateway to emit
      game.state.updatedBalances = Array.from(updatedBalances.entries()).map(([userId, balance]) => ({ userId, balance }));
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
    const updatedBalances = await this.distributePot(game);
    
    // ✅ Store updated balances for gateway to emit via socket
    game.state.updatedBalances = Array.from(updatedBalances.entries()).map(([userId, balance]) => ({ userId, balance }));

    // Mark game as completed
    game.state.phase = GamePhase.COMPLETED;
    game.status = GameStatus.COMPLETED;
    game.finishedAt = new Date();

    await this.gamesRepository.save(game);
  }

  /**
   * Distribute pot to winner(s)
   * Returns map of userId to new balance for real-time updates
   */
  private async distributePot(game: Game): Promise<Map<string, number>> {
    const updatedBalances = new Map<string, number>(); // Track balance changes for socket updates
    const winners = game.state.winners;
    
    if (winners.length === 0) {
      throw new BadRequestException('No winners to distribute pot to');
    }

    // ✅ Initialize gameResults structure
    if (!game.gameResults) {
      game.gameResults = {};
    }
    if (!game.gameResults.winners) {
      game.gameResults.winners = [];
    }
    if (!game.gameResults.losers) {
      game.gameResults.losers = [];
    }

    // Calculate side pots if there are all-in players
    const sidePots = this.bettingService.calculateSidePots(game);

    if (sidePots.length > 0) {
      // Distribute side pots
      const sidePotBalances = await this.distributeSidePots(game, sidePots);
      // ✅ Merge side pot balance updates
      for (const [userId, balance] of sidePotBalances.entries()) {
        updatedBalances.set(userId, balance);
      }
    } else {
      // Simple case: split main pot among winners
      const potAmount = Math.round(game.state.pot); // ✅ Ensure integer
      
      // ✅ FIXED: Winner receives 95% of pot, 5% goes to platform
      const PLATFORM_FEE_PERCENT = 5;
      const platformFee = Math.round((potAmount * PLATFORM_FEE_PERCENT) / 100); // ✅ Round fee
      const winnerTotalAmount = potAmount - platformFee;
      const amountPerWinner = Math.round(winnerTotalAmount / winners.length); // ✅ Round per-winner amount

      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      this.logger.log(`💰 POT DISTRIBUTION - MAIN POT`);
      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      this.logger.log(`   Total Pot: ${potAmount} SEKA`);
      this.logger.log(`   Platform Fee (${PLATFORM_FEE_PERCENT}%): ${platformFee} SEKA`);
      this.logger.log(`   Winner(s) Amount (95%): ${winnerTotalAmount} SEKA`);
      this.logger.log(`   Number of Winners: ${winners.length}`);
      this.logger.log(`   Amount per Winner: ${amountPerWinner} SEKA`);
      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      for (const winnerId of winners) {
        const winnerPlayer = game.players.find(p => p.userId === winnerId);
        if (winnerPlayer) {
          winnerPlayer.winnings = amountPerWinner;
          winnerPlayer.isWinner = true;

          this.logger.log(`💸 Crediting winner ${winnerId}...`);

          // Credit winnings to winner's platform balance (database only)
          const newBalance = await this.platformBalanceService.addBalance(winnerId, amountPerWinner, {
            type: 'game_win',
            gameId: game.id,
            description: `Won ${amountPerWinner} SEKA (95% of ${potAmount} pot) in game ${game.id}`,
          });
          
          // ✅ Store updated balance for socket notification
          updatedBalances.set(winnerId, newBalance);
          
          this.logger.log(`✅ Successfully credited ${amountPerWinner} SEKA to winner ${winnerId}`);

          // ✅ Record winner in gameResults
          const evaluatedHand = game.state.playerStates?.[winnerId]?.evaluatedHand;
          game.gameResults.winners.push({
            userId: winnerId,
            amount: amountPerWinner,
            handDescription: evaluatedHand?.description || 'Unknown hand',
          });
        }
      }
      
      // Log platform fee collection (actual implementation would credit platform account)
      this.logger.log(`🏦 Platform collected ${platformFee} SEKA fee (${PLATFORM_FEE_PERCENT}% of ${potAmount})`);
    }

    // ✅ Record losers (all non-winner players who contributed to pot)
    // NOTE: Losers' balances were already deducted when they placed bets during the game
    // We only need to record their losses in gameResults for tracking purposes
    const loserPlayers = game.players.filter(p => !winners.includes(p.userId));
    for (const loser of loserPlayers) {
      const amountLost = loser.totalBet || 0; // How much they bet and lost
      
      if (amountLost > 0) {
        this.logger.log(`📉 Player ${loser.userId} lost ${amountLost} SEKA in game`);

        // Record loser in gameResults
        game.gameResults.losers.push({
          userId: loser.userId,
          amountLost: amountLost,
        });
      }
    }

    await this.gamesRepository.save(game);
    
    // ✅ Return updated balances for socket notification
    this.logger.log(`💰 Updated balances for ${updatedBalances.size} winner(s) from distributePot`);
    return updatedBalances;
  }

  /**
   * Distribute side pots (for all-in scenarios)
   * Returns map of userId to new balance for real-time updates
   */
  private async distributeSidePots(game: Game, sidePots: any[]): Promise<Map<string, number>> {
    const updatedBalances = new Map<string, number>(); // Track balance changes for socket updates
    // ✅ Ensure gameResults structure exists
    if (!game.gameResults) {
      game.gameResults = {};
    }
    if (!game.gameResults.winners) {
      game.gameResults.winners = [];
    }
    if (!game.gameResults.losers) {
      game.gameResults.losers = [];
    }

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
      
      // ✅ FIXED: Winner receives 95% of pot, 5% goes to platform
      const PLATFORM_FEE_PERCENT = 5;
      const potAmountRounded = Math.round(pot.amount); // ✅ Ensure integer
      const platformFee = Math.round((potAmountRounded * PLATFORM_FEE_PERCENT) / 100); // ✅ Round fee
      const winnerTotalAmount = potAmountRounded - platformFee;
      const amountPerWinner = Math.round(winnerTotalAmount / potWinners.length); // ✅ Round per-winner amount

      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      this.logger.log(`💰 SIDE POT DISTRIBUTION`);
      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      this.logger.log(`   Side Pot Amount: ${potAmountRounded} SEKA`);
      this.logger.log(`   Platform Fee (${PLATFORM_FEE_PERCENT}%): ${platformFee} SEKA`);
      this.logger.log(`   Winner(s) Amount (95%): ${winnerTotalAmount} SEKA`);
      this.logger.log(`   Number of Winners: ${potWinners.length}`);
      this.logger.log(`   Amount per Winner: ${amountPerWinner} SEKA`);
      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      // Distribute this pot
      for (const winnerId of potWinners) {
        const winnerPlayer = game.players.find(p => p.userId === winnerId);
        if (winnerPlayer) {
          winnerPlayer.winnings += amountPerWinner;
          winnerPlayer.isWinner = true;

          this.logger.log(`💸 Crediting side pot winner ${winnerId}...`);

          // Credit winnings to winner's platform balance (database only)
          const newBalance = await this.platformBalanceService.addBalance(winnerId, amountPerWinner, {
            type: 'game_win',
            gameId: game.id,
            description: `Won ${amountPerWinner} SEKA (95% of ${potAmountRounded} side pot) in game ${game.id}`,
          });
          
          // ✅ Store updated balance for socket notification
          updatedBalances.set(winnerId, newBalance);
          
          this.logger.log(`✅ Successfully credited ${amountPerWinner} SEKA to side pot winner ${winnerId}`);

          // ✅ Record winner in gameResults (side pot)
          const evaluatedHand = game.state.playerStates?.[winnerId]?.evaluatedHand;
          const existingWinner = game.gameResults.winners.find(w => w.userId === winnerId);
          if (existingWinner) {
            // Winner already exists (won multiple pots), add to their total
            existingWinner.amount += amountPerWinner;
          } else {
            // New winner
            game.gameResults.winners.push({
              userId: winnerId,
              amount: amountPerWinner,
              handDescription: evaluatedHand?.description || 'Unknown hand',
            });
          }
        }
      }
      
      this.logger.log(`🏦 Platform collected ${platformFee} SEKA fee from side pot`);
    }

    // ✅ Record losers (all non-winner players who contributed to pot)
    // NOTE: Losers' balances were already deducted when they placed bets during the game
    // We only need to record their losses in gameResults for tracking purposes
    const winnerUserIds = game.gameResults.winners.map(w => w.userId);
    const loserPlayers = game.players.filter(p => !winnerUserIds.includes(p.userId));
    for (const loser of loserPlayers) {
      const amountLost = loser.totalBet || 0; // How much they bet and lost
      
      if (amountLost > 0) {
        this.logger.log(`📉 Player ${loser.userId} lost ${amountLost} SEKA in game`);

        // Record loser in gameResults
        const existingLoser = game.gameResults.losers.find(l => l.userId === loser.userId);
        if (!existingLoser) {
          game.gameResults.losers.push({
            userId: loser.userId,
            amountLost: amountLost,
          });
        }
      }
    }
    
    // ✅ Return updated balances for socket notification
    this.logger.log(`💰 Updated balances for ${updatedBalances.size} winner(s)`);
    return updatedBalances;
  }

  /**
   * Check if game should move to showdown
   */
  shouldMoveToShowdown(game: Game): boolean {
    // Move to showdown if:
    // 1. Only one active player remains
    // 2. All players have called/matched the current bet
    // 3. All betting rounds complete (3 rounds max as fallback)

    const activePlayers = game.players.filter(p => p.isActive && !p.folded && !p.allIn);
    
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log('🎯 CHECKING IF SHOULD MOVE TO SHOWDOWN');
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log(`📊 Active players: ${activePlayers.length}`);
    this.logger.log(`📋 Player details:`);
    activePlayers.forEach(p => {
      this.logger.log(`   • ${p.userId}: hasActed=${p.hasActed}, currentBet=${p.currentBet}, folded=${p.folded}`);
    });
    this.logger.log(`💰 Game currentBet: ${game.state.currentBet}`);
    
    // If only one non-all-in player, go to showdown
    if (activePlayers.length <= 1) {
      this.logger.log('✅ Moving to showdown: Only one active player remains');
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return true;
    }

    // ✅ NEW: Check if all active players have called (matched the current bet)
    // This is the standard poker rule: when everyone has called, move to showdown
    const allPlayersHaveActed = activePlayers.every(p => p.hasActed);
    const allBetsMatched = activePlayers.every(p => p.currentBet === game.state.currentBet);
    
    this.logger.log(`🔍 All players acted? ${allPlayersHaveActed}`);
    this.logger.log(`🔍 All bets matched? ${allBetsMatched}`);
    
    if (allPlayersHaveActed && allBetsMatched) {
      this.logger.log('✅ Moving to showdown: All players have called and matched bets');
      this.logger.log(`   Current bet: ${game.state.currentBet}`);
      this.logger.log(`   Players: ${activePlayers.map(p => `${p.userId}:${p.currentBet}`).join(', ')}`);
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return true;
    }

    // If max betting rounds reached (fallback)
    if (game.state.bettingRound >= 3) {
      this.logger.log('✅ Moving to showdown: Max betting rounds (3) reached');
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return true;
    }

    this.logger.log('❌ NOT moving to showdown yet');
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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
   * ⚠️ DEPRECATED - Use getSanitizedGameStateForUser instead for security
   */
  async getGameStateSummary(game: Game) {
    // Fetch current platform score AND user info for each player
    const playersWithBalance = await Promise.all(
      game.players.map(async (p) => {
        const balance = await this.platformBalanceService.getBalance(p.userId);
        
        // ✅ FETCH USER DATA (email, username, avatar) from database
        const user = await this.usersRepository.findOne({
          where: { id: p.userId },
          select: ['id', 'email', 'username', 'avatar']
        });
        
        // ✅ Use current platform balance (total SEKA score)
        // This displays the player's current total platform balance
        
        return {
          userId: p.userId,
          // ✅ Include user identity data for frontend display
          email: user?.email || null,
          username: user?.username || null,
          name: user?.username || null, // Alias for compatibility
          avatar: user?.avatar || null,
          // Game state data
          position: p.position,
          balance: balance, // Current platform balance (total SEKA score)
          availableBalance: balance, // Available balance for betting
          currentBet: p.currentBet,
          totalBet: p.totalBet,
          status: p.status,
          isWinner: p.isWinner,
          winnings: p.winnings,
          hasActed: p.hasActed,
          hasSeenCards: p.hasSeenCards, // For blind betting
          // 🔒 SECURITY: Do NOT include hand - use getSanitizedGameStateForUser instead
          hand: null,
          handScore: null,
          handDescription: null,
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
      finalPot: game.state.finalPot, // ✅ Final pot before distribution (for showdown display)
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
   * 🔒 SECURE: Get sanitized game state for a specific user
   * Only includes card data for:
   * 1. The requesting user (if they've viewed their cards)
   * 2. During showdown (all players who reached showdown)
   */
  async getSanitizedGameStateForUser(game: Game, requestingUserId: string) {
    const isShowdown = game.state.phase === GamePhase.SHOWDOWN;
    
    // Fetch current platform score AND user info for each player
    const playersWithBalance = await Promise.all(
      game.players.map(async (p) => {
        const balance = await this.platformBalanceService.getBalance(p.userId);
        
        // ✅ FETCH USER DATA (email, username, avatar) from database
        const user = await this.usersRepository.findOne({
          where: { id: p.userId },
          select: ['id', 'email', 'username', 'avatar']
        });
        
        // 🔒 SECURITY: Only include hand if:
        // 1. It's the requesting user AND they've seen their cards
        // 2. OR it's showdown (everyone's cards are revealed)
        const isRequestingUser = p.userId === requestingUserId;
        const canSeeCards = isShowdown || (isRequestingUser && p.hasSeenCards);
        
        // ✅ FIX: Hand scores should be visible for ALL players who have viewed cards
        // This allows the "11P" badge to display for all users, even though actual cards stay hidden
        const canSeeHandScore = p.hasSeenCards || isShowdown;
        
        // ✅ Use current platform balance (total SEKA score)
        // This displays the player's current total platform balance
        
        return {
          userId: p.userId,
          // ✅ Include user identity data for frontend display
          email: user?.email || null,
          username: user?.username || null,
          name: user?.username || null, // Alias for compatibility
          avatar: user?.avatar || null,
          // Game state data
          position: p.position,
          balance: balance, // Current platform balance (total SEKA score)
          availableBalance: balance, // Available balance for betting
          currentBet: p.currentBet,
          totalBet: p.totalBet,
          status: p.status,
          isWinner: p.isWinner,
          winnings: p.winnings,
          hasActed: p.hasActed,
          hasSeenCards: p.hasSeenCards, // For blind betting
          // 🔒 SECURITY: Only include hand data if allowed
          hand: canSeeCards ? p.hand : null,
          // ✅ FIX: Include hand score for ALL players who have viewed cards (not just requesting user)
          handScore: canSeeHandScore ? p.handScore : null,
          handDescription: canSeeHandScore ? p.handDescription : null,
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
      // ✅ NEW: Comprehensive game tracking
      cardViewers: game.cardViewers || [],
      blindPlayers: game.blindPlayers || {},
      participantCount: game.participantCount || game.players.length,
      gameResults: game.gameResults || {},
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
      await this.platformBalanceService.deductBalance(smallBlindPlayer.userId, state.smallBlindAmount, {
        type: 'game_blind',
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
      await this.platformBalanceService.deductBalance(bigBlindPlayer.userId, state.bigBlindAmount, {
        type: 'game_blind',
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

