/**
 * Betting Types for Seka Svara
 */

export enum BettingAction {
  CHECK = 'check',
  BET = 'bet',
  CALL = 'call',
  RAISE = 'raise',
  FOLD = 'fold',
  ALL_IN = 'all_in',
  REVEAL = 'reveal',     // Seka-specific: Compare hands with opponent
  WATCH = 'watch',       // Seka-specific: Look at cards (exit dark mode)
}

export interface Bet {
  playerId: string;
  amount: number;
  action: BettingAction;
  timestamp: Date;
}

export interface Pot {
  amount: number;
  eligiblePlayers: string[]; // For side pots when players go all-in
}

export interface BettingRoundState {
  currentBet: number;
  pot: number;
  bets: Bet[];
  playersActed: Set<string>;
}


