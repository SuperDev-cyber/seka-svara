/**
 * Production Script: Sync Balance to PlatformScore
 * 
 * This script syncs existing user.balance values to user.platformScore
 * for users where platformScore is 0 but balance > 0.
 * 
 * Usage:
 *   Set DATABASE_URL environment variable, then run:
 *   node sync-balance-production.js
 * 
 * Example:
 *   DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require" node sync-balance-production.js
 */

const { Client } = require('pg');
require('dotenv').config();

async function syncBalanceToPlatformScore() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL environment variable is required');
    console.error('   Example: DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: connectionString.includes('neon.tech') || connectionString.includes('sslmode=require') 
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Check current state
    console.log('📊 Checking users before sync...');
    const beforeResult = await client.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN "platformScore" = 0 AND balance > 0 THEN 1 END) as users_to_sync,
        SUM(CASE WHEN "platformScore" = 0 AND balance > 0 THEN balance ELSE 0 END) as total_balance_to_sync
      FROM users;
    `);
    
    const stats = beforeResult.rows[0];
    console.log(`   Total users: ${stats.total_users}`);
    console.log(`   Users to sync: ${stats.users_to_sync}`);
    console.log(`   Total balance to sync: ${stats.total_balance_to_sync || 0}\n`);

    if (parseInt(stats.users_to_sync) === 0) {
      console.log('✅ No users need syncing. All users already have platformScore set.');
      return;
    }

    // Sync balance to platformScore for users where platformScore is 0 but balance > 0
    console.log('🔄 Syncing balance to platformScore...');
    const result = await client.query(`
      UPDATE users
      SET "platformScore" = ROUND(balance)
      WHERE "platformScore" = 0 AND balance > 0
      RETURNING id, email, balance, "platformScore";
    `);
    
    console.log(`✅ Updated ${result.rows.length} users:\n`);
    result.rows.forEach((user, idx) => {
      console.log(`  ${idx + 1}. ${user.email}`);
      console.log(`     Balance: ${user.balance} → PlatformScore: ${user.platformScore}`);
    });

    console.log('\n✅ Balance sync completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the sync
syncBalanceToPlatformScore();

