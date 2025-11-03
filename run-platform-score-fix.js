require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'sekasvara',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    console.log('🔌 Connecting to database...');
    console.log(`   Host: ${client.host}`);
    console.log(`   Database: ${client.database}`);
    console.log(`   User: ${client.user}`);
    
    await client.connect();
    console.log('✅ Connected to database');

    // Read the migration SQL file
    const sqlPath = path.join(__dirname, 'migrations', 'fix-platform-score-scale.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('\n📋 Running migration...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Execute the migration
    await client.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Check the results
    const result = await client.query(`
      SELECT id, email, "platformScore" 
      FROM users 
      WHERE "platformScore" > 0
      ORDER BY "platformScore" DESC
      LIMIT 10
    `);
    
    console.log('\n📊 Sample platformScore values after migration:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    result.rows.forEach(row => {
      console.log(`   ${row.email}: ${row.platformScore} SEKA`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

runMigration();

