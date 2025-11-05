import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateInvitationsAndConstraints1700000000032 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'invitations',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
        { name: 'tableId', type: 'uuid' },
        { name: 'inviterId', type: 'uuid' },
        { name: 'inviteeId', type: 'uuid' },
        { name: 'status', type: 'varchar', default: "'pending'" },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    // Unique constraint to avoid duplicate row for same table/invitee while pending
    await queryRunner.createIndex('invitations', new TableIndex({
      name: 'IDX_INVITE_UNIQUE_PENDING',
      columnNames: ['tableId', 'inviteeId', 'status'],
    }));

    // Unique to avoid duplicate player rows
    await queryRunner.query(`
      DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'IDX_TABLE_PLAYER_UNIQUE'
      ) THEN
        CREATE UNIQUE INDEX "IDX_TABLE_PLAYER_UNIQUE" ON "table_players" ("tableId", "userId");
      END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_TABLE_PLAYER_UNIQUE"');
    await queryRunner.dropIndex('invitations', 'IDX_INVITE_UNIQUE_PENDING');
    await queryRunner.dropTable('invitations', true);
  }
}


