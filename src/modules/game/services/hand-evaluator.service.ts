import { Injectable } from '@nestjs/common';
import { Card, Hand, Rank, Suit } from '../types/card.types';
import { EvaluatedHand, HandRank } from '../types/hand.types';
import { DeckService } from './deck.service';

/**
 * HandEvaluatorService - Implements official Seka Svara rules
 * 
 * Official rules from http://seka-ru.com/en/rules-seka.php:
 * 
 * SCORING SYSTEM:
 * 1. Three of a Kind (same rank): Sum all cards
 *    - Special: 777 = 34 points (highest possible!)
 *    - AAA = 33 points, KKK = 30 points, etc.
 * 
 * 2. Two Aces: ANY hand with 2 Aces = ALWAYS 22 points
 * 
 * 3. Flush (same suit): Sum cards of same suit, pick highest sum
 * 
 * 4. Mixed: Highest card value
 * 
 * JOKER: 7 of Clubs
 * - For ranks: replaces missing card
 * - For suits: worth 11 points
 * 
 * WINNER: Player with HIGHEST POINT TOTAL
 */
@Injectable()
export class HandEvaluatorService {
  private readonly JOKER_CARD = { suit: Suit.CLUBS, rank: Rank.SEVEN };

  constructor(private readonly deckService: DeckService) {}

  /**
   * Evaluate a hand according to official Seka rules
   * Returns the point total and hand description
   */
  evaluateHand(hand: Hand): EvaluatedHand {
    if (hand.length !== 3) {
      throw new Error('Hand must contain exactly 3 cards');
    }

    // Check if hand contains joker (7 of Clubs)
    const hasJoker = this.hasJoker(hand);
    
    if (hasJoker) {
      return this.evaluateHandWithJoker(hand);
    }

    // No joker - evaluate normally
    return this.evaluateNormalHand(hand);
  }

  /**
   * Evaluate hand without joker (standard rules)
   */
  private evaluateNormalHand(hand: Hand): EvaluatedHand {
    // Rule 1: Check for Three of a Kind (same rank)
    if (this.isThreeOfAKind(hand)) {
      const rank = hand[0].rank;
      
      // Special case: 777 = 34 points (not 21!)
      if (rank === Rank.SEVEN) {
        return {
          rank: HandRank.THREE_SEVENS,
          value: 34,
          description: 'Three 7s (Sherkes) - 34 points',
          cards: hand,
        };
      }
      
      // Other three of a kind: sum all cards
      const points = this.sumCardValues(hand);
      return {
        rank: HandRank.THREE_OF_A_KIND,
        value: points,
        description: `Three ${rank}s - ${points} points`,
        cards: hand,
      };
    }

    // Rule 2: Check for Two Aces (ALWAYS 22 points)
    if (this.hasTwoAces(hand)) {
      return {
        rank: HandRank.TWO_ACES,
        value: 22,
        description: 'Two Aces - 22 points',
        cards: hand,
      };
    }

    // Rule 3: Check for Flush (same suit) - sum cards of same suit
    const flushPoints = this.getFlushPoints(hand);
    if (flushPoints > 0) {
      return {
        rank: HandRank.FLUSH,
        value: flushPoints,
        description: `Flush - ${flushPoints} points`,
        cards: hand,
      };
    }

    // Rule 4: No special combination - highest card value
    const highCard = this.getHighestCard(hand);
    return {
      rank: HandRank.HIGH_CARD,
      value: highCard.value,
      description: `High Card ${highCard.rank} - ${highCard.value} points`,
      cards: hand,
    };
  }

