import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BlockchainService } from './blockchain.service';
import { BscService } from './services/bsc.service';
import { EthereumService } from './services/ethereum.service';
import { EscrowService } from './services/escrow.service';

@Module({
  imports: [ConfigModule], // Add ConfigModule for BscService and EthereumService
  providers: [BlockchainService, BscService, EthereumService, EscrowService],
  exports: [BlockchainService, BscService, EthereumService, EscrowService],
})
export class BlockchainModule {}

