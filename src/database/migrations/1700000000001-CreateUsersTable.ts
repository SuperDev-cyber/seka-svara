import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateUsersTable1700000000001 implements MigrationInterface {
  name = 'CreateUsersTable1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'username',
            type: 'varchar',
            length: '50',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'password',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'role',
            type: 'enum',
            enum: ['user', 'admin', 'moderator'],
            default: "'user'",
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'inactive', 'banned', 'suspended'],
            default: "'active'",
            isNullable: false,
          },
          {
            name: 'avatar',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'emailVerified',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'emailVerificationToken',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'passwordResetToken',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'passwordResetExpires',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'refreshToken',
            type: 'varchar',
            length: '500',
            isNullable: true,
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
            name: 'totalGamesPlayed',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'totalGamesWon',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'totalWinnings',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
            isNullable: false,
          },
          {
            name: 'level',
            type: 'int',
            default: 1,
            isNullable: false,
          },
          {
            name: 'experience',
            type: 'int',
            default: 0,
            isNullable: false,
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
          {
            name: 'lastLoginAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users');
  }
}

