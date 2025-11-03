import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { PlatformScoreTransaction } from './entities/platform-score-transaction.entity';
import { WalletModule } from '../wallet/wallet.module';
import { PlatformBalanceService } from './services/platform-balance.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, PlatformScoreTransaction]), WalletModule],
  controllers: [UsersController],
  providers: [UsersService, PlatformBalanceService],
  exports: [UsersService, PlatformBalanceService],
})
export class UsersModule {}

