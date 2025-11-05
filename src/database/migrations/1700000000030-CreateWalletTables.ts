import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateWalletTables1700000000030 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create wallets table
    await queryRunner.createTable(
      new Table({
        name: 'wallets',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'balance',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
            isNullable: false,
          },
          {
            name: 'availableBalance',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
            isNullable: false,
          },
          {
            name: 'lockedBalance',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
            isNullable: false,
          },
          {
            name: 'bep20Address',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'trc20Address',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create foreign key for wallets.userId -> users.id
    await queryRunner.createForeignKey(
      'wallets',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    // Create wallet_transactions table
    await queryRunner.createTable(
      new Table({
        name: 'wallet_transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'walletId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['deposit', 'withdrawal', 'transfer', 'bet', 'win'],
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'confirmed', 'failed', 'cancelled'],
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'network',
            type: 'enum',
            enum: ['BEP20', 'TRC20', 'ERC20'],
            isNullable: true,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 18,
            scale: 8,
            isNullable: false,
          },
          {
            name: 'fromAddress',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'toAddress',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'txHash',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'confirmations',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'confirmedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create foreign key for wallet_transactions.walletId -> wallets.id
    await queryRunner.createForeignKey(
      'wallet_transactions',
      new TableForeignKey({
        columnNames: ['walletId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'wallets',
        onDelete: 'CASCADE',
      }),
    );

    // Create platform_score_transactions table
    await queryRunner.createTable(
      new Table({
        name: 'platform_score_transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 18,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'balanceBefore',
            type: 'decimal',
            precision: 18,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'balanceAfter',
            type: 'decimal',
            precision: 18,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['earned', 'spent', 'bonus', 'penalty', 'refund'],
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'referenceId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'referenceType',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create foreign key for platform_score_transactions.userId -> users.id
    await queryRunner.createForeignKey(
      'platform_score_transactions',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first
    const walletTransactionsTable = await queryRunner.getTable('wallet_transactions');
    const walletTransactionsForeignKey = walletTransactionsTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('walletId') !== -1,
    );
    if (walletTransactionsForeignKey) {
      await queryRunner.dropForeignKey('wallet_transactions', walletTransactionsForeignKey);
    }

    const platformScoreTransactionsTable = await queryRunner.getTable('platform_score_transactions');
    const platformScoreTransactionsForeignKey = platformScoreTransactionsTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('userId') !== -1,
    );
    if (platformScoreTransactionsForeignKey) {
      await queryRunner.dropForeignKey('platform_score_transactions', platformScoreTransactionsForeignKey);
    }

    const walletsTable = await queryRunner.getTable('wallets');
    const walletsForeignKey = walletsTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('userId') !== -1,
    );
    if (walletsForeignKey) {
      await queryRunner.dropForeignKey('wallets', walletsForeignKey);
    }

    // Drop tables
    await queryRunner.dropTable('platform_score_transactions');
    await queryRunner.dropTable('wallet_transactions');
    await queryRunner.dropTable('wallets');
  }
}

