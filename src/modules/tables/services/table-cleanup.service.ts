import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { GameTable } from '../entities/game-table.entity';
import { TablePlayer } from '../entities/table-player.entity';

/**
 * Service to automatically clean up empty or single-player game tables
 * that have been in that state for more than 1 minute.
 */
@Injectable()
export class TableCleanupService {
  private readonly logger = new Logger(TableCleanupService.name);

  constructor(
    @InjectRepository(GameTable)
    private readonly gameTablesRepository: Repository<GameTable>,
    @InjectRepository(TablePlayer)
    private readonly tablePlayersRepository: Repository<TablePlayer>,
  ) {}

  /**
   * Runs every minute to clean up tables with 0 or 1 players
   * that have been waiting for more than 1 minute.
   * 
   * Cron expression: every minute at second 0
   */
  @Cron('0 * * * * *')
  async cleanupEmptyTables() {
    try {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000); // 1 minute ago

      // Find all tables that:
      // 1. Have 0 or 1 players (currentPlayers <= 1)
      // 2. Are in 'waiting' status (not actively playing)
      // 3. Were created more than 1 minute ago
      const tablesToDelete = await this.gameTablesRepository
        .createQueryBuilder('table')
        .where('table.status = :status', { status: 'waiting' })
        .andWhere('table.currentPlayers <= :maxPlayers', { maxPlayers: 1 })
        .andWhere('table.createdAt < :oneMinuteAgo', { oneMinuteAgo })
        .getMany();

      if (tablesToDelete.length === 0) {
        this.logger.debug('No empty or single-player tables to clean up');
        return;
      }

      this.logger.log(`🧹 Found ${tablesToDelete.length} table(s) to clean up`);

      // Delete related table players first (to avoid foreign key constraints)
      for (const table of tablesToDelete) {
        try {
          // Delete all players associated with this table
          await this.tablePlayersRepository.delete({ tableId: table.id });
          this.logger.debug(`   ✅ Deleted players for table ${table.id}`);

          // Delete the table itself
          await this.gameTablesRepository.delete(table.id);
          this.logger.log(`   ✅ Deleted table "${table.name}" (ID: ${table.id}) - had ${table.currentPlayers} player(s)`);
        } catch (error) {
          this.logger.error(`   ❌ Failed to delete table ${table.id}: ${error.message}`);
        }
      }

      this.logger.log(`✅ Cleanup complete: Deleted ${tablesToDelete.length} empty/single-player table(s)`);
    } catch (error) {
      this.logger.error(`❌ Error during table cleanup: ${error.message}`, error.stack);
    }
  }
}

