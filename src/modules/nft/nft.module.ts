import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NftController } from './nft.controller';
import { NftService } from './nft.service';
import { NFT } from './entities/nft.entity';
import { NFTTransaction } from './entities/nft-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NFT, NFTTransaction])],
  controllers: [NftController],
  providers: [NftService],
  exports: [NftService],
})
export class NftModule {}

