/**
 * Database Initialization and Cleanup Script
 * 
 * This script will:
 * 1. Initialize all database tables (ensure they exist)
 * 2. Delete all contents from all tables
 * 
 * Supports both DATABASE_URL (Neon) and individual DB variables
 * 
 * Usage: npm run db:init
 */

require('dotenv').config();
const { DataSource } = require('typeorm');
const path = require('path');

// Support DATABASE_URL (for Neon) with fallback to individual vars
const databaseUrl = process.env.DATABASE_URL;

let dataSourceConfig;

if (databaseUrl) {
  // Use DATABASE_URL (Neon format)
  dataSourceConfig = {
    type: 'postgres',
    url: databaseUrl,
    entities: ['dist/**/*.entity.js'],
    synchronize: false, // Don't sync during initial connection - we'll do it after deleting data
    logging: false, // Reduce logging during data deletion
    ssl: databaseUrl.includes('sslmode=require') || databaseUrl.includes('neon.tech')
      ? { rejectUnauthorized: false }
      : false,
  };
} else {
  // Fallback to individual environment variables
  dataSourceConfig = {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'seka_svara_db',
    entities: ['dist/**/*.entity.js'],
    synchronize: false, // Don't sync during initial connection - we'll do it after deleting data
    logging: false, // Reduce logging during data deletion
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  };
}

async function initializeAndCleanDatabase() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🗄️  Database Initialization and Cleanup');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const AppDataSource = new DataSource(dataSourceConfig);

  try {
    // Step 1: Connect and initialize tables
    console.log('📡 Step 1: Connecting to database...');
    if (databaseUrl) {
      console.log('   Using DATABASE_URL (Neon/Cloud PostgreSQL)');
    } else {
      console.log(`   Connecting to: ${dataSourceConfig.host}:${dataSourceConfig.port}/${dataSourceConfig.database}`);
    }
    
    await AppDataSource.initialize();
    console.log('✅ Connected successfully!');
    console.log('');

    // Step 2: Delete all data FIRST (before schema sync to avoid constraint issues)
    console.log('🧹 Step 2: Deleting all existing data from tables...');
    console.log('   Order: Child tables first, then parent tables');
    console.log('');

    // Define tables in deletion order (respecting foreign key constraints)
    // Using actual table names from entities (check @Entity decorator for exact names)
    const tablesToClean = [
      // Child tables first (have foreign keys)
      { name: 'nft_transactions', description: 'NFT Transactions' },
      { name: 'nfts', description: 'NFTs' },
      { name: 'transactions', description: 'Transactions' },
      { name: 'wallet_transactions', description: 'Wallet Transactions' },
      { name: 'game_players', description: 'Game Players' },
      { name: 'tournament_players', description: 'Tournament Players' },
      { name: 'tournaments', description: 'Tournaments' },
      { name: 'games', description: 'Games' },
      { name: 'table_players', description: 'Table Players' },
      { name: 'invitations', description: 'Invitations' }, // Note: plural
      { name: 'game_tables', description: 'Game Tables' },
      { name: 'notifications', description: 'Notifications' },
      { name: 'wallets', description: 'Wallets' },
      { name: 'platform_score_transactions', description: 'Platform Score Transactions' },
      // Parent tables last
      { name: 'users', description: 'Users' },
      { name: 'platform_settings', description: 'Platform Settings' },
    ];

    let totalCleared = 0;

    for (const table of tablesToClean) {
      try {
        // Use TRUNCATE CASCADE for faster deletion (PostgreSQL specific)
        // Falls back to DELETE if TRUNCATE fails
        try {
          await AppDataSource.query(`TRUNCATE TABLE "${table.name}" CASCADE`);
          console.log(`   ✅ Cleared ${table.description} (${table.name})`);
          totalCleared++;
        } catch (truncateError) {
          // If TRUNCATE fails, try DELETE
          const deleteResult = await AppDataSource.query(`DELETE FROM "${table.name}"`);
          const deletedCount = deleteResult?.rowCount || 0;
          if (deletedCount > 0) {
            console.log(`   ✅ Cleared ${table.description} (${table.name}) - ${deletedCount} rows`);
          } else {
            console.log(`   ✅ Cleared ${table.description} (${table.name}) - already empty`);
          }
          totalCleared++;
        }
      } catch (error) {
        // If table doesn't exist, that's okay (will be created by sync)
        if (error.message.includes('does not exist') || error.message.includes('relation') || error.code === '42P01') {
          console.log(`   ⚠️  Table ${table.name} does not exist yet (will be created by sync)`);
        } else {
          console.log(`   ⚠️  Could not clear ${table.name}: ${error.message}`);
        }
      }
    }

    console.log('');
    
    // Step 3: Close connection and recreate with synchronize enabled
    await AppDataSource.destroy();
    
    // Recreate DataSource with synchronize enabled
    dataSourceConfig.synchronize = true;
    dataSourceConfig.logging = true;
    const SyncDataSource = new DataSource(dataSourceConfig);
    
    // Step 3: Synchronize schema AFTER data is deleted
    console.log('📋 Step 3: Initializing/Synchronizing database schema...');
    console.log('   This will create/update all tables...');
    await SyncDataSource.initialize();
    await SyncDataSource.synchronize(false); // Don't drop existing tables, just create/update
    console.log('✅ All tables initialized/verified!');
    console.log('');
    
    await SyncDataSource.destroy();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Database Initialization and Cleanup Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   • Data cleared from ${totalCleared} tables`);
    console.log(`   • All tables initialized/verified`);
    console.log('');
    console.log('🎯 Your database is now ready for fresh data!');
    console.log('');
  } catch (error) {
    console.error('');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Error during initialization/cleanup:');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('');
    console.error(error.message);
    console.error('');
    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }
    
    try {
      await AppDataSource.destroy();
    } catch (destroyError) {
      // Ignore destroy errors
    }
    
    process.exit(1);
  }

  process.exit(0);
}

// Run the script
initializeAndCleanDatabase();
