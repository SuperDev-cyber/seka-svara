import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { PlatformScoreTransaction, ScoreTransactionType } from '../entities/platform-score-transaction.entity';

@Injectable()
export class PlatformScoreService {
  private readonly logger = new Logger(PlatformScoreService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(PlatformScoreTransaction)
    private scoreTransactionsRepository: Repository<PlatformScoreTransaction>,
  ) {}

  /**
   * Add score to a user's Seka-Svara Score
   */
  async addScore(
    userId: string,
    amount: number,
    type: ScoreTransactionType,
    description: string,
    referenceId?: string,
    referenceType?: string,
  ): Promise<PlatformScoreTransaction> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // ✅ Ensure numeric math (avoid string concatenation like "2019" + 1 = "20191")
    // ✅ Convert all values to numbers explicitly to avoid BigInt mixing issues
    const numericAmount = typeof amount === 'bigint' 
      ? Number(amount) 
      : parseFloat(amount?.toString() || '0');
    const balanceBefore = typeof user.platformScore === 'bigint'
      ? Number(user.platformScore)
      : parseFloat(user.platformScore?.toString() || '0');
    
    // ✅ Ensure arithmetic result is a number, not BigInt
    const balanceAfterNum = balanceBefore + numericAmount;
    const balanceAfter = typeof balanceAfterNum === 'bigint' ? Number(balanceAfterNum) : balanceAfterNum;

    // Update user's Seka-Svara Score - ensure it's a number
    await this.usersRepository.update(userId, {
      platformScore: Number(balanceAfter),
    });

    // Create transaction record
    const transaction = this.scoreTransactionsRepository.create({
      userId,
      amount: numericAmount,
      balanceBefore,
      balanceAfter,
      type,
      description,
      referenceId,
      referenceType,
    });

    return this.scoreTransactionsRepository.save(transaction);
  }

  /**
   * Deduct score from a user's Seka-Svara Score
   */
  async deductScore(
    userId: string,
    amount: number,
    description: string,
    referenceId?: string,
    referenceType?: string,
  ): Promise<PlatformScoreTransaction> {
    return this.addScore(
      userId,
      -Math.abs(amount), // Ensure it's negative
      ScoreTransactionType.SPENT,
      description,
      referenceId,
      referenceType,
    );
  }

  /**
   * Get user's current Seka-Svara Score
   */
  async getUserScore(userId: string): Promise<number> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.platformScore || 0;
  }

  /**
   * Get user's score transaction history
   */
  async getUserScoreHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ transactions: PlatformScoreTransaction[]; total: number }> {
    const [transactions, total] = await this.scoreTransactionsRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { transactions, total };
  }

  /**
   * Get all Seka-Svara Score transactions (for admin)
   */
  async getAllScoreTransactions(
    limit: number = 100,
    offset: number = 0,
  ): Promise<{ transactions: any[]; total: number }> {
    const [transactions, total] = await this.scoreTransactionsRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.user', 'user')
      .orderBy('transaction.createdAt', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    // Format for frontend
    const formattedTransactions = transactions.map(t => ({
      id: t.id,
      userId: t.userId,
      username: t.user?.username || 'Unknown',
      email: t.user?.email || 'Unknown',
      amount: parseFloat(t.amount.toString()),
      balanceBefore: parseFloat(t.balanceBefore.toString()),
      balanceAfter: parseFloat(t.balanceAfter.toString()),
      type: t.type,
      description: t.description,
      referenceId: t.referenceId,
      referenceType: t.referenceType,
      createdAt: t.createdAt,
    }));

    return { transactions: formattedTransactions, total };
  }

  /**
   * Get Seka-Svara Score statistics
   */
  async getScoreStatistics() {
    const totalUsers = await this.usersRepository.count();
    
    const totalScoreResult = await this.usersRepository
      .createQueryBuilder('user')
      .select('SUM(user.platformScore)', 'total')
      .getRawOne();

    const totalScoreEarned = await this.scoreTransactionsRepository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'total')
      .where('transaction.type IN (:...types)', { 
        types: [ScoreTransactionType.EARNED, ScoreTransactionType.BONUS] 
      })
      .getRawOne();

    const totalScoreSpent = await this.scoreTransactionsRepository
      .createQueryBuilder('transaction')
      .select('SUM(ABS(transaction.amount))', 'total')
      .where('transaction.type = :type', { type: ScoreTransactionType.SPENT })
      .getRawOne();

    return {
      totalUsers,
      totalScore: parseFloat(totalScoreResult?.total || 0),
      totalScoreEarned: parseFloat(totalScoreEarned?.total || 0),
      totalScoreSpent: parseFloat(totalScoreSpent?.total || 0),
      totalTransactions: await this.scoreTransactionsRepository.count(),
    };
  }

  /**
   * Update a Seka-Svara Score transaction
   */
  async updateScoreTransaction(
    id: string,
    updateData: { amount?: number; type?: string; description?: string },
  ) {
    const transaction = await this.scoreTransactionsRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    const oldAmount = Number(transaction.amount);
    const oldBalanceAfter = Number(transaction.balanceAfter);

    // Update transaction fields
    if (updateData.amount !== undefined) {
      transaction.amount = updateData.amount;
      // Recalculate balanceAfter
      transaction.balanceAfter = Number(transaction.balanceBefore) + updateData.amount;
    }
    if (updateData.type !== undefined) {
      transaction.type = updateData.type as ScoreTransactionType;
    }
    if (updateData.description !== undefined) {
      transaction.description = updateData.description;
    }

    // Save updated transaction
    await this.scoreTransactionsRepository.save(transaction);

    // Update user's current platformScore if amount changed
    if (updateData.amount !== undefined && oldAmount !== updateData.amount) {
      const user = await this.usersRepository.findOne({ where: { id: transaction.userId } });
      if (user) {
        const amountDifference = updateData.amount - oldAmount;
        user.platformScore = Number(user.platformScore) + amountDifference;
        await this.usersRepository.save(user);
        this.logger.log(`✏️ Updated transaction ${id} and adjusted user ${user.email} platformScore by ${amountDifference}`);
      }
    }

    return {
      success: true,
      message: 'Transaction updated successfully',
      transaction,
    };
  }

  /**
   * Delete a Seka-Svara Score transaction
   */
  async deleteScoreTransaction(id: string) {
    const transaction = await this.scoreTransactionsRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    // Reverse the transaction effect on user's platformScore
    const user = await this.usersRepository.findOne({ where: { id: transaction.userId } });
    if (user) {
      user.platformScore = Number(user.platformScore) - Number(transaction.amount);
      await this.usersRepository.save(user);
      this.logger.log(`🗑️ Deleted transaction ${id} and adjusted user ${user.email} platformScore by -${transaction.amount}`);
    }

    // Delete the transaction
    await this.scoreTransactionsRepository.delete(id);

    return {
      success: true,
      message: 'Transaction deleted successfully',
    };
  }
}

