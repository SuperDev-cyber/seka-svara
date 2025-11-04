import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddWalletAddressesAndPoints1700000000020 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add wallet address columns
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'trc20WalletAddress',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'bep20WalletAddress',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'erc20WalletAddress',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );

    // Add points column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'points',
        type: 'decimal',
        precision: 18,
        scale: 8,
        default: 0,
        isNullable: false,
      }),
    );

    // Add platformScore column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'platformScore',
        type: 'decimal',
        precision: 18,
        scale: 0,
        default: 0,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove columns in reverse order
    await queryRunner.dropColumn('users', 'platformScore');
    await queryRunner.dropColumn('users', 'points');
    await queryRunner.dropColumn('users', 'erc20WalletAddress');
    await queryRunner.dropColumn('users', 'bep20WalletAddress');
    await queryRunner.dropColumn('users', 'trc20WalletAddress');
  }
}

