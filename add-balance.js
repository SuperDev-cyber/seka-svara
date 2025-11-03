/**
 * Admin Script: Add Balance to User
 * 
 * Usage: node add-balance.js <email_or_username> <amount>
 * Example: node add-balance.js superadmin456 10000
 */

// Load environment variables from .env file
require('dotenv').config();

const { Client } = require('pg');

async function addBalance() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('❌ Usage: node add-balance.js <email_or_username> <amount>');
    console.error('❌ Example: node add-balance.js superadmin456 10000');
    process.exit(1);
  }

  const identifier = args[0]; // email or username
  const amount = parseFloat(args[1]);

  if (isNaN(amount) || amount <= 0) {
    console.error('❌ Amount must be a positive number');
    process.exit(1);
  }

  // PostgreSQL connection configuration
  // Priority: Environment variables > Default values
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'seka_svara_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  };

  console.log('🔐 Database Configuration:');
  console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
  console.log(`   Database: ${dbConfig.database}`);
  console.log(`   User: ${dbConfig.user}`);
  console.log(`   Password: ${dbConfig.password ? '***' : 'NOT SET'}`);
  console.log('');

  if (!dbConfig.password || dbConfig.password === 'postgres') {
    console.log('⚠️  WARNING: Using default password. If this fails:');
    console.log('   1. Check your .env file exists');
    console.log('   2. Ensure DB_PASSWORD is set correctly');
    console.log('   3. Or set it temporarily: SET DB_PASSWORD=your_password (Windows)');
    console.log('');
  }

  const client = new Client(dbConfig);

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Find user by email or username
    const userQuery = `
      SELECT id, username, email, "platformScore" 
      FROM users 
      WHERE email = $1 OR username = $1
      LIMIT 1
    `;
    
    const userResult = await client.query(userQuery, [identifier]);

    if (userResult.rows.length === 0) {
      console.error(`❌ User not found: ${identifier}`);
      await client.end();
      process.exit(1);
    }

    const user = userResult.rows[0];
    const balanceBefore = parseFloat(user.platformScore || 0);
    const balanceAfter = balanceBefore + amount;

    console.log('\n📊 User Information:');
    console.log(`   User ID: ${user.id}`);
    console.log(`   Username: ${user.username || 'N/A'}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Current Balance: ${balanceBefore.toFixed(0)} SEKA`);
    console.log(`   Amount to Add: ${amount.toFixed(0)} SEKA`);
    console.log(`   New Balance: ${balanceAfter.toFixed(0)} SEKA`);
    console.log('');

    // Update user's platformScore
    const updateQuery = `
      UPDATE users 
      SET "platformScore" = $1 
      WHERE id = $2
    `;
    
    await client.query(updateQuery, [balanceAfter, user.id]);
    console.log('✅ Updated user balance');

    // Create transaction record
    const transactionQuery = `
      INSERT INTO platform_score_transactions 
        ("userId", amount, "balanceBefore", "balanceAfter", type, description, "createdAt")
      VALUES 
        ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id
    `;
    
    const transactionResult = await client.query(transactionQuery, [
      user.id,
      amount,
      balanceBefore,
      balanceAfter,
      'bonus', // Type: bonus
      `Admin manual balance addition - Added ${amount} SEKA`,
    ]);

    const transactionId = transactionResult.rows[0].id;
    console.log(`✅ Created transaction record: ${transactionId}`);

    // Verify the update
    const verifyQuery = `SELECT "platformScore" FROM users WHERE id = $1`;
    const verifyResult = await client.query(verifyQuery, [user.id]);
    const newBalance = parseFloat(verifyResult.rows[0].platformScore);

    console.log('\n🎉 SUCCESS!');
    console.log(`   User: ${user.email}`);
    console.log(`   Previous Balance: ${balanceBefore.toFixed(0)} SEKA`);
    console.log(`   Added: ${amount.toFixed(0)} SEKA`);
    console.log(`   New Balance: ${newBalance.toFixed(0)} SEKA`);
    console.log(`   Transaction ID: ${transactionId}`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
    console.log('✅ Database connection closed');
  }
}

addBalance();

