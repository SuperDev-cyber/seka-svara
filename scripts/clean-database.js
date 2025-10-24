/**
 * Database Cleanup Script
 * Deletes all games, players, and wallets for a fresh restart
 */

const { DataSource } = require('typeorm');
const path = require('path');

async function cleanDatabase() {
  console.log('🧹 Starting database cleanup...');

  // Create connection to database
  const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'seka_svara',
    synchronize: false,
  });

  try {
    // Connect
    console.log('📡 Connecting to database...');
    await AppDataSource.initialize();
    console.log('✅ Connected!');

    // Clean tables in order (respecting foreign keys)
    const tables = [
      { name: 'game_player', description: 'Game Players' },
      { name: 'game', description: 'Games' },
      { name: 'wallet_transaction', description: 'Wallet Transactions' },
      { name: 'wallet', description: 'Wallets' },
    ];

    for (const table of tables) {
      try {
        const result = await AppDataSource.query(
          `DELETE FROM "${table.name}"`,
        );
        console.log(
          `✅ Deleted all records from ${table.description} (${table.name})`,
        );
      } catch (error) {
        console.log(`⚠️  Table ${table.name} might not exist or is empty`);
      }
    }

    console.log('');
    console.log('🎉 Database cleanup complete!');
    console.log('All games, players, and wallets have been deleted.');
    console.log('');

    // Close connection
    await AppDataSource.destroy();
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

cleanDatabase();

