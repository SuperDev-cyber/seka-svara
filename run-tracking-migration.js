/**
 * Run Game Tracking Migration
 * Adds cardViewers, blindPlayers, participantCount, and gameResults fields to games table
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'seka_svara_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  };

  console.log('🔧 Running Game Tracking Migration...');
  console.log(`📊 Database: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);
  console.log('');

  const client = new Client(dbConfig);

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Read migration SQL file
    const sqlPath = path.join(__dirname, 'migrations', 'add-game-tracking-fields.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📝 Executing migration SQL...');
    console.log('');

    await client.query(sql);

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('📊 Added columns to games table:');
    console.log('   • cardViewers (text[]) - Array of user IDs who viewed cards');
    console.log('   • blindPlayers (jsonb) - JSON tracking blind bets per user');
    console.log('   • participantCount (integer) - Total participants');
    console.log('   • gameResults (jsonb) - Winners, losers, amounts');
    console.log('');

    // Verify columns were added
    const verifyQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'games' 
      AND column_name IN ('cardViewers', 'blindPlayers', 'participantCount', 'gameResults')
      ORDER BY column_name;
    `;

    const result = await client.query(verifyQuery);
    
    if (result.rows.length === 4) {
      console.log('✅ Verification: All 4 columns added successfully');
      result.rows.forEach(row => {
        console.log(`   ✓ ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.warn(`⚠️  Warning: Expected 4 columns, found ${result.rows.length}`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('');
    console.log('✅ Database connection closed');
  }
}

runMigration();

