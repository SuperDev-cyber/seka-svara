import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { Wallet } from './entities/wallet.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { User } from '../users/entities/user.entity';
import { AddressGeneratorService } from './services/address-generator.service';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, WalletTransaction, User]), BlockchainModule],
  controllers: [WalletController],
  providers: [WalletService, AddressGeneratorService],
  exports: [WalletService, AddressGeneratorService],
})
export class WalletModule {}

