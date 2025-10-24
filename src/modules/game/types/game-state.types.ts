import { Bet } from './betting.types';
import { Hand } from './card.types';
import { EvaluatedHand } from './hand.types';

/**
 * Game phases in Seka Svara
 */
export enum GamePhase {
  WAITING = 'waiting',         // Waiting for players
  DEALING = 'dealing',         // Dealing cards
  BETTING = 'betting',         // Betting rounds
  SHOWDOWN = 'showdown',       // Reveal and determine winner
  COMPLETED = 'completed',     // Game finished
}

/**
 * Game status
 */
export enum GameStatus {
  PENDING = 'pending',         // Not started
  IN_PROGRESS = 'in_progress', // Currently playing
  COMPLETED = 'completed',     // Finished
  CANCELLED = 'cancelled',     // Cancelled
}

/**
 * Player state in game
 */
export interface PlayerGameState {
  userId: string;
  hand: Hand;                   // Player's cards
  evaluatedHand?: EvaluatedHand; // Evaluated hand (after showdown)
  currentBet: number;           // Current round bet
  totalBet: number;             // Total bet in game
  folded: boolean;              // Has folded?
  allIn: boolean;               // Is all-in?
  isActive: boolean;            // Still in game?
  hasActed: boolean;            // Has acted this round?
  inDark: boolean;              // Playing "in the dark"?
  isDealer: boolean;            // Is the dealer?
  isSmallBlind: boolean;        // Is small blind?
  isBigBlind: boolean;          // Is big blind?
  hasSeenCards: boolean;        // Has seen their cards?
  blindAmount: number;          // Amount posted as blind
}

/**
 * Complete game state
 */
export interface GameState {
  phase: GamePhase;
  bettingRound: number;         // Current betting round (1, 2, 3...)
  currentPlayerId: string;      // Whose turn is it?
  pot: number;                  // Current pot amount
  currentBet: number;           // Current bet to match
  bettingHistory: Bet[];        // All bets made
  winners: string[];            // Winner IDs (multiple if tie/Svara)
  playerStates: Map<string, PlayerGameState>; // Player states
  startedAt: Date;
  completedAt?: Date;
  // Blind system properties
  smallBlindAmount: number;     // Small blind amount
  bigBlindAmount: number;       // Big blind amount
  dealerPosition: number;       // Dealer button position
  smallBlindPosition: number;   // Small blind position
  bigBlindPosition: number;     // Big blind position
  blindsPosted: boolean;        // Have blinds been posted?
  gameStartDelay: number;       // Delay before game starts (seconds)
}

