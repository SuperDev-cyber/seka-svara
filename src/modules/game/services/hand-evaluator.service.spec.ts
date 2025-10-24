import { Test, TestingModule } from '@nestjs/testing';
import { HandEvaluatorService } from './hand-evaluator.service';
import { DeckService } from './deck.service';
import { Card, Hand, Rank, Suit } from '../types/card.types';
import { HandRank } from '../types/hand.types';

/**
 * Unit tests for HandEvaluatorService
 * 
 * Tests based on official Seka rules from http://seka-ru.com/en/rules-seka.php
 * 
 * OFFICIAL RULES:
 * 1. Three of a Kind: Sum all cards (777 = 34 points special!)
 * 2. Two Aces: Always 22 points
 * 3. Flush: Sum same suit cards
 * 4. High Card: Highest card value
 * 5. Joker: 7 of Clubs (replaces any card)
 */
describe('HandEvaluatorService - Official Seka Rules', () => {
  let service: HandEvaluatorService;
  let deckService: DeckService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HandEvaluatorService, DeckService],
    }).compile();

    service = module.get<HandEvaluatorService>(HandEvaluatorService);
    deckService = module.get<DeckService>(DeckService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== RULE 1: THREE OF A KIND ====================

  describe('Three of a Kind (Same Rank)', () => {
    it('should score Three 7s as 34 points (HIGHEST HAND)', () => {
      const hand: Hand = [
        { suit: Suit.HEARTS, rank: Rank.SEVEN, value: 7, isJoker: false },
        { suit: Suit.DIAMONDS, rank: Rank.SEVEN, value: 7, isJoker: false },
        { suit: Suit.SPADES, rank: Rank.SEVEN, value: 7, isJoker: false },
      ];

      const result = service.evaluateHand(hand);

      expect(result.rank).toBe(HandRank.THREE_SEVENS);
      expect(result.value).toBe(34); // NOT 21! Special rule
      expect(result.description).toContain('34 points');
    });

    it('should score Three Aces as 33 points (11+11+11)', () => {
      const hand: Hand = [
        { suit: Suit.HEARTS, rank: Rank.ACE, value: 11, isJoker: false },
        { suit: Suit.DIAMONDS, rank: Rank.ACE, value: 11, isJoker: false },
        { suit: Suit.CLUBS, rank: Rank.ACE, value: 11, isJoker: false },
      ];

      const result = service.evaluateHand(hand);

      expect(result.rank).toBe(HandRank.THREE_OF_A_KIND);
      expect(result.value).toBe(33);
    });

    it('should score Three Kings as 30 points (10+10+10)', () => {
      const hand: Hand = [
        { suit: Suit.HEARTS, rank: Rank.KING, value: 10, isJoker: false },
        { suit: Suit.DIAMONDS, rank: Rank.KING, value: 10, isJoker: false },
        { suit: Suit.SPADES, rank: Rank.KING, value: 10, isJoker: false },
      ];

      const result = service.evaluateHand(hand);

      expect(result.rank).toBe(HandRank.THREE_OF_A_KIND);
      expect(result.value).toBe(30);
    });

    it('should score Three Queens as 30 points', () => {
      const hand: Hand = [
        { suit: Suit.HEARTS, rank: Rank.QUEEN, value: 10, isJoker: false },
        { suit: Suit.DIAMONDS, rank: Rank.QUEEN, value: 10, isJoker: false },
        { suit: Suit.CLUBS, rank: Rank.QUEEN, value: 10, isJoker: false },
      ];

      const result = service.evaluateHand(hand);

      expect(result.rank).toBe(HandRank.THREE_OF_A_KIND);
      expect(result.value).toBe(30);
    });
  });

  // ==================== RULE 2: TWO ACES ====================

  describe('Two Aces (Always 22 points)', () => {
    it('should score 2 Aces + King as 22 points (not 32)', () => {
      const hand: Hand = [
        { suit: Suit.HEARTS, rank: Rank.ACE, value: 11, isJoker: false },
        { suit: Suit.DIAMONDS, rank: Rank.ACE, value: 11, isJoker: false },
        { suit: Suit.CLUBS, rank: Rank.KING, value: 10, isJoker: false },
      ];

      const result = service.evaluateHand(hand);

      expect(result.rank).toBe(HandRank.TWO_ACES);
      expect(result.value).toBe(22); // ALWAYS 22, not 11+11+10=32!
    });

    it('should score 2 Aces + 6 as 22 points (not 28)', () => {
      const hand: Hand = [
        { suit: Suit.HEARTS, rank: Rank.ACE, value: 11, isJoker: false },
        { suit: Suit.SPADES, rank: Rank.ACE, value: 11, isJoker: false },
        { suit: Suit.DIAMONDS, rank: Rank.SIX, value: 6, isJoker: false },
      ];

      const result = service.evaluateHand(hand);

      expect(result.rank).toBe(HandRank.TWO_ACES);
      expect(result.value).toBe(22); // ALWAYS 22!
    });
  });

  // ==================== RULE 3: FLUSH (Same Suit) ====================

  describe('Flush (Same Suit)', () => {
    it('should score Ace-King-Queen of same suit as 31 points', () => {
      const hand: Hand = [
        { suit: Suit.HEARTS, rank: Rank.ACE, value: 11, isJoker: false },
        { suit: Suit.HEARTS, rank: Rank.KING, value: 10, isJoker: false },
        { suit: Suit.HEARTS, rank: Rank.QUEEN, value: 10, isJoker: false },
      ];

      const result = service.evaluateHand(hand);

      expect(result.rank).toBe(HandRank.FLUSH);
      expect(result.value).toBe(31); // 11+10+10
    });

    it('should score King-Queen-Jack of same suit as 30 points', () => {
      const hand: Hand = [
        { suit: Suit.SPADES, rank: Rank.KING, value: 10, isJoker: false },
        { suit: Suit.SPADES, rank: Rank.QUEEN, value: 10, isJoker: false },
        { suit: Suit.SPADES, rank: Rank.JACK, value: 10, isJoker: false },
      ];

      const result = service.evaluateHand(hand);

      expect(result.rank).toBe(HandRank.FLUSH);
      expect(result.value).toBe(30);
    });

    it('should score 10-9-8 of same suit as 27 points', () => {
      const hand: Hand = [
        { suit: Suit.DIAMONDS, rank: Rank.TEN, value: 10, isJoker: false },
        { suit: Suit.DIAMONDS, rank: Rank.NINE, value: 9, isJoker: false },
        { suit: Suit.DIAMONDS, rank: Rank.EIGHT, value: 8, isJoker: false },
      ];

      const result = service.evaluateHand(hand);

      expect(result.rank).toBe(HandRank.FLUSH);
      expect(result.value).toBe(27);
    });
  });

  // ==================== RULE 4: HIGH CARD ====================

  describe('High Card (Mixed Suits, No Special)', () => {
    it('should score Ace high as 11 points', () => {
      const hand: Hand = [
        { suit: Suit.HEARTS, rank: Rank.ACE, value: 11, isJoker: false },
        { suit: Suit.DIAMONDS, rank: Rank.KING, value: 10, isJoker: false },
        { suit: Suit.CLUBS, rank: Rank.QUEEN, value: 10, isJoker: false },
      ];

      const result = service.evaluateHand(hand);

      // Not flush (different suits), not 2 aces, not 3 of a kind
      // Should be high card
      expect(result.rank).toBe(HandRank.HIGH_CARD);
      expect(result.value).toBe(11); // Highest single card
    });

    it('should score King high as 10 points', () => {
      const hand: Hand = [
        { suit: Suit.HEARTS, rank: Rank.KING, value: 10, isJoker: false },
        { suit: Suit.DIAMONDS, rank: Rank.NINE, value: 9, isJoker: false },
        { suit: Suit.SPADES, rank: Rank.EIGHT, value: 8, isJoker: false }, // Changed from 7♣ (joker)
      ];

      const result = service.evaluateHand(hand);

      expect(result.rank).toBe(HandRank.HIGH_CARD);
      expect(result.value).toBe(10);
    });
  });

  // ==================== RULE 5: JOKER (7 of Clubs) ====================

  describe('Joker (7 of Clubs)', () => {
    it('should recognize 7 of Clubs as joker', () => {
      const hand: Hand = [
        { suit: Suit.CLUBS, rank: Rank.SEVEN, value: 7, isJoker: true },
        { suit: Suit.HEARTS, rank: Rank.ACE, value: 11, isJoker: false },
        { suit: Suit.DIAMONDS, rank: Rank.KING, value: 10, isJoker: false },
      ];

      const result = service.evaluateHand(hand);

      // Joker should help create best possible hand
      expect(result.description).toContain('Joker');
    });

    it('should use joker to complete Three of a Kind', () => {
      const hand: Hand = [
        { suit: Suit.CLUBS, rank: Rank.SEVEN, value: 7, isJoker: true }, // Joker
        { suit: Suit.HEARTS, rank: Rank.ACE, value: 11, isJoker: false },
        { suit: Suit.DIAMONDS, rank: Rank.ACE, value: 11, isJoker: false },
      ];

      const result = service.evaluateHand(hand);

      // Joker can become Ace, making AAA = 33 points
      expect(result.value).toBe(33); // Three Aces with joker
    });

    it('should use joker optimally to maximize points', () => {
      const hand: Hand = [
        { suit: Suit.CLUBS, rank: Rank.SEVEN, value: 7, isJoker: true }, // Joker
        { suit: Suit.HEARTS, rank: Rank.KING, value: 10, isJoker: false },
        { suit: Suit.DIAMONDS, rank: Rank.KING, value: 10, isJoker: false },
      ];

      const result = service.evaluateHand(hand);

      // Joker becomes King, making KKK = 30 points
      expect(result.value).toBe(30);
    });
  });

  // ==================== WINNER DETERMINATION ====================

  describe('Winner Determination', () => {
    it('should determine winner by highest points', () => {
      const hands = new Map();
      
      // Player 1: Three 7s (34 points)
      hands.set('player1', {
        rank: HandRank.THREE_SEVENS,
        value: 34,
        description: 'Three 7s',
        cards: [],
      });

      // Player 2: Three Aces (33 points)
      hands.set('player2', {
        rank: HandRank.THREE_OF_A_KIND,
        value: 33,
        description: 'Three Aces',
        cards: [],
      });

      const winners = service.determineWinner(hands);

      expect(winners).toEqual(['player1']); // Three 7s wins!
    });

    it('should detect tie when players have same points (Svara)', () => {
      const hands = new Map();
      
      // Both players have 30 points
      hands.set('player1', {
        rank: HandRank.THREE_OF_A_KIND,
        value: 30,
        description: 'Three Kings',
        cards: [],
      });

      hands.set('player2', {
        rank: HandRank.FLUSH,
        value: 30,
        description: 'Flush',
        cards: [],
      });

      const winners = service.determineWinner(hands);

      expect(winners).toHaveLength(2); // Tie - both win (Svara round needed)
      expect(winners).toContain('player1');
      expect(winners).toContain('player2');
    });

    it('should handle multiple players correctly', () => {
      const hands = new Map();
      
      hands.set('player1', { rank: HandRank.HIGH_CARD, value: 11, description: 'Ace', cards: [] });
      hands.set('player2', { rank: HandRank.FLUSH, value: 31, description: 'Flush', cards: [] });
      hands.set('player3', { rank: HandRank.TWO_ACES, value: 22, description: 'Two Aces', cards: [] });
      hands.set('player4', { rank: HandRank.THREE_SEVENS, value: 34, description: 'Three 7s', cards: [] });

      const winners = service.determineWinner(hands);

      expect(winners).toEqual(['player4']); // Three 7s (34 points) wins!
    });
  });

  // ==================== COMPARISON TESTS ====================

  describe('Hand Comparison', () => {
    it('should correctly compare hands by point value', () => {
      const hand1 = { rank: HandRank.THREE_SEVENS, value: 34, description: '', cards: [] };
      const hand2 = { rank: HandRank.THREE_OF_A_KIND, value: 33, description: '', cards: [] };

      expect(service.compareHands(hand1, hand2)).toBeGreaterThan(0); // hand1 wins
      expect(service.compareHands(hand2, hand1)).toBeLessThan(0); // hand2 loses
    });

    it('should return 0 for equal hands', () => {
      const hand1 = { rank: HandRank.FLUSH, value: 30, description: '', cards: [] };
      const hand2 = { rank: HandRank.THREE_OF_A_KIND, value: 30, description: '', cards: [] };

      expect(service.compareHands(hand1, hand2)).toBe(0); // Tie
    });
  });
});

