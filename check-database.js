const { Client } = require('pg');
require('dotenv').config();

async function checkDatabase() {
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

    // Check if tables exist
    console.log('📋 Checking tables...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    const existingTables = tablesResult.rows.map(r => r.table_name);
    console.log('Existing tables:', existingTables);
    
    const requiredTables = ['users', 'wallets', 'wallet_transactions', 'platform_score_transactions', 'migrations'];
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    
    if (missingTables.length > 0) {
      console.log(`\n❌ Missing tables: ${missingTables.join(', ')}`);
      console.log('⚠️  Migrations need to be run!');
    } else {
      console.log('\n✅ All required tables exist');
    }

    // Check users table columns
    console.log('\n📊 Checking users table columns...');
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    
    const existingColumns = columnsResult.rows.map(r => r.column_name);
    console.log('Users table columns:', existingColumns);
    
    const requiredColumns = ['balance', 'platformScore', 'trc20WalletAddress', 'bep20WalletAddress', 'erc20WalletAddress'];
    const missingColumns = requiredColumns.filter(c => !existingColumns.includes(c));
    
    if (missingColumns.length > 0) {
      console.log(`\n❌ Missing columns in users table: ${missingColumns.join(', ')}`);
      console.log('⚠️  Migration 1700000000020 needs to be run!');
    } else {
      console.log('\n✅ All required columns exist in users table');
    }

    // Check users data
    console.log('\n👥 Checking users data...');
    const usersResult = await client.query(`
      SELECT id, email, username, balance, "platformScore", role, status
      FROM users
      ORDER BY "createdAt" DESC
      LIMIT 10;
    `);
    
    console.log(`Found ${usersResult.rows.length} users:`);
    usersResult.rows.forEach((user, idx) => {
      console.log(`\n${idx + 1}. ${user.email} (${user.username})`);
      console.log(`   Balance: ${user.balance || 0}`);
      console.log(`   Platform Score: ${user.platformScore || 0}`);
      console.log(`   Role: ${user.role}, Status: ${user.status}`);
    });

    // Check wallets data
    if (existingTables.includes('wallets')) {
      console.log('\n💼 Checking wallets data...');
      const walletsResult = await client.query(`
        SELECT w.id, w."userId", u.email, w.balance, w."availableBalance", w."lockedBalance"
        FROM wallets w
        LEFT JOIN users u ON w."userId" = u.id
        ORDER BY w."createdAt" DESC
        LIMIT 10;
      `);
      
      console.log(`Found ${walletsResult.rows.length} wallets:`);
      walletsResult.rows.forEach((wallet, idx) => {
        console.log(`\n${idx + 1}. User: ${wallet.email || wallet.userId}`);
        console.log(`   Balance: ${wallet.balance || 0}`);
        console.log(`   Available: ${wallet.availableBalance || 0}`);
        console.log(`   Locked: ${wallet.lockedBalance || 0}`);
      });
    }

    // Check platform_score_transactions
    if (existingTables.includes('platform_score_transactions')) {
      console.log('\n📈 Checking platform_score_transactions...');
      const transactionsResult = await client.query(`
        SELECT COUNT(*) as count
        FROM platform_score_transactions;
      `);
      console.log(`Total platform score transactions: ${transactionsResult.rows[0].count}`);
    }

    // Check migrations
    if (existingTables.includes('migrations')) {
      console.log('\n🔄 Checking migrations...');
      const migrationsResult = await client.query(`
        SELECT name, timestamp
        FROM migrations
        ORDER BY timestamp DESC;
      `);
      
      console.log(`Found ${migrationsResult.rows.length} migrations:`);
      migrationsResult.rows.forEach((migration, idx) => {
        console.log(`  ${idx + 1}. ${migration.name} (${new Date(parseInt(migration.timestamp)).toISOString()})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
  }
}

checkDatabase();

