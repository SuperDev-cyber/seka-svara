import { Injectable } from '@nestjs/common';
import { Card, Deck, Hand, Rank, Suit, CARD_VALUES } from '../types/card.types';
import * as crypto from 'crypto';

/**
 * Deck Service for Seka Svara
 * Handles deck creation, shuffling, and dealing
 */
@Injectable()
export class DeckService {
  /**
   * Creates a 36-card Seka Svara deck
   * Cards: 6, 7, 8, 9, 10, J, Q, K, A in all 4 suits
   */
  createDeck(): Deck {
    const deck: Deck = [];
    const suits = Object.values(Suit);
    const ranks = Object.values(Rank);

    for (const suit of suits) {
      for (const rank of ranks) {
        const card: Card = {
          suit,
          rank,
          value: CARD_VALUES[rank],
          // Mark 7 of Clubs as Joker (official Seka rules)
          isJoker: rank === Rank.SEVEN && suit === Suit.CLUBS,
        };
        
        deck.push(card);
      }
    }

    return deck;
  }

  /**
   * Fisher-Yates shuffle algorithm
   * Uses Math.random() - for production, use secureShuffle()
   */
  shuffle(deck: Deck): Deck {
    const shuffled = [...deck];
    
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }

  /**
   * Cryptographically secure shuffle for production
   * Uses crypto.randomBytes for truly random shuffle
   */
  secureShuffle(deck: Deck): Deck {
    const shuffled = [...deck];

    for (let i = shuffled.length - 1; i > 0; i--) {
      // Generate cryptographically secure random number
      const randomBytes = crypto.randomBytes(4);
      const randomNum = randomBytes.readUInt32BE(0);
      const j = randomNum % (i + 1);
      
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }

  /**
   * Deal cards from the deck
   * Returns the dealt hand and remaining deck
   */
  deal(deck: Deck, numCards: number): { hand: Hand; remaining: Deck } {
    if (numCards > deck.length) {
      throw new Error(
        `Cannot deal ${numCards} cards from deck of ${deck.length}`,
      );
    }

    const hand = deck.slice(0, numCards);
    const remaining = deck.slice(numCards);
    
    return { hand, remaining };
  }

  /**
   * Deal to multiple players
   * Returns hands for each player and remaining deck
   */
  dealToPlayers(
    deck: Deck,
    numPlayers: number,
    cardsPerPlayer: number = 3,
  ): { hands: Hand[]; remaining: Deck } {
    const hands: Hand[] = [];
    let remaining = [...deck];

    for (let i = 0; i < numPlayers; i++) {
      const result = this.deal(remaining, cardsPerPlayer);
      hands.push(result.hand);
      remaining = result.remaining;
    }

    return { hands, remaining };
  }

  /**
   * Get card display string (for debugging/logging)
   */
  getCardString(card: Card): string {
    const jokerMark = card.isJoker ? ' (JOKER)' : '';
    return `${card.rank}${card.suit}${jokerMark}`;
  }

  /**
   * Get hand display string
   */
  getHandString(hand: Hand): string {
    return hand.map(card => this.getCardString(card)).join(', ');
  }
}


