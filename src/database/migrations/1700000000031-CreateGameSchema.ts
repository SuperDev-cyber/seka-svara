import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateGameSchema1700000000031 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // games
    await queryRunner.createTable(new Table({
      name: 'games',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
        { name: 'tableId', type: 'uuid' },
        { name: 'status', type: 'varchar', default: "'pending'" },
        { name: 'currentRound', type: 'int', default: 1 },
        { name: 'currentTurnPlayerId', type: 'uuid', isNullable: true },
        { name: 'pot', type: 'decimal', precision: 18, scale: 8, default: 0 },
        { name: 'currentBet', type: 'decimal', precision: 18, scale: 8, default: 0 },
        { name: 'maxPlayers', type: 'int', default: 10 },
        { name: 'ante', type: 'decimal', precision: 18, scale: 8, default: 0 },
        { name: 'winnerId', type: 'uuid', isNullable: true },
        { name: 'dealerId', type: 'uuid', isNullable: true },
        { name: 'gameState', type: 'json', isNullable: true },
        { name: 'history', type: 'json', isNullable: true },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'finishedAt', type: 'timestamp', isNullable: true },
        { name: 'cardViewers', type: 'text', isNullable: true, default: "''" },
        { name: 'blindPlayers', type: 'json', isNullable: true, default: "'{}'" },
        { name: 'participantCount', type: 'int', default: 0 },
      ],
    }), true);

    // game_players
    await queryRunner.createTable(new Table({
      name: 'game_players',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
        { name: 'gameId', type: 'uuid' },
        { name: 'userId', type: 'uuid' },
        { name: 'position', type: 'int' },
        { name: 'hand', type: 'json', isNullable: true },
        { name: 'betAmount', type: 'decimal', precision: 18, scale: 8, default: 0 },
        { name: 'totalBet', type: 'decimal', precision: 18, scale: 8, default: 0 },
        { name: 'status', type: 'varchar', default: "'active'" },
        { name: 'isWinner', type: 'boolean', default: false },
        { name: 'winnings', type: 'decimal', precision: 18, scale: 8, default: 0 },
        { name: 'hasActed', type: 'boolean', default: false },
        { name: 'hasSeenCards', type: 'boolean', default: false },
        { name: 'handScore', type: 'int', isNullable: true },
        { name: 'handDescription', type: 'varchar', isNullable: true },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    // game_tables
    await queryRunner.createTable(new Table({
      name: 'game_tables',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
        { name: 'name', type: 'varchar' },
        { name: 'creatorId', type: 'uuid' },
        { name: 'status', type: 'varchar', default: "'waiting'" },
        { name: 'network', type: 'varchar', default: "'BEP20'" },
        { name: 'buyInAmount', type: 'decimal', precision: 18, scale: 8 },
        { name: 'minBet', type: 'decimal', precision: 18, scale: 8 },
        { name: 'maxBet', type: 'decimal', precision: 18, scale: 8 },
        { name: 'minPlayers', type: 'int', default: 2 },
        { name: 'maxPlayers', type: 'int', default: 6 },
        { name: 'currentPlayers', type: 'int', default: 0 },
        { name: 'isPrivate', type: 'boolean', default: false },
        { name: 'inviteCode', type: 'varchar', isNullable: true },
        { name: 'platformFee', type: 'decimal', precision: 5, scale: 2, default: 5 },
        { name: 'currentGameId', type: 'uuid', isNullable: true },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    // table_players
    await queryRunner.createTable(new Table({
      name: 'table_players',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
        { name: 'tableId', type: 'uuid' },
        { name: 'userId', type: 'uuid' },
        { name: 'seatNumber', type: 'int' },
        { name: 'chips', type: 'decimal', precision: 18, scale: 8, default: 0 },
        { name: 'isReady', type: 'boolean', default: false },
        { name: 'status', type: 'varchar', default: "'active'" },
        { name: 'joinedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
    }), true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('table_players', true);
    await queryRunner.dropTable('game_tables', true);
    await queryRunner.dropTable('game_players', true);
    await queryRunner.dropTable('games', true);
  }
}


