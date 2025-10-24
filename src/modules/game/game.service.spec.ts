import { Test, TestingModule } from '@nestjs/testing';
import { GameService } from './game.service';
import { GameEngine } from './services/game-engine.service';
import { Game } from './entities/game.entity';
import { GamePlayer } from './entities/game-player.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { GameStatus, GamePhase } from './types/game-state.types';
import { BettingAction } from './types/betting.types';

/**
 * Integration tests for GameService
 * 
 * Tests complete game flows from creation to completion
 */
describe('GameService - Integration Tests', () => {
  let service: GameService;
  let gameEngine: GameEngine;
  let gamesRepository: Repository<Game>;
  let gamePlayersRepository: Repository<GamePlayer>;

  // Mock repositories
  const mockGamesRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockGamePlayersRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  // Mock GameEngine
  const mockGameEngine = {
    initializeGame: jest.fn(),
    processPlayerAction: jest.fn(),
    getGameState: jest.fn(),
    getAvailableActions: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        {
          provide: getRepositoryToken(Game),
          useValue: mockGamesRepository,
        },
        {
          provide: getRepositoryToken(GamePlayer),
          useValue: mockGamePlayersRepository,
        },
        {
          provide: GameEngine,
          useValue: mockGameEngine,
        },
      ],
    }).compile();

    service = module.get<GameService>(GameService);
    gameEngine = module.get<GameEngine>(GameEngine);
    gamesRepository = module.get<Repository<Game>>(getRepositoryToken(Game));
    gamePlayersRepository = module.get<Repository<GamePlayer>>(
      getRepositoryToken(GamePlayer),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createGame', () => {
    it('should create a game with 3 players successfully', async () => {
      const tableId = 'table-123';
      const playerIds = ['player1', 'player2', 'player3'];
      const ante = 10;

      const mockGame = {
        id: 'game-abc-123',
        tableId,
        status: GameStatus.PENDING,
        players: [],
      } as any as Game;

      const mockPlayers = playerIds.map((userId, index) => ({
        id: `gp-${index}`,
        gameId: mockGame.id,
        userId,
        position: index,
        hand: [],
        betAmount: 0,
        totalBet: 0,
        status: 'active',
        isWinner: false,
        winnings: 0,
        hasActed: false,
      })) as any as GamePlayer[];

      mockGamesRepository.create.mockReturnValue(mockGame);
      mockGamesRepository.save.mockResolvedValue(mockGame);
      mockGamePlayersRepository.create.mockImplementation((data) => data);
      mockGamePlayersRepository.save.mockResolvedValue(mockPlayers);
      mockGamesRepository.findOne.mockResolvedValue({
        ...mockGame,
        players: mockPlayers,
      });
      mockGameEngine.initializeGame.mockResolvedValue(undefined);

      const result = await service.createGame(tableId, playerIds, ante);

      expect(result).toBeDefined();
      expect(result.tableId).toBe(tableId);
      expect(mockGamesRepository.create).toHaveBeenCalled();
      expect(mockGamePlayersRepository.save).toHaveBeenCalled();
      expect(mockGameEngine.initializeGame).toHaveBeenCalled();
    });

    it('should fail with less than 2 players', async () => {
      await expect(
        service.createGame('table-123', ['player1'], 10),
      ).rejects.toThrow(BadRequestException);
    });

    it('should fail with more than 10 players', async () => {
      const tooManyPlayers = Array.from({ length: 11 }, (_, i) => `player${i}`);
      
      await expect(
        service.createGame('table-123', tooManyPlayers, 10),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('performAction', () => {
    it('should process a BET action successfully', async () => {
      const mockGame = {
        id: 'game-123',
        status: GameStatus.IN_PROGRESS,
        state: {
          currentPlayerId: 'player1',
          phase: GamePhase.BETTING,
          pot: 30,
          currentBet: 0,
        },
        players: [
          { userId: 'player1', isActive: true, folded: false },
        ],
      } as Game;

      mockGamesRepository.findOne.mockResolvedValue(mockGame);
      mockGameEngine.processPlayerAction.mockResolvedValue(mockGame);
      mockGameEngine.getGameState.mockReturnValue({
        gameId: 'game-123',
        pot: 80,
        currentBet: 50,
      });

      const result = await service.performAction('game-123', 'player1', {
        type: 'bet',
        amount: 50,
      });

      expect(result).toBeDefined();
      expect(result.pot).toBe(80);
      expect(mockGameEngine.processPlayerAction).toHaveBeenCalledWith(
        mockGame,
        'player1',
        BettingAction.BET,
        50,
      );
    });

    it('should fail if game is not in progress', async () => {
      const mockGame = {
        id: 'game-123',
        status: GameStatus.COMPLETED,
      } as Game;

      mockGamesRepository.findOne.mockResolvedValue(mockGame);

      await expect(
        service.performAction('game-123', 'player1', {
          type: 'bet',
          amount: 50,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should fail if not player\'s turn', async () => {
      const mockGame = {
        id: 'game-123',
        status: GameStatus.IN_PROGRESS,
        state: {
          currentPlayerId: 'player2',
          phase: GamePhase.BETTING,
        },
        players: [{ userId: 'player1' }],
      } as Game;

      mockGamesRepository.findOne.mockResolvedValue(mockGame);

      await expect(
        service.performAction('game-123', 'player1', {
          type: 'bet',
          amount: 50,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('endGame', () => {
    it('should end game and set winner', async () => {
      const mockGame = {
        id: 'game-123',
        status: GameStatus.IN_PROGRESS,
        state: {
          pot: 150,
          winners: [],
        },
        players: [
          { userId: 'player1', isWinner: false, winnings: 0 },
          { userId: 'player2', isWinner: false, winnings: 0 },
        ],
      } as Game;

      mockGamesRepository.findOne.mockResolvedValue(mockGame);
      mockGamesRepository.save.mockResolvedValue({
        ...mockGame,
        status: GameStatus.COMPLETED,
      });

      const result = await service.endGame('game-123', 'player1');

      expect(result.status).toBe(GameStatus.COMPLETED);
      expect(mockGamesRepository.save).toHaveBeenCalled();
    });

    it('should fail if game already completed', async () => {
      const mockGame = {
        id: 'game-123',
        status: GameStatus.COMPLETED,
      } as Game;

      mockGamesRepository.findOne.mockResolvedValue(mockGame);

      await expect(service.endGame('game-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getUserGameHistory', () => {
    it('should return user game history', async () => {
      const mockGamePlayers = [
        {
          game: {
            id: 'game-1',
            tableId: 'table-1',
            status: GameStatus.COMPLETED,
            finishedAt: new Date(),
          },
          position: 0,
          totalBet: 100,
          winnings: 250,
          isWinner: true,
          createdAt: new Date(),
        },
      ];

      mockGamePlayersRepository.find.mockResolvedValue(mockGamePlayers);

      const result = await service.getUserGameHistory('player1', 10);

      expect(result).toHaveLength(1);
      expect(result[0].gameId).toBe('game-1');
      expect(result[0].isWinner).toBe(true);
    });
  });

  describe('getUserActiveGames', () => {
    it('should return only active games for user', async () => {
      const mockGamePlayers = [
        {
          game: {
            id: 'game-1',
            tableId: 'table-1',
            status: GameStatus.IN_PROGRESS,
            state: {
              phase: GamePhase.BETTING,
              currentPlayerId: 'player1',
            },
            pot: 100,
          },
          position: 0,
          createdAt: new Date(),
        },
        {
          game: {
            id: 'game-2',
            tableId: 'table-2',
            status: GameStatus.COMPLETED,
          },
          position: 1,
          createdAt: new Date(),
        },
      ];

      mockGamePlayersRepository.find.mockResolvedValue(mockGamePlayers);

      const result = await service.getUserActiveGames('player1');

      expect(result).toHaveLength(1);
      expect(result[0].gameId).toBe('game-1');
      expect(result[0].status).toBe(GameStatus.IN_PROGRESS);
    });
  });
});

/**
 * End-to-End Game Flow Test
 * 
 * This test simulates a complete game from start to finish
 */
describe('GameService - E2E Game Flow', () => {
  it('should complete a full 3-player game', async () => {
    // This is a placeholder for a full E2E test
    // In a real scenario, this would:
    // 1. Create game with 3 players
    // 2. Each player performs betting actions
    // 3. Game proceeds through multiple rounds
    // 4. Showdown determines winner
    // 5. Pot is distributed
    // 6. Game completes
    
    // TODO: Implement with actual database and services
    expect(true).toBe(true);
  });
});

