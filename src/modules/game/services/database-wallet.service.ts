import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import {
  IWalletService,
  WalletTransactionMetadata,
  WalletTransactionResult,
  WalletLockResult,
  InsufficientBalanceException,
} from '../interfaces/wallet.interface';

/**
 * Database Wallet Service
 * 
 * This service uses the user's virtual balance from the database (user.balance field).
 * Users deposit real USDT to admin wallet, receive virtual balance, and play games with it.
 * 
 * This REPLACES the mock wallet service for production use.
 */
@Injectable()
export class DatabaseWalletService implements IWalletService {
  private readonly logger = new Logger(DatabaseWalletService.name);
  
  // In-memory locks for fund locking during games
  private locks = new Map<string, { userId: string; amount: number; gameId: string }>();

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {
    this.logger.log('✅ Database Wallet Service initialized - using user.balance from DB');
  }

  async deductBalance(
    userId: string,
    amount: number,
    metadata: WalletTransactionMetadata,
  ): Promise<WalletTransactionResult> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const currentBalance = Number(user.balance);

    if (currentBalance < amount) {
      this.logger.error(`❌ INSUFFICIENT BALANCE: ${user.email} has ${currentBalance} but tried to deduct ${amount}`);
      throw new InsufficientBalanceException(userId, amount, currentBalance);
    }

    const newBalance = currentBalance - amount;
    user.balance = newBalance;
    await this.usersRepository.save(user);

    this.logger.log(`💰 Deducted ${amount} USDT from ${user.email}. New balance: ${newBalance} USDT (Type: ${metadata.type})`);

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
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const currentBalance = Number(user.balance);
    const newBalance = currentBalance + amount;
    user.balance = newBalance;
    await this.usersRepository.save(user);

    this.logger.log(`💰 Added ${amount} USDT to ${user.email}. New balance: ${newBalance} USDT (Type: ${metadata.type})`);

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
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      this.logger.warn(`⚠️ User ${userId} not found, returning balance 0`);
      return 0;
    }
    
    const balance = Number(user.balance) || 0;
    this.logger.debug(`💳 User ${user.email} balance: ${balance} USDT`);
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

    this.logger.log(`🔒 Locked ${amount} USDT for user ${userId} in game ${gameId}`);

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
      this.logger.log(`🔓 Released lock ${lockId} for user ${userId}`);
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

    // Deduct the locked amount from database balance
    return this.deductBalance(userId, lock.amount, metadata);
  }
}

