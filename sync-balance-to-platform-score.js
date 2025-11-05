const { Client } = require('pg');
require('dotenv').config();

async function syncBalanceToPlatformScore() {
  const connectionString = process.env.DATABASE_URL || 
    `postgresql://${process.env.DB_USERNAME || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'seka_svara_db'}`;
  
  const client = new Client({
    connectionString,
    ssl: connectionString.includes('neon.tech') || connectionString.includes('sslmode=require') 
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Sync balance to platformScore for users where platformScore is 0 but balance > 0
    console.log('🔄 Syncing balance to platformScore...');
    const result = await client.query(`
      UPDATE users
      SET "platformScore" = balance
      WHERE "platformScore" = 0 AND balance > 0
      RETURNING id, email, balance, "platformScore";
    `);
    
    console.log(`✅ Updated ${result.rows.length} users:`);
    result.rows.forEach((user, idx) => {
      console.log(`  ${idx + 1}. ${user.email}: balance=${user.balance} → platformScore=${user.platformScore}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
  }
}

syncBalanceToPlatformScore();

