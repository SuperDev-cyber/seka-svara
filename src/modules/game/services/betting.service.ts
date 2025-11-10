import { Injectable, BadRequestException, NotFoundException, Inject, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../entities/game.entity';
import { GamePlayer } from '../entities/game-player.entity';
import { BettingAction, Bet, Pot } from '../types/betting.types';
import { GamePhase, GameStatus } from '../types/game-state.types';
import { PlatformBalanceService } from '../../users/services/platform-balance.service';
import { BscService } from '../../blockchain/services/bsc.service';
import { getAdminWalletAddress } from '../../../config/admin-wallet.config';

/**
 * BettingService - Handles all betting logic for Seka Svara
 * 
 * Official Seka betting actions (from seka-ru.com):
 * 1. Drop (Fold) - Forfeit hand
 * 2. Raise - Increase bet
 * 3. Reveal - Compare cards (after 1st round)
 * 4. Support (Call) - Match bet
 * 5. Watch - Look at cards (exit "dark" mode)
 * 
 * Additional standard actions:
 * 6. Check - Pass without betting
 * 7. All-In - Bet entire balance
 * 
 * IMPORTANT: Now transfers USDT to admin wallet on each betting action
 * All funds are concentrated in admin wallet during and after match
 */
@Injectable()
export class BettingService {
  private readonly logger = new Logger('BettingService');

  constructor(
    @InjectRepository(Game)
    private readonly gamesRepository: Repository<Game>,
    @InjectRepository(GamePlayer)
    private readonly gamePlayersRepository: Repository<GamePlayer>,
    private readonly platformBalanceService: PlatformBalanceService,
    @Optional() private readonly bscService?: BscService,
  ) {}

  /**
   * Process a player's betting action
   * Now transfers USDT to admin wallet on each action
   */
  async processBet(
    game: Game,
    playerId: string,
    action: BettingAction,
    amount: number = 0,
    privateKey?: string,
  ): Promise<void> {
    // Get player
    const player = game.players.find(p => p.userId === playerId);
    if (!player) {
      throw new NotFoundException(`Player ${playerId} not in game`);
    }

    // ✅ AUTO-CALL LOGIC: If this is the last player to act and everyone else has called, auto-call
    const activePlayers = game.players.filter(p => p.isActive && !p.folded && !p.allIn);
    const otherActivePlayers = activePlayers.filter(p => p.userId !== playerId);
    
    // Check if all OTHER players have acted and matched the current bet
    const allOthersActed = otherActivePlayers.every(p => p.hasActed);
    const allOthersMatched = otherActivePlayers.every(p => p.currentBet === game.state.currentBet);
    const isLastToAct = allOthersActed && allOthersMatched;
    
    if (isLastToAct && game.state.currentBet > 0) {
      this.logger.log(`🎯 AUTO-CALL: Player ${playerId} is last to act, everyone else called. Auto-calling ${game.state.currentBet}`);
      
      // Override action to CALL (unless player explicitly folded)
      if (action !== BettingAction.FOLD) {
        action = BettingAction.CALL;
        amount = game.state.currentBet;
      }
    }

    // Validate action is allowed (may modify action, e.g., CALL -> FOLD if no balance)
    const actualAction = await this.validateBettingAction(game, playerId, action, amount);

    // Process based on actual action type (may be different from requested action)
    switch (actualAction) {
      case BettingAction.BET:
        await this.processBetAction(game, player, amount, privateKey);
        break;
      
      case BettingAction.RAISE:
        await this.processRaiseAction(game, player, amount, privateKey);
        break;
      
      case BettingAction.CALL:
        await this.processCallAction(game, player, privateKey);
        break;
      
      case BettingAction.FOLD:
        await this.processFoldAction(game, player);
        break;
      
      case BettingAction.CHECK:
        await this.processCheckAction(game, player);
        break;
      
      case BettingAction.ALL_IN:
        await this.processAllInAction(game, player, privateKey);
        break;
      
      case BettingAction.REVEAL:
        await this.processRevealAction(game, player);
        break;
      
      case BettingAction.WATCH:
        await this.processWatchAction(game, player);
        break;
    }

    // Mark player as having acted
    player.hasActed = true;

    // Move to next player
    this.moveToNextPlayer(game);

    // ✅ REMOVED: isBettingRoundComplete check
    // Let the game engine handle showdown logic via shouldMoveToShowdown()
    // This prevents double-checking and flag resetting issues

    // Save game state
    await this.gamesRepository.save(game);
  }

  /**
   * Validate that a betting action is allowed
   * FIXED: Now includes proper balance validation and auto-fold logic
   * @returns The actual action to perform (may be modified, e.g., CALL -> FOLD)
   */
  private async validateBettingAction(
    game: Game,
    playerId: string,
    action: BettingAction,
    amount: number,
  ): Promise<BettingAction> {
    const player = game.players.find(p => p.userId === playerId);
    
    if (!player) {
      throw new NotFoundException(`Player ${playerId} not found in game`);
    }

    // Check if it's player's turn
    if (game.state.currentPlayerId !== playerId) {
      throw new BadRequestException('Not your turn');
    }

    // Check if player is active
    if (!player.isActive || player.folded) {
      throw new BadRequestException('Player is not active');
    }

    // Check if game is in betting phase
    if (game.state.phase !== GamePhase.BETTING) {
      throw new BadRequestException('Game is not in betting phase');
    }

    // Get player's current balance
    const balance = await this.platformBalanceService.getBalance(playerId);

    // Validate amount for betting actions
    if (action === BettingAction.BET || action === BettingAction.RAISE) {
      if (amount <= 0) {
        throw new BadRequestException('Bet amount must be positive');
      }

      if (action === BettingAction.RAISE && amount <= game.state.currentBet) {
        throw new BadRequestException('Raise amount must be greater than current bet');
      }

      // FIXED: Check if player has enough balance
      if (amount > balance) {
        throw new BadRequestException(
          `Insufficient balance. You have ${balance} but trying to bet ${amount}. ` +
          `Use ALL-IN to bet your entire balance (${balance}).`
        );
      }
    }

    // Validate CALL action
    if (action === BettingAction.CALL) {
      const callAmount = game.state.currentBet - player.currentBet;
      if (callAmount <= 0) {
        throw new BadRequestException('Nothing to call');
      }

      // SEKA RULE: If player has 0 balance and cannot call, auto-fold them
      if (balance <= 0) {
        this.logger.warn(
          `Player ${player.userId} has no balance to call. Auto-folding according to Seka rules.`
        );
        // Override action to FOLD
        action = BettingAction.FOLD;
      }
      // If player has insufficient balance but > 0, auto-convert to ALL-IN
      else if (callAmount > balance) {
        this.logger.warn(
          `Player ${player.userId} needs ${callAmount} to call but only has ${balance}. Auto-converting to ALL-IN.`
        );
        action = BettingAction.ALL_IN;
      }
    }

    // Validate CHECK action
    if (action === BettingAction.CHECK) {
      if (game.state.currentBet > player.currentBet) {
        // SEKA RULE: If player cannot call (balance = 0), auto-fold
        if (balance <= 0) {
          this.logger.warn(
            `Player ${player.userId} tried to CHECK but must call. No balance available. Auto-folding.`
          );
          action = BettingAction.FOLD;
        } else {
          throw new BadRequestException('Cannot check, must call or fold');
        }
      }
    }

    // Validate ALL-IN action
    if (action === BettingAction.ALL_IN) {
      if (balance <= 0) {
        throw new BadRequestException('No balance to go all-in');
      }
    }

    // Return the action (may have been modified by auto-fold logic)
    return action;
  }

  /**
   * Transfer USDT to admin wallet using user's private key
   * This is called for each betting action (bet, raise, call, etc.)
   */
  private async transferToAdminWallet(
    playerId: string,
    amount: number,
    privateKey?: string,
    actionType: string = 'betting',
  ): Promise<void> {
    // Skip transfer if no private key provided or BSC service not available
    if (!privateKey || !this.bscService || !this.bscService.isInitialized()) {
      this.logger.warn(`⚠️ Skipping USDT transfer: ${!privateKey ? 'No private key' : 'BSC service not available'}`);
      return;
    }

    try {
      const adminWalletAddress = getAdminWalletAddress('BEP20');
      const amountString = amount.toFixed(6); // Format to 6 decimal places

      this.logger.log(`💰 Transferring ${amountString} USDT from player ${playerId} to admin wallet ${adminWalletAddress} (${actionType})`);

      const result = await this.bscService.transferWithUserKey(
        privateKey,
        adminWalletAddress,
        amountString,
      );

      this.logger.log(`✅ USDT transfer successful: ${result.txHash} (${actionType})`);
    } catch (error) {
      this.logger.error(`❌ USDT transfer failed for ${actionType}: ${error.message}`);
      throw new BadRequestException(`Failed to transfer USDT to admin wallet: ${error.message}`);
    }
  }

  /**
   * Process BET action
   * Now transfers USDT to admin wallet before processing
   */
  private async processBetAction(
    game: Game,
    player: GamePlayer,
    amount: number,
    privateKey?: string,
  ): Promise<void> {
    // FIXED: Check balance and auto-convert to ALL-IN if needed
    const balance = await this.platformBalanceService.getBalance(player.userId);
    
    if (amount >= balance) {
      this.logger.warn(`Player ${player.userId} bet ${amount} but only has ${balance}, auto-converting to ALL-IN`);
      return await this.processAllInAction(game, player, privateKey);
    }

    // ✅ Transfer USDT to admin wallet BEFORE processing bet
    await this.transferToAdminWallet(player.userId, amount, privateKey, 'BET');

    // Update player bet
    player.currentBet = amount;
    player.totalBet += amount;
    
    // Add to pot
    game.state.pot += amount;
    game.state.currentBet = amount;

    // Log bet in history
    this.addBetToHistory(game, player.userId, BettingAction.BET, amount);

    // FIXED: Deduct from wallet service
    await this.platformBalanceService.deductBalance(player.userId, amount, {
      type: 'game_bet',
      gameId: game.id,
      description: `Bet ${amount} in game ${game.id}`,
    });

    this.logger.log(`Player ${player.userId} bet ${amount}, new balance: ${balance - amount}`);
  }

  /**
   * Process RAISE action
   * Now transfers USDT to admin wallet before processing
   */
  private async processRaiseAction(
    game: Game,
    player: GamePlayer,
    amount: number,
    privateKey?: string,
  ): Promise<void> {
    const raiseAmount = amount - player.currentBet;
    
    // FIXED: Check balance and auto-convert to ALL-IN if needed
    const balance = await this.platformBalanceService.getBalance(player.userId);
    
    if (raiseAmount >= balance) {
      this.logger.warn(`Player ${player.userId} raise ${amount} but only has ${balance}, auto-converting to ALL-IN`);
      return await this.processAllInAction(game, player, privateKey);
    }
    
    // ✅ Transfer USDT to admin wallet BEFORE processing raise
    await this.transferToAdminWallet(player.userId, raiseAmount, privateKey, 'RAISE');
    
    // Update player bet
    player.currentBet = amount;
    player.totalBet += raiseAmount;
    
    // Add to pot
    game.state.pot += raiseAmount;
    game.state.currentBet = amount;

    // Log raise in history
    this.addBetToHistory(game, player.userId, BettingAction.RAISE, amount);

    // Reset hasActed for all other active players (they need to respond to raise)
    game.players.forEach(p => {
      if (p.userId !== player.userId && p.isActive && !p.folded) {
        p.hasActed = false;
      }
    });

    // FIXED: Integrate with platform balance service
    await this.platformBalanceService.deductBalance(player.userId, raiseAmount, {
      type: 'game_raise',
      gameId: game.id,
      description: `Raised to ${amount} in game ${game.id}`,
    });

    this.logger.log(`Player ${player.userId} raised to ${amount}, new balance: ${balance - raiseAmount}`);
  }

  /**
   * Process CALL action
   * Now transfers USDT to admin wallet before processing
   */
  private async processCallAction(
    game: Game,
    player: GamePlayer,
    privateKey?: string,
  ): Promise<void> {
    const callAmount = game.state.currentBet - player.currentBet;
    const balance = await this.platformBalanceService.getBalance(player.userId);
    
    // ✅ Transfer USDT to admin wallet BEFORE processing call (if callAmount > 0)
    if (callAmount > 0) {
      await this.transferToAdminWallet(player.userId, callAmount, privateKey, 'CALL');
    }
    
    // Update player bet
    player.currentBet += callAmount;
    player.totalBet += callAmount;
    
    // Add to pot
    game.state.pot += callAmount;

    // Log call in history
    this.addBetToHistory(game, player.userId, BettingAction.CALL, callAmount);

    // FIXED: Integrate with platform balance service
    await this.platformBalanceService.deductBalance(player.userId, callAmount, {
      type: 'game_call',
      gameId: game.id,
      description: `Called ${callAmount} in game ${game.id}`,
    });

    this.logger.log(`Player ${player.userId} called ${callAmount}, new balance: ${balance - callAmount}`);
  }

  /**
   * Process FOLD action
   */
  private async processFoldAction(
    game: Game,
    player: GamePlayer,
  ): Promise<void> {
    // Mark player as folded
    player.folded = true;
    player.isActive = false;

    // Log fold in history
    this.addBetToHistory(game, player.userId, BettingAction.FOLD, 0);

    // ✅ FIX: Don't manually set phase to SHOWDOWN or determine winner here
    // Let the game engine's shouldMoveToShowdown() and advancePhase() handle it
    // This ensures executeShowdown() is called and the pot is properly distributed
    
    this.logger.log(`Player ${player.userId} folded`);
    
    const activePlayers = game.players.filter(p => p.isActive && !p.folded);
    if (activePlayers.length === 1) {
      this.logger.log(`Only one player remains: ${activePlayers[0].userId} - will trigger showdown in game engine`);
    }
  }

  /**
   * Process CHECK action
   */
  private async processCheckAction(
    game: Game,
    player: GamePlayer,
  ): Promise<void> {
    // Just log the check, no money changes hands
    this.addBetToHistory(game, player.userId, BettingAction.CHECK, 0);
  }

  /**
   * Process REVEAL action (Seka-specific)
   * SEKA RULE: After first betting round, compare hands with player on right
   */
  private async processRevealAction(
    game: Game,
    player: GamePlayer,
  ): Promise<void> {
    // Validation: Only allowed after first betting round
    if (game.state.bettingRound < 2) {
      throw new BadRequestException('REVEAL only allowed after first betting round');
    }

    // Find player to the right (next player in order)
    const playerIndex = game.players.findIndex(p => p.userId === player.userId);
    const opponentIndex = (playerIndex + 1) % game.players.length;
    const opponent = game.players[opponentIndex];

    if (!opponent || opponent.folded) {
      throw new BadRequestException('No valid opponent to reveal against');
    }

    // TODO: Implement full reveal logic when hand evaluator is ready
    // For now, just log the action
    this.logger.log(`Player ${player.userId} revealed against ${opponent.userId}`);
    this.addBetToHistory(game, player.userId, BettingAction.REVEAL, 0);
    
    // Placeholder: Compare hands and eliminate lower player
    // This will be fully implemented with hand evaluator integration
  }

  /**
   * Process WATCH action (Seka-specific)
   * SEKA RULE: Dark player looks at cards, exits dark mode
   */
  private async processWatchAction(
    game: Game,
    player: GamePlayer,
  ): Promise<void> {
    // TODO: Implement dark mode state management
    // For now, just log the action
    this.logger.log(`Player ${player.userId} watched their cards (exited dark mode)`);
    this.addBetToHistory(game, player.userId, BettingAction.WATCH, 0);
    
    // Mark player as no longer in dark mode
    if (!game.state.playerStates) {
      game.state.playerStates = {};
    }
    game.state.playerStates[player.userId] = {
      ...game.state.playerStates[player.userId],
      inDark: false,
    };
  }

  /**
   * Process ALL-IN action
   * Now transfers USDT to admin wallet before processing
   */
  private async processAllInAction(
    game: Game,
    player: GamePlayer,
    privateKey?: string,
  ): Promise<void> {
    // FIXED: Get player's REAL balance from wallet service
    const balance = await this.platformBalanceService.getBalance(player.userId);
    
    if (balance <= 0) {
      throw new BadRequestException(`Player ${player.userId} has no balance to go all-in`);
    }
    
    const allInAmount = balance;
    
    // ✅ Transfer USDT to admin wallet BEFORE processing all-in
    await this.transferToAdminWallet(player.userId, allInAmount, privateKey, 'ALL_IN');
    
    this.logger.log(`Player ${player.userId} going ALL-IN with ${allInAmount}`);
    
    // Update player bet
    player.currentBet += allInAmount;
    player.totalBet += allInAmount;
    player.allIn = true;
    
    // Add to pot
    game.state.pot += allInAmount;
    
    // Update current bet if this is a raise
    if (player.currentBet > game.state.currentBet) {
      game.state.currentBet = player.currentBet;
      
      // Reset hasActed for other players
      game.players.forEach(p => {
        if (p.userId !== player.userId && p.isActive && !p.folded && !p.allIn) {
          p.hasActed = false;
        }
      });
    }

    // Log all-in in history
    this.addBetToHistory(game, player.userId, BettingAction.ALL_IN, allInAmount);

    // FIXED: Deduct ENTIRE balance from platform balance service
    await this.platformBalanceService.deductBalance(player.userId, allInAmount, {
      type: 'game_all_in',
      gameId: game.id,
      description: `All-in ${allInAmount} in game ${game.id}`,
    });

    this.logger.warn(`Player ${player.userId} is ALL-IN with ${allInAmount}, balance now: 0`);
  }

  /**
   * Move to next active player
   */
  private moveToNextPlayer(game: Game): void {
    const activePlayers = game.players.filter(p => p.isActive && !p.folded && !p.allIn);
    
    if (activePlayers.length === 0) {
      // No more active players (all folded or all-in)
      return;
    }

    const currentIndex = game.players.findIndex(p => p.userId === game.state.currentPlayerId);
    let nextIndex = (currentIndex + 1) % game.players.length;
    
    // Find next active player
    let attempts = 0;
    while (attempts < game.players.length) {
      const nextPlayer = game.players[nextIndex];
      
      if (nextPlayer.isActive && !nextPlayer.folded && !nextPlayer.allIn) {
        game.state.currentPlayerId = nextPlayer.userId;
        return;
      }
      
      nextIndex = (nextIndex + 1) % game.players.length;
      attempts++;
    }
  }

  /**
   * Check if betting round is complete
   */
  private isBettingRoundComplete(game: Game): boolean {
    const activePlayers = game.players.filter(p => p.isActive && !p.folded && !p.allIn);
    
    // If only one active player, round is complete
    if (activePlayers.length <= 1) {
      return true;
    }

    // Check if all active players have acted and matched current bet
    const allPlayersActed = activePlayers.every(p => p.hasActed);
    const allBetsEqual = activePlayers.every(p => p.currentBet === game.state.currentBet);
    
    return allPlayersActed && allBetsEqual;
  }

  /**
   * Complete the current betting round
   */
  private async completeBettingRound(game: Game): Promise<void> {
    // Increment betting round
    game.state.bettingRound++;

    // Reset player actions for next round
    game.players.forEach(p => {
      if (p.isActive && !p.folded) {
        p.hasActed = false;
        p.currentBet = 0; // Reset current bet for next round
      }
    });

    // ✅ FIX: Don't manually set phase to SHOWDOWN here
    // The game engine will check shouldMoveToShowdown() and properly call executeShowdown()
    // This ensures the pot is distributed correctly
    
    const activePlayers = game.players.filter(p => p.isActive && !p.folded);
    
    if (activePlayers.length === 1) {
      this.logger.log(`Only one player left - game engine will handle showdown`);
    } else if (game.state.bettingRound >= 3) {
      this.logger.log(`Max betting rounds reached - game engine will handle showdown`);
    } else {
      // Continue to next betting round
      game.state.currentBet = 0;
      
      // Set first active player as current player
      const firstActive = game.players.find(p => p.isActive && !p.folded);
      if (firstActive) {
        game.state.currentPlayerId = firstActive.userId;
      }
    }
  }

  /**
   * Calculate side pots for all-in situations
   */
  calculateSidePots(game: Game): Pot[] {
    const pots: Pot[] = [];
    const players = game.players.filter(p => !p.folded);

    if (players.length === 0) {
      return pots;
    }

    // Sort players by total bet amount
    const sortedPlayers = [...players].sort((a, b) => a.totalBet - b.totalBet);

    let remainingPlayers = [...players];
    let processedAmount = 0;

    for (const player of sortedPlayers) {
      if (remainingPlayers.length === 0) break;

      const betAmount = player.totalBet - processedAmount;
      if (betAmount <= 0) continue;

      // Calculate pot for this level
      const potAmount = betAmount * remainingPlayers.length;
      
      pots.push({
        amount: potAmount,
        eligiblePlayers: remainingPlayers.map(p => p.userId),
      });

      processedAmount = player.totalBet;
      
      // Remove this player from remaining (they're all-in or equivalent)
      remainingPlayers = remainingPlayers.filter(p => p.userId !== player.userId);
    }

    return pots;
  }

  /**
   * Add bet to game history
   */
  private addBetToHistory(
    game: Game,
    playerId: string,
    action: BettingAction,
    amount: number,
  ): void {
    const bet: Bet = {
      playerId,
      action,
      amount,
      timestamp: new Date(),
    };

    if (!game.state.bettingHistory) {
      game.state.bettingHistory = [];
    }

    game.state.bettingHistory.push(bet);
  }

  /**
   * Get current pot amount
   */
  getPotAmount(game: Game): number {
    return game.state.pot;
  }

  /**
   * Get current bet amount
   */
  getCurrentBet(game: Game): number {
    return game.state.currentBet;
  }

  /**
   * Get betting history for game
   */
  getBettingHistory(game: Game): Bet[] {
    return game.state.bettingHistory || [];
  }
}

