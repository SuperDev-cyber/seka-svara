import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { PlatformScoreTransaction, ScoreTransactionType } from '../entities/platform-score-transaction.entity';

/**
 * Platform Balance Service
 * 
 * Manages the SEKA-SVARA-SCORE (platformScore) - a virtual currency used for:
 * - All in-game betting and winnings
 * - Deposits (credited when user sends real funds to admin wallet)
 * - Withdrawals (deducted when admin sends funds to user wallet)
 * 
 * NO BLOCKCHAIN TRANSACTIONS during gameplay - all operations are database-only
 */
@Injectable()
export class PlatformBalanceService {
  private readonly logger = new Logger(PlatformBalanceService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(PlatformScoreTransaction)
    private scoreTransactionsRepository: Repository<PlatformScoreTransaction>,
  ) {}

  /**
   * Get user's platform score (virtual balance)
   */
  async getBalance(userId: string): Promise<number> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException(`User ${userId} not found`);
    }
    // ✅ Ensure we return a proper integer value (not scaled decimal)
    const balance = Math.round(Number(user.platformScore));
    return balance;
  }

  /**
   * Deduct balance for game bet (DATABASE ONLY - no blockchain)
   */
  async deductBalance(
    userId: string,
    amount: number,
    metadata?: {
      type: string;
      gameId?: string;
      description?: string;
    },
  ): Promise<number> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException(`User ${userId} not found`);
    }

    const currentBalance = Number(user.platformScore);
    
    if (currentBalance < amount) {
      throw new BadRequestException(
        `Insufficient balance. Current: ${currentBalance}, Required: ${amount}`
      );
    }

    const newBalance = currentBalance - amount;
    user.platformScore = newBalance;
    await this.usersRepository.save(user);

    // Record transaction
    await this.scoreTransactionsRepository.save({
      userId,
      amount: -amount,
      type: ScoreTransactionType.SPENT,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      description: metadata?.description || `Game bet: ${amount}`,
      referenceId: metadata?.gameId,
      referenceType: metadata?.type || 'game_bet',
    });

    this.logger.log(
      `💰 Deducted ${amount} from user ${user.email}. Balance: ${currentBalance} → ${newBalance}`
    );

    return newBalance;
  }

  /**
   * Add balance for game win (DATABASE ONLY - no blockchain)
   */
  async addBalance(
    userId: string,
    amount: number,
    metadata?: {
      type: string;
      gameId?: string;
      description?: string;
    },
  ): Promise<number> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException(`User ${userId} not found`);
    }

    const currentBalance = Math.round(Number(user.platformScore)); // ✅ Round current balance
    const amountToAdd = Math.round(Number(amount)); // ✅ Ensure amount is integer
    const newBalance = currentBalance + amountToAdd; // ✅ Result is guaranteed integer
    
    user.platformScore = newBalance;
    await this.usersRepository.save(user);

    this.logger.log(`💰 Adding balance to ${user.email}:`);
    this.logger.log(`   Before: ${currentBalance} SEKA`);
    this.logger.log(`   Adding: ${amountToAdd} SEKA`);
    this.logger.log(`   After: ${newBalance} SEKA`);

    // Record transaction
    await this.scoreTransactionsRepository.save({
      userId,
      amount: amountToAdd, // ✅ Use rounded amount
      type: ScoreTransactionType.EARNED,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      description: metadata?.description || `Game winnings: ${amountToAdd}`,
      referenceId: metadata?.gameId,
      referenceType: metadata?.type || 'game_win',
    });

    this.logger.log(`✅ Successfully added ${amountToAdd} SEKA to ${user.email}`);

    return newBalance;
  }

  /**
   * Check if user has sufficient balance
   */
  async hasBalance(userId: string, amount: number): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance >= amount;
  }

  /**
   * Get balance with detailed info
   */
  async getDetailedBalance(userId: string): Promise<{
    balance: number;
    totalEarned: number;
    totalSpent: number;
    totalGamesPlayed: number;
  }> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException(`User ${userId} not found`);
    }

    // Get transaction stats
    const earnedResult = await this.scoreTransactionsRepository
      .createQueryBuilder('tx')
      .select('SUM(tx.amount)', 'total')
      .where('tx.userId = :userId', { userId })
      .andWhere('tx.type IN (:...types)', { types: [ScoreTransactionType.EARNED, ScoreTransactionType.BONUS] })
      .getRawOne();

    const spentResult = await this.scoreTransactionsRepository
      .createQueryBuilder('tx')
      .select('SUM(ABS(tx.amount))', 'total')
      .where('tx.userId = :userId', { userId })
      .andWhere('tx.type = :type', { type: ScoreTransactionType.SPENT })
      .getRawOne();

    return {
      balance: Number(user.platformScore),
      totalEarned: Number(earnedResult?.total || 0),
      totalSpent: Number(spentResult?.total || 0),
      totalGamesPlayed: user.totalGamesPlayed || 0,
    };
  }
}

