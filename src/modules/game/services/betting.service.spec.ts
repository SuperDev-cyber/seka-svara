import { Test, TestingModule } from '@nestjs/testing';
import { BettingService } from './betting.service';
import { Game } from '../entities/game.entity';
import { GamePlayer } from '../entities/game-player.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BettingAction } from '../types/betting.types';
import { GamePhase, GameStatus } from '../types/game-state.types';
import { BadRequestException } from '@nestjs/common';

describe('BettingService', () => {
  let service: BettingService;
  let gamesRepository: Repository<Game>;
  let gamePlayersRepository: Repository<GamePlayer>;

  const mockGamesRepository = {
    save: jest.fn(),
  };

  const mockGamePlayersRepository = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BettingService,
        {
          provide: getRepositoryToken(Game),
          useValue: mockGamesRepository,
        },
        {
          provide: getRepositoryToken(GamePlayer),
          useValue: mockGamePlayersRepository,
        },
      ],
    }).compile();

    service = module.get<BettingService>(BettingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processBet - BET action', () => {
    it('should process BET action successfully', async () => {
      const mockGame = createMockGame('player1', 0, 30);
      const player = mockGame.players[0];

      await service.processBet(mockGame, 'player1', BettingAction.BET, 50);

      expect(player.currentBet).toBe(50);
      expect(player.totalBet).toBe(50);
      expect(mockGame.state.pot).toBe(80); // 30 + 50
      expect(mockGame.state.currentBet).toBe(50);
    });

    it('should fail if amount is zero or negative', async () => {
      const mockGame = createMockGame('player1', 0, 30);

      await expect(
        service.processBet(mockGame, 'player1', BettingAction.BET, 0),
      ).rejects.toThrow(BadRequestException);
    });

    it('should fail if not player\'s turn', async () => {
      const mockGame = createMockGame('player2', 0, 30);

      await expect(
        service.processBet(mockGame, 'player1', BettingAction.BET, 50),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('processBet - RAISE action', () => {
    it('should process RAISE action successfully', async () => {
      const mockGame = createMockGame('player2', 50, 100);
      mockGame.players[1].currentBet = 50;
      const player = mockGame.players[1];

      await service.processBet(mockGame, 'player2', BettingAction.RAISE, 100);

      expect(player.currentBet).toBe(100);
      expect(mockGame.state.pot).toBe(150); // 100 + (100-50)
      expect(mockGame.state.currentBet).toBe(100);
    });

    it('should reset hasActed for other players after raise', async () => {
      const mockGame = createMockGame('player2', 50, 100);
      mockGame.players[0].hasActed = true;
      mockGame.players[1].currentBet = 50;

      await service.processBet(mockGame, 'player2', BettingAction.RAISE, 100);

      expect(mockGame.players[0].hasActed).toBe(false);
      expect(mockGame.players[2].hasActed).toBe(false);
    });
  });

  describe('processBet - CALL action', () => {
    it('should process CALL action successfully', async () => {
      const mockGame = createMockGame('player2', 50, 100);
      mockGame.players[1].currentBet = 25;
      const player = mockGame.players[1];

      await service.processBet(mockGame, 'player2', BettingAction.CALL);

      expect(player.currentBet).toBe(50); // Matches current bet
      expect(mockGame.state.pot).toBe(125); // 100 + 25
    });

    it('should fail if nothing to call', async () => {
      const mockGame = createMockGame('player1', 0, 30);

      await expect(
        service.processBet(mockGame, 'player1', BettingAction.CALL),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('processBet - FOLD action', () => {
    it('should process FOLD action successfully', async () => {
      const mockGame = createMockGame('player1', 50, 150);
      const player = mockGame.players[0];

      await service.processBet(mockGame, 'player1', BettingAction.FOLD);

      expect(player.folded).toBe(true);
      expect(player.isActive).toBe(false);
    });

    it('should end game if only one player remains after fold', async () => {
      const mockGame = createMockGame('player1', 50, 150);
      // Fold player 2 first
      mockGame.players[1].folded = true;
      mockGame.players[1].isActive = false;

      await service.processBet(mockGame, 'player1', BettingAction.FOLD);

      // Only player 3 remains
      expect(mockGame.state.phase).toBe(GamePhase.SHOWDOWN);
      expect(mockGame.state.winners).toEqual(['player3']);
      expect(mockGame.status).toBe(GameStatus.COMPLETED);
    });
  });

  describe('processBet - CHECK action', () => {
    it('should process CHECK action when no bet to match', async () => {
      const mockGame = createMockGame('player1', 0, 30);

      await service.processBet(mockGame, 'player1', BettingAction.CHECK);

      // Nothing changes, just logged
      expect(mockGame.state.bettingHistory).toHaveLength(1);
      expect(mockGame.state.bettingHistory[0].action).toBe(BettingAction.CHECK);
    });

    it('should fail CHECK if there is a bet to match', async () => {
      const mockGame = createMockGame('player2', 50, 100);

      await expect(
        service.processBet(mockGame, 'player2', BettingAction.CHECK),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('processBet - ALL_IN action', () => {
    it('should process ALL_IN action', async () => {
      const mockGame = createMockGame('player1', 50, 100);
      const player = mockGame.players[0];

      await service.processBet(mockGame, 'player1', BettingAction.ALL_IN);

      expect(player.allIn).toBe(true);
      expect(mockGame.state.pot).toBeGreaterThan(100);
    });
  });

  describe('calculateSidePots', () => {
    it('should calculate side pots correctly for all-in scenario', () => {
      const mockGame = createMockGame('player1', 0, 0);
      
      // Player 1: all-in with 50
      mockGame.players[0].totalBet = 50;
      mockGame.players[0].allIn = true;
      
      // Player 2: bet 100
      mockGame.players[1].totalBet = 100;
      
      // Player 3: bet 100
      mockGame.players[2].totalBet = 100;

      const sidePots = service.calculateSidePots(mockGame);

      expect(sidePots).toHaveLength(2);
      // First pot: 50 * 3 = 150 (all 3 players eligible)
      expect(sidePots[0].amount).toBe(150);
      expect(sidePots[0].eligiblePlayers).toHaveLength(3);
      
      // Second pot: 50 * 2 = 100 (only players 2 and 3 eligible)
      expect(sidePots[1].amount).toBe(100);
      expect(sidePots[1].eligiblePlayers).toHaveLength(2);
    });

    it('should handle no side pots when all bets equal', () => {
      const mockGame = createMockGame('player1', 50, 150);
      mockGame.players[0].totalBet = 50;
      mockGame.players[1].totalBet = 50;
      mockGame.players[2].totalBet = 50;

      const sidePots = service.calculateSidePots(mockGame);

      expect(sidePots).toHaveLength(1);
      expect(sidePots[0].amount).toBe(150);
      expect(sidePots[0].eligiblePlayers).toHaveLength(3);
    });
  });

  describe('isBettingRoundComplete', () => {
    it('should return true when all players have acted and matched bet', () => {
      const mockGame = createMockGame('player1', 50, 150);
      mockGame.players[0].hasActed = true;
      mockGame.players[0].currentBet = 50;
      mockGame.players[1].hasActed = true;
      mockGame.players[1].currentBet = 50;
      mockGame.players[2].hasActed = true;
      mockGame.players[2].currentBet = 50;

      const result = service['isBettingRoundComplete'](mockGame);

      expect(result).toBe(true);
    });

    it('should return false when not all players have acted', () => {
      const mockGame = createMockGame('player1', 50, 150);
      mockGame.players[0].hasActed = true;
      mockGame.players[1].hasActed = false; // Not acted yet
      mockGame.players[2].hasActed = true;

      const result = service['isBettingRoundComplete'](mockGame);

      expect(result).toBe(false);
    });

    it('should return true when only one active player remains', () => {
      const mockGame = createMockGame('player1', 50, 150);
      mockGame.players[1].folded = true;
      mockGame.players[2].folded = true;

      const result = service['isBettingRoundComplete'](mockGame);

      expect(result).toBe(true);
    });
  });
});

// Helper function to create mock game
function createMockGame(
  currentPlayerId: string,
  currentBet: number,
  pot: number,
): Game {
  const game = {
    id: 'test-game',
    status: GameStatus.IN_PROGRESS,
    state: {
      phase: GamePhase.BETTING,
      bettingRound: 1,
      currentPlayerId,
      pot,
      currentBet,
      bettingHistory: [],
      winners: [],
      startedAt: new Date(),
    },
    players: [
      {
        userId: 'player1',
        position: 0,
        currentBet: 0,
        totalBet: 0,
        isActive: true,
        folded: false,
        allIn: false,
        hasActed: false,
      },
      {
        userId: 'player2',
        position: 1,
        currentBet: 0,
        totalBet: 0,
        isActive: true,
        folded: false,
        allIn: false,
        hasActed: false,
      },
      {
        userId: 'player3',
        position: 2,
        currentBet: 0,
        totalBet: 0,
        isActive: true,
        folded: false,
        allIn: false,
        hasActed: false,
      },
    ],
  } as any;

  return game;
}

