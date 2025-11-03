import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PlatformSettings } from './entities/platform-settings.entity';
import { User } from '../users/entities/user.entity';
import { PlatformScoreTransaction } from '../users/entities/platform-score-transaction.entity';
import { PlatformScoreService } from '../users/services/platform-score.service';
import { GameTable } from '../tables/entities/game-table.entity';
import { Game } from '../game/entities/game.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PlatformSettings, User, PlatformScoreTransaction, GameTable, Game])],
  controllers: [AdminController],
  providers: [AdminService, PlatformScoreService],
  exports: [AdminService],
})
export class AdminModule {}

