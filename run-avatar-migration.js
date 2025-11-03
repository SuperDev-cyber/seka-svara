// Quick script to update avatar column to TEXT type
// Run this with: node run-avatar-migration.js

require('dotenv').config();
const { Client } = require('pg');

async function runMigration() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'seka_svara_db',
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 Updating avatar column to TEXT type...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    await client.connect();
    console.log('✅ Connected to database');

    // Check current column type
    const checkQuery = `
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'avatar';
    `;
    
    const beforeResult = await client.query(checkQuery);
    if (beforeResult.rows.length > 0) {
      console.log('\n📋 Current avatar column:');
      console.log('   Type:', beforeResult.rows[0].data_type);
      console.log('   Max Length:', beforeResult.rows[0].character_maximum_length || 'unlimited');
    }

    // Update column type
    console.log('\n🔄 Changing column type to TEXT...');
    await client.query('ALTER TABLE users ALTER COLUMN avatar TYPE TEXT;');
    console.log('✅ Column type updated successfully!');

    // Verify change
    const afterResult = await client.query(checkQuery);
    if (afterResult.rows.length > 0) {
      console.log('\n📋 New avatar column:');
      console.log('   Type:', afterResult.rows[0].data_type);
      console.log('   Max Length:', afterResult.rows[0].character_maximum_length || 'unlimited');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Migration completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ Error running migration:', error.message);
    console.error('   Details:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();

