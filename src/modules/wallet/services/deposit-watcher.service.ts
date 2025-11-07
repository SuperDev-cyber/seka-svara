import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from '../entities/wallet.entity';
import { WalletTransaction, TransactionType } from '../entities/wallet-transaction.entity';
import { BscService } from '../../blockchain/services/bsc.service';
import { WalletService } from '../wallet.service';

/**
 * Watches blockchain networks for deposits that were sent directly to
 * user-specific deposit addresses (without going through the UI workflow)
 * and credits the user's platform score automatically.
 */
@Injectable()
export class DepositWatcherService {
  private readonly logger = new Logger(DepositWatcherService.name);
  private lastProcessedBscBlock = 0;
  private readonly blockLookback = 250; // Cover ~8-10 mins on BSC

  constructor(
    @InjectRepository(Wallet)
    private readonly walletsRepository: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private readonly transactionsRepository: Repository<WalletTransaction>,
    private readonly walletService: WalletService,
    @Optional() private readonly bscService?: BscService,
  ) {}

  /**
   * Periodically scan BSC for USDT transfers to known deposit addresses.
   * Disabled automatically if the BSC service is not configured.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async pollBscDeposits() {
    if (!this.bscService?.isInitialized()) {
      return;
    }

    try {
      const provider = this.bscService.getProvider();
      if (!provider) {
        return;
      }

      const currentBlock = await provider.getBlockNumber();
      if (!currentBlock || currentBlock <= 0) {
        return;
      }

      const fromBlock = this.calculateFromBlock(currentBlock);
      this.lastProcessedBscBlock = currentBlock;

      const wallets = await this.walletsRepository
        .createQueryBuilder('wallet')
        .select(['wallet.id', 'wallet.userId', 'wallet.bep20Address'])
        .where('wallet.bep20Address IS NOT NULL')
        .getMany();

      if (!wallets.length) {
        return;
      }

      const addressMap = new Map(
        wallets
          .filter((wallet) => wallet.bep20Address)
          .map((wallet) => [wallet.bep20Address.toLowerCase(), wallet]),
      );

      const monitoredAddresses = Array.from(addressMap.keys());
      if (!monitoredAddresses.length) {
        return;
      }

      const transferEvents = await this.bscService.getUSDTTransferEventsTo(
        monitoredAddresses,
        fromBlock,
        currentBlock,
      );

      if (!transferEvents.length) {
        return;
      }

      for (const event of transferEvents) {
        await this.processBscDepositEvent(event, addressMap);
      }
    } catch (error) {
      this.logger.error(`BSC deposit watcher error: ${error.message}`);
    }
  }

  private calculateFromBlock(currentBlock: number): number {
    if (!this.lastProcessedBscBlock) {
      return Math.max(currentBlock - this.blockLookback, 0);
    }

    // Add a small overlap to avoid missing events on chain reorgs
    const overlap = 10;
    return Math.max(this.lastProcessedBscBlock - overlap, 0);
  }

  private async processBscDepositEvent(
    event: {
      txHash: string;
      from: string;
      to: string;
      amount: number;
      blockNumber: number;
      logIndex: number;
    },
    addressMap: Map<string, Wallet>,
  ) {
    try {
      const normalizedTo = event.to.toLowerCase();
      const wallet = addressMap.get(normalizedTo);
      if (!wallet) {
        return;
      }

      const existing = await this.transactionsRepository.findOne({
        where: { txHash: event.txHash, type: TransactionType.DEPOSIT },
      });

      if (existing) {
        return;
      }

      this.logger.log(
        `Detected on-chain deposit for wallet ${wallet.id} (user ${wallet.userId}) -> ${event.amount} USDT [${event.txHash}]`,
      );

      await this.walletService.processDeposit(wallet.userId, {
        network: 'BEP20',
        amount: event.amount,
        fromAddress: event.from,
        txHash: event.txHash,
      });
    } catch (error) {
      this.logger.error(`Failed to process detected deposit ${event.txHash}: ${error.message}`);
    }
  }
}

