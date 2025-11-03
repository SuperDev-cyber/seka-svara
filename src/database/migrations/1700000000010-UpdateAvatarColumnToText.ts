import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateAvatarColumnToText1700000000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Change avatar column type from VARCHAR to TEXT to support base64 images
    await queryRunner.query(`
      ALTER TABLE "users" 
      ALTER COLUMN "avatar" TYPE TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert back to VARCHAR (might truncate long values)
    await queryRunner.query(`
      ALTER TABLE "users" 
      ALTER COLUMN "avatar" TYPE VARCHAR
    `);
  }
}

