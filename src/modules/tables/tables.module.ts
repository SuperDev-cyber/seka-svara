import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TablesController } from './tables.controller';
import { TablesService } from './tables.service';
import { GameTable } from './entities/game-table.entity';
import { TablePlayer } from './entities/table-player.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GameTable, TablePlayer])],
  controllers: [TablesController],
  providers: [TablesService],
  exports: [TablesService],
})
export class TablesModule {}

