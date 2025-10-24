import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { BscService } from './services/bsc.service';
import { TronService } from './services/tron.service';
import { EscrowService } from './services/escrow.service';

@Module({
  providers: [BlockchainService, BscService, TronService, EscrowService],
  exports: [BlockchainService, BscService, TronService, EscrowService],
})
export class BlockchainModule {}

