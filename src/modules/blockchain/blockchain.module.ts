import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BlockchainService } from './blockchain.service';
import { BscService } from './services/bsc.service';
import { EscrowService } from './services/escrow.service';

@Module({
  imports: [ConfigModule], // Add ConfigModule for BscService and TronService
  providers: [BlockchainService, BscService, EscrowService],
  exports: [BlockchainService, BscService, EscrowService],
})
export class BlockchainModule {}

