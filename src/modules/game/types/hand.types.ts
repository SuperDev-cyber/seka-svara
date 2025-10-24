import { Card } from './card.types';

/**
 * Hand rankings for Seka Svara (official rules)
 * 
 * NOTE: In Seka, the winner is determined by POINT TOTAL, not hand rank!
 * These ranks are for categorization only.
 * 
 * Based on official rules from http://seka-ru.com/en/rules-seka.php
 */
export enum HandRank {
  HIGH_CARD = 0,        // Highest single card
  FLUSH = 1,            // Same suit (sum of cards)
  TWO_ACES = 2,         // Exactly 2 Aces (always 22 points)
  THREE_OF_A_KIND = 3,  // Three same rank (sum of all cards)
  THREE_SEVENS = 4,     // Three 7s - special case (34 points, not 21!)
}

/**
 * Represents an evaluated hand with its point value
 * 
 * In Seka, the 'value' field is the POINT TOTAL that determines the winner.
 * The 'rank' field is for categorization/display only.
 */
export interface EvaluatedHand {
  rank: HandRank;           // Category of hand (for display)
  value: number;            // POINT TOTAL (determines winner!)
  description: string;      // Human-readable description
  cards: Card[];            // The actual cards
}
