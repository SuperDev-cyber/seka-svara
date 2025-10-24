import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    private blockchainService: BlockchainService,
  ) {}

  async create(transactionData: Partial<Transaction>) {
    const transaction = this.transactionsRepository.create(transactionData);
    return this.transactionsRepository.save(transaction);
  }

  async findOne(id: string) {
    const transaction = await this.transactionsRepository.findOne({ where: { id } });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }

  async getUserTransactions(
    userId: string,
    page: number = 1,
    limit: number = 10,
    type?: string,
  ) {
    const query = this.transactionsRepository.createQueryBuilder('transaction');

    query.where('transaction.userId = :userId', { userId });

    if (type) {
      query.andWhere('transaction.type = :type', { type });
    }

    query
      .orderBy('transaction.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [transactions, total] = await query.getManyAndCount();

    return {
      data: transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAll(page: number = 1, limit: number = 10) {
    const [transactions, total] = await this.transactionsRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async verifyBlockchainTransaction(txHash: string, network: 'BEP20' | 'TRC20') {
    return this.blockchainService.verifyTransaction(txHash, network);
  }

  async updateStatus(id: string, status: string) {
    await this.transactionsRepository.update(id, { status });
    return this.findOne(id);
  }
}