  /**
   * Evaluate hand with joker (7 of Clubs)
   * Joker can replace any card to maximize points
   */
  private evaluateHandWithJoker(hand: Hand): EvaluatedHand {
    const nonJokerCards = hand.filter(card => !this.isJokerCard(card));
    
    if (nonJokerCards.length !== 2) {
      throw new Error('Hand with joker should have exactly 2 non-joker cards');
    }

    // Generate all possible hands by replacing joker with each possible card
    const allCards = this.generateAllPossibleCards();
    let bestHand: EvaluatedHand | null = null;

    for (const replacementCard of allCards) {
      // Skip if replacement card is the joker itself
      if (this.isJokerCard(replacementCard)) {
        continue;
      }

      // Create simulated hand with joker replaced
      const simulatedHand: Hand = [...nonJokerCards, replacementCard];
      const evaluatedHand = this.evaluateNormalHand(simulatedHand);

      // Keep track of best hand
      if (!bestHand || evaluatedHand.value > bestHand.value) {
        bestHand = evaluatedHand;
      }
    }

    if (!bestHand) {
      throw new Error('Failed to evaluate hand with joker');
    }

    // Return best hand but keep original cards (with joker)
    return {
      ...bestHand,
      description: `${bestHand.description} (with Joker)`,
      cards: hand, // Keep original hand with joker
    };
  }

  /**
   * Compare two hands - returns positive if hand1 wins, negative if hand2 wins, 0 for tie
   */
  compareHands(hand1: EvaluatedHand, hand2: EvaluatedHand): number {
    // In Seka, winner is simply the highest point total
    if (hand1.value > hand2.value) return 1;
    if (hand1.value < hand2.value) return -1;
    
    // Tie - same points (triggers Svara round in real game)
    return 0;
  }

  /**
   * Determine winner(s) from a map of player hands
   * Returns array of player IDs (multiple if tie)
   */
  determineWinner(hands: Map<string, EvaluatedHand>): string[] {
    if (hands.size === 0) return [];

    let maxPoints = -1;
    const winners: string[] = [];

    for (const [playerId, hand] of hands.entries()) {
      if (hand.value > maxPoints) {
        maxPoints = hand.value;
        winners.length = 0; // Clear previous winners
        winners.push(playerId);
      } else if (hand.value === maxPoints) {
        winners.push(playerId); // Tie - multiple winners (Svara)
      }
    }

    return winners;
  }

  // ==================== HELPER METHODS ====================

  /**
   * Check if hand contains joker (7 of Clubs)
   */
  private hasJoker(hand: Hand): boolean {
    return hand.some(card => this.isJokerCard(card));
  }

  /**
   * Check if a card is the joker (7 of Clubs)
   */
  private isJokerCard(card: Card): boolean {
    return card.suit === this.JOKER_CARD.suit && card.rank === this.JOKER_CARD.rank;
  }

  /**
   * Check if hand has three cards of the same rank
   */
  private isThreeOfAKind(hand: Hand): boolean {
    return hand[0].rank === hand[1].rank && hand[1].rank === hand[2].rank;
  }

  /**
   * Check if hand has exactly two Aces
   */
  private hasTwoAces(hand: Hand): boolean {
    const aceCount = hand.filter(card => card.rank === Rank.ACE).length;
    return aceCount === 2;
  }

  /**
   * Get flush points (sum of cards of same suit)
   * Returns 0 if no flush
   */
  private getFlushPoints(hand: Hand): number {
    // Group cards by suit
    const suitGroups = new Map<Suit, Card[]>();
    
    for (const card of hand) {
      const cards = suitGroups.get(card.suit) || [];
      cards.push(card);
      suitGroups.set(card.suit, cards);
    }

    // Find suit with 3 cards (flush)
    for (const [suit, cards] of suitGroups.entries()) {
      if (cards.length === 3) {
        // All 3 cards are same suit - sum them
        return this.sumCardValues(cards);
      }
    }

    // No flush - try to find best partial flush (2 cards same suit)
    let maxPartialFlush = 0;
    for (const [suit, cards] of suitGroups.entries()) {
      if (cards.length === 2) {
        const partialSum = this.sumCardValues(cards);
        maxPartialFlush = Math.max(maxPartialFlush, partialSum);
      }
    }

    return maxPartialFlush;
  }

  /**
   * Sum the values of cards
   */
  private sumCardValues(cards: Card[]): number {
    return cards.reduce((sum, card) => sum + card.value, 0);
  }

  /**
   * Get the highest value card from hand
   */
  private getHighestCard(hand: Hand): Card {
    return hand.reduce((highest, card) => 
      card.value > highest.value ? card : highest
    );
  }

  /**
   * Generate all possible cards in the deck (for joker evaluation)
   */
  private generateAllPossibleCards(): Card[] {
    return this.deckService.createDeck();
  }
}
