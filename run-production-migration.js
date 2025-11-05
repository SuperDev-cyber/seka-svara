/**
 * Run Game Tracking Migration on Production Database
 * Uses DATABASE_URL from environment (for Render/Heroku-style deployments)
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable not found!');
    console.error('Please set DATABASE_URL in your .env file or environment');
    process.exit(1);
  }

  console.log('🔧 Running Game Tracking Migration on Production...');
  console.log('📊 Using DATABASE_URL connection');
  console.log('');

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false // For production databases like Neon, Heroku, etc.
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to production database');

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
      console.log('Found columns:', result.rows);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('');
    console.log('✅ Database connection closed');
    console.log('');
    console.log('🎉 Migration complete! You can now start the game.');
  }
}

runMigration();

