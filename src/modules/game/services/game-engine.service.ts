import { Injectable } from '@nestjs/common';
import { DeckService } from './deck.service';
import { HandEvaluatorService } from './hand-evaluator.service';
import { BettingService } from './betting.service';
import { GameStateService } from './game-state.service';
import { Game } from '../entities/game.entity';
import { BettingAction } from '../types/betting.types';
import { GamePhase } from '../types/game-state.types';

/**
 * GameEngine - High-level orchestrator for Seka Svara game flow
 * 
 * This service coordinates all game services to provide a complete game experience.
 * It acts as the main entry point for game operations.
 */
@Injectable()
export class GameEngine {
  constructor(
    private readonly deckService: DeckService,
    private readonly handEvaluatorService: HandEvaluatorService,
    private readonly bettingService: BettingService,
    private readonly gameStateService: GameStateService,
  ) {}

  /**
   * Initialize a new game with players
   */
  async initializeGame(game: Game, ante: number = 0): Promise<Game> {
    await this.gameStateService.initializeGame(game, ante);
    return game;
  }

  /**
   * Process a player action (betting action)
   */
  async processPlayerAction(
    game: Game,
    playerId: string,
    action: BettingAction,
    amount: number = 0,
    privateKey?: string,
  ): Promise<Game> {
    // Validate game is in correct phase
    if (game.state.phase !== GamePhase.BETTING) {
      throw new Error('Game is not in betting phase');
    }

    // Process the betting action (now includes privateKey for USDT transfers)
    await this.bettingService.processBet(game, playerId, action, amount, privateKey);

    // Check if betting round is complete and should advance
    if (this.gameStateService.shouldMoveToShowdown(game)) {
      await this.gameStateService.advancePhase(game);
    }

    return game;
  }

  /**
   * Execute showdown (reveal hands and determine winner)
   */
  async executeShowdown(game: Game): Promise<Game> {
    await this.gameStateService.executeShowdown(game);
    return game;
  }

  /**
   * Check if game is over
   */
  isGameOver(game: Game): boolean {
    return game.state.phase === GamePhase.COMPLETED;
  }

  /**
   * Get current game state summary
   */
  async getGameState(game: Game) {
    return await this.gameStateService.getGameStateSummary(game);
  }

  /**
   * Calculate pot distribution with platform fee
   * 
   * @param pot - Total pot amount
   * @param platformFeePercent - Platform fee percentage (e.g., 5 for 5%)
   * @returns Object with winner amount and platform fee
   */
  calculatePotDistribution(pot: number, platformFeePercent: number = 5) {
    const fee = (pot * platformFeePercent) / 100;
    const winnerAmount = pot - fee;
    
    return {
      totalPot: pot,
      platformFee: fee,
      winnerAmount,
      feePercent: platformFeePercent,
    };
  }

  /**
   * Validate if an action is allowed for a player
   */
  async validateAction(
    game: Game,
    playerId: string,
    action: BettingAction,
    amount: number = 0,
  ): Promise<boolean> {
    try {
      // Use betting service's validation
      // This is a bit hacky but works for now
      const player = game.players.find(p => p.userId === playerId);
      
      if (!player) {
        return false;
      }

      // Check basic conditions
      if (game.state.phase !== GamePhase.BETTING) {
        return false;
      }

      if (game.state.currentPlayerId !== playerId) {
        return false;
      }

      if (!player.isActive || player.folded) {
        return false;
      }

      // Specific action validations
      if (action === BettingAction.BET || action === BettingAction.RAISE) {
        if (amount <= 0 || amount < game.state.currentBet) {
          return false;
        }
      }

      if (action === BettingAction.CALL) {
        const callAmount = game.state.currentBet - player.currentBet;
        if (callAmount <= 0) {
          return false;
        }
      }

      if (action === BettingAction.CHECK) {
        if (game.state.currentBet > player.currentBet) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get available actions for a player
   */
  getAvailableActions(game: Game, playerId: string): BettingAction[] {
    const player = game.players.find(p => p.userId === playerId);
    
    if (!player || !player.isActive || player.folded) {
      return [];
    }

    if (game.state.phase !== GamePhase.BETTING) {
      return [];
    }

    if (game.state.currentPlayerId !== playerId) {
      return [];
    }

    const actions: BettingAction[] = [BettingAction.FOLD];

    // Check if can check
    if (game.state.currentBet === 0 || player.currentBet === game.state.currentBet) {
      actions.push(BettingAction.CHECK);
    }

    // Can always bet or raise
    actions.push(BettingAction.BET, BettingAction.RAISE);

    // Can call if there's a bet to match
    if (game.state.currentBet > player.currentBet) {
      actions.push(BettingAction.CALL);
    }

    // Can always go all-in
    actions.push(BettingAction.ALL_IN);

    return actions;
  }

  /**
   * Get hand evaluation for a player (only in showdown)
   */
  evaluatePlayerHand(game: Game, playerId: string) {
    if (game.state.phase !== GamePhase.SHOWDOWN && game.state.phase !== GamePhase.COMPLETED) {
      throw new Error('Cannot evaluate hand before showdown');
    }

    const player = game.players.find(p => p.userId === playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    return this.handEvaluatorService.evaluateHand(player.hand);
  }
}
