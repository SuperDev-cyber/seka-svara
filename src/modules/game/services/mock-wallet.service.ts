import { Injectable, Logger } from '@nestjs/common';
import {
  IWalletService,
  WalletTransactionMetadata,
  WalletTransactionResult,
  WalletLockResult,
  InsufficientBalanceException,
} from '../interfaces/wallet.interface';

/**
 * Mock Wallet Service for Frontend Testing
 * 
 * This is a temporary mock service that simulates wallet operations
 * without requiring Developer 3's actual wallet service.
 * 
 * Replace this with the real wallet service when ready!
 */
@Injectable()
export class MockWalletService implements IWalletService {
  private readonly logger = new Logger('MockWalletService');
  
  // In-memory balance storage for testing
  private balances = new Map<string, number>();
  
  // In-memory locks for testing
  private locks = new Map<string, { userId: string; amount: number; gameId: string }>();

  constructor() {
    // Initialize some test users with balances
    this.balances.set('player1', 10000);
    this.balances.set('player2', 10000);
    this.balances.set('player3', 10000);
    this.balances.set('player4', 10000);
    this.balances.set('player5', 10000);
    
    this.logger.warn('⚠️  USING MOCK WALLET SERVICE - Replace with real service!');
  }

  async deductBalance(
    userId: string,
    amount: number,
    metadata: WalletTransactionMetadata,
  ): Promise<WalletTransactionResult> {
    const currentBalance = this.balances.get(userId) || 0;

    if (currentBalance < amount) {
      this.logger.error(`❌ INSUFFICIENT BALANCE: ${userId} has ${currentBalance} but tried to deduct ${amount}`);
      throw new InsufficientBalanceException(userId, amount, currentBalance);
    }

    const newBalance = currentBalance - amount;
    this.balances.set(userId, newBalance);

    this.logger.log(`💰 Deducted ${amount} from ${userId}. New balance: ${newBalance} (Type: ${metadata.type})`);

    return {
      success: true,
      transactionId: `tx-${Date.now()}-${Math.random()}`,
      userId,
      amount,
      newBalance,
      timestamp: new Date(),
      metadata,
    };
  }

  async addBalance(
    userId: string,
    amount: number,
    metadata: WalletTransactionMetadata,
  ): Promise<WalletTransactionResult> {
    const currentBalance = this.balances.get(userId) || 0;
    const newBalance = currentBalance + amount;
    this.balances.set(userId, newBalance);

    this.logger.log(`💰 Added ${amount} to ${userId}. New balance: ${newBalance}`);

    return {
      success: true,
      transactionId: `tx-${Date.now()}-${Math.random()}`,
      userId,
      amount,
      newBalance,
      timestamp: new Date(),
      metadata,
    };
  }

  async getBalance(userId: string): Promise<number> {
    // Auto-create balance for new users
    if (!this.balances.has(userId)) {
      this.balances.set(userId, 10000); // Give new users 10,000 starting balance
      this.logger.log(`🆕 New user ${userId} initialized with balance: 10000`);
      return 10000;
    }
    
    const balance = this.balances.get(userId) || 0;
    return balance;
  }

  async hasSufficientBalance(userId: string, amount: number): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance >= amount;
  }

  async lockFunds(
    userId: string,
    amount: number,
    gameId: string,
  ): Promise<WalletLockResult> {
    const balance = await this.getBalance(userId);

    if (balance < amount) {
      throw new InsufficientBalanceException(userId, amount, balance);
    }

    const lockId = `lock-${Date.now()}-${Math.random()}`;
    this.locks.set(lockId, { userId, amount, gameId });

    this.logger.log(`🔒 Locked ${amount} for ${userId} in game ${gameId}`);

    return {
      success: true,
      lockId,
      userId,
      amount,
      gameId,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    };
  }

  async releaseFunds(userId: string, lockId: string): Promise<void> {
    const lock = this.locks.get(lockId);
    
    if (lock && lock.userId === userId) {
      this.locks.delete(lockId);
      this.logger.log(`🔓 Released lock ${lockId} for ${userId}`);
    }
  }

  async deductLockedFunds(
    userId: string,
    lockId: string,
    metadata: WalletTransactionMetadata,
  ): Promise<WalletTransactionResult> {
    const lock = this.locks.get(lockId);

    if (!lock || lock.userId !== userId) {
      throw new Error(`Lock ${lockId} not found for user ${userId}`);
    }

    // Delete the lock
    this.locks.delete(lockId);

    // Deduct the locked amount
    return this.deductBalance(userId, lock.amount, metadata);
  }

  /**
   * Helper method to reset balances (for testing)
   */
  resetBalances(): void {
    this.balances.clear();
    this.locks.clear();
    
    // Reinitialize test users
    this.balances.set('player1', 10000);
    this.balances.set('player2', 10000);
    this.balances.set('player3', 10000);
    this.balances.set('player4', 10000);
    this.balances.set('player5', 10000);
    
    this.logger.log('♻️  Reset all balances');
  }

  /**
   * Helper method to add test user (for testing)
   */
  addTestUser(userId: string, initialBalance: number = 10000): void {
    this.balances.set(userId, initialBalance);
    this.logger.log(`➕ Added test user ${userId} with balance ${initialBalance}`);
  }

  /**
   * Helper method to get all balances (for debugging)
   */
  getAllBalances(): Map<string, number> {
    return new Map(this.balances);
  }
}

