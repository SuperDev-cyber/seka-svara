import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { Wallet } from './entities/wallet.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { User } from '../users/entities/user.entity';
import { PlatformScoreTransaction } from '../users/entities/platform-score-transaction.entity';
import { AddressGeneratorService } from './services/address-generator.service';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { PlatformScoreService } from '../users/services/platform-score.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, WalletTransaction, User, PlatformScoreTransaction]),
    BlockchainModule,
  ],
  controllers: [WalletController],
  providers: [WalletService, AddressGeneratorService, PlatformScoreService],
  exports: [WalletService, AddressGeneratorService],
})
export class WalletModule {}

