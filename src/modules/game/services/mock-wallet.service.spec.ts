import { Test, TestingModule } from '@nestjs/testing';
import { MockWalletService } from './mock-wallet.service';
import { InsufficientBalanceException, WalletTransactionType } from '../interfaces/wallet.interface';

describe('MockWalletService - Balance Validation', () => {
  let service: MockWalletService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MockWalletService],
    }).compile();

    service = module.get<MockWalletService>(MockWalletService);
  });

  describe('Balance Limits', () => {
    it('should initialize players with 10,000', async () => {
      const balance1 = await service.getBalance('player1');
      const balance2 = await service.getBalance('player2');
      const balance3 = await service.getBalance('player3');

      expect(balance1).toBe(10000);
      expect(balance2).toBe(10000);
      expect(balance3).toBe(10000);
    });

    it('should prevent betting more than balance', async () => {
      const userId = 'player1';
      
      await expect(
        service.deductBalance(userId, 15000, {
          type: WalletTransactionType.GAME_BET,
          gameId: 'game-1',
          description: 'Test bet',
        })
      ).rejects.toThrow(InsufficientBalanceException);
    });

    it('should properly deduct balance after bet', async () => {
      const userId = 'player1';
      
      // Initial balance
      const initialBalance = await service.getBalance(userId);
      expect(initialBalance).toBe(10000);

      // Deduct 500
      await service.deductBalance(userId, 500, {
        type: WalletTransactionType.GAME_BET,
        gameId: 'game-1',
        description: 'Bet 500',
      });

      // New balance should be 9500
      const newBalance = await service.getBalance(userId);
      expect(newBalance).toBe(9500);
    });

    it('should track multiple deductions correctly', async () => {
      const userId = 'player1';
      
      // Bet 1: 1000
      await service.deductBalance(userId, 1000, {
        type: WalletTransactionType.GAME_BET,
        gameId: 'game-1',
        description: 'Bet 1000',
      });
      expect(await service.getBalance(userId)).toBe(9000);

      // Bet 2: 2000
      await service.deductBalance(userId, 2000, {
        type: WalletTransactionType.GAME_RAISE,
        gameId: 'game-1',
        description: 'Raise 2000',
      });
      expect(await service.getBalance(userId)).toBe(7000);

      // Bet 3: 7000 (ALL-IN)
      await service.deductBalance(userId, 7000, {
        type: WalletTransactionType.GAME_ALL_IN,
        gameId: 'game-1',
        description: 'All-in 7000',
      });
      expect(await service.getBalance(userId)).toBe(0);
    });

    it('should prevent any action when balance is 0', async () => {
      const userId = 'player1';
      
      // Deduct all balance
      await service.deductBalance(userId, 10000, {
        type: WalletTransactionType.GAME_ALL_IN,
        gameId: 'game-1',
        description: 'All-in',
      });

      // Try to bet again
      await expect(
        service.deductBalance(userId, 1, {
          type: WalletTransactionType.GAME_BET,
          gameId: 'game-1',
          description: 'Impossible bet',
        })
      ).rejects.toThrow(InsufficientBalanceException);
    });

    it('should calculate correct maximum pot for 3 players', async () => {
      // 3 players with 10,000 each = maximum pot of 30,000
      const player1Balance = await service.getBalance('player1');
      const player2Balance = await service.getBalance('player2');
      const player3Balance = await service.getBalance('player3');

      const maxPot = player1Balance + player2Balance + player3Balance;
      expect(maxPot).toBe(30000);
    });
  });

  describe('Add Balance (Winnings)', () => {
    it('should add winnings to player balance', async () => {
      const userId = 'player1';
      
      // Player bets 1000
      await service.deductBalance(userId, 1000, {
        type: WalletTransactionType.GAME_BET,
        gameId: 'game-1',
        description: 'Bet 1000',
      });
      expect(await service.getBalance(userId)).toBe(9000);

      // Player wins 5000
      await service.addBalance(userId, 5000, {
        type: WalletTransactionType.GAME_WINNINGS,
        gameId: 'game-1',
        description: 'Won pot',
      });
      expect(await service.getBalance(userId)).toBe(14000);
    });
  });

  describe('Sufficient Balance Check', () => {
    it('should return true when player has enough balance', async () => {
      const userId = 'player1';
      const hasSufficient = await service.hasSufficientBalance(userId, 5000);
      expect(hasSufficient).toBe(true);
    });

    it('should return false when player does not have enough balance', async () => {
      const userId = 'player1';
      const hasSufficient = await service.hasSufficientBalance(userId, 15000);
      expect(hasSufficient).toBe(false);
    });
  });
});

