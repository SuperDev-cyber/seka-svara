/**
 * Card Types for Seka Svara Game
 * 36-card deck (6, 7, 8, 9, 10, J, Q, K, A in all 4 suits)
 */

export enum Suit {
  HEARTS = '♥',
  DIAMONDS = '♦',
  CLUBS = '♣',
  SPADES = '♠',
}

export enum Rank {
  SIX = '6',
  SEVEN = '7',
  EIGHT = '8',
  NINE = '9',
  TEN = '10',
  JACK = 'J',
  QUEEN = 'Q',
  KING = 'K',
  ACE = 'A',
}

export interface Card {
  suit: Suit;
  rank: Rank;
  value: number; // Point value for hand evaluation
  isJoker?: boolean; // True if this is 6 of Clubs (wildcard)
}

export type Deck = Card[];
export type Hand = Card[];

/**
 * Card values for Seka Svara:
 * - Ace: 11 points
 * - K, Q, J, 10: 10 points each
 * - 9: 9 points
 * - 8: 8 points
 * - 7: 7 points
 * - 6: 6 points
 * - 7 of Clubs: Joker (can substitute any card)
 */
export const CARD_VALUES: Record<Rank, number> = {
  [Rank.ACE]: 11,
  [Rank.KING]: 10,
  [Rank.QUEEN]: 10,
  [Rank.JACK]: 10,
  [Rank.TEN]: 10,
  [Rank.NINE]: 9,
  [Rank.EIGHT]: 8,
  [Rank.SEVEN]: 7,
  [Rank.SIX]: 6,
};


