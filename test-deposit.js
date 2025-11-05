/**
 * Test Deposit Script
 * 
 * This script tests the deposit functionality by simulating a deposit
 * and checking if the balance updates correctly.
 * 
 * Usage:
 *   DATABASE_URL="..." node test-deposit.js <userId> <amount>
 * 
 * Example:
 *   DATABASE_URL="..." node test-deposit.js <user-id> 100
 */

const { Client } = require('pg');
require('dotenv').config();

async function testDeposit() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const userId = process.argv[2];
  const depositAmount = parseFloat(process.argv[3]) || 100;

  if (!userId) {
    console.error('❌ Error: userId is required');
    console.error('Usage: node test-deposit.js <userId> <amount>');
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

    // Get user before deposit
    console.log('📊 User state BEFORE deposit:');
    const beforeResult = await client.query(`
      SELECT id, email, balance, "platformScore"
      FROM users
      WHERE id = $1;
    `, [userId]);

    if (beforeResult.rows.length === 0) {
      console.error(`❌ User ${userId} not found`);
      process.exit(1);
    }

    const userBefore = beforeResult.rows[0];
    console.log(`   Email: ${userBefore.email}`);
    console.log(`   Balance: ${userBefore.balance}`);
    console.log(`   Platform Score: ${userBefore.platformScore}\n`);

    // Simulate deposit (add to balance and platformScore)
    const newBalance = Number(userBefore.balance) + depositAmount;
    const newPlatformScore = Number(userBefore.platformScore) + depositAmount;

    console.log(`💰 Simulating deposit of ${depositAmount} USDT...\n`);

    // Update user balance (simulating what confirmDeposit does)
    await client.query(`
      UPDATE users
      SET 
        balance = $1,
        "platformScore" = $2
      WHERE id = $3;
    `, [newBalance, newPlatformScore, userId]);

    // Get user after deposit
    const afterResult = await client.query(`
      SELECT id, email, balance, "platformScore"
      FROM users
      WHERE id = $1;
    `, [userId]);

    const userAfter = afterResult.rows[0];

    console.log('📊 User state AFTER deposit:');
    console.log(`   Email: ${userAfter.email}`);
    console.log(`   Balance: ${userAfter.balance}`);
    console.log(`   Platform Score: ${userAfter.platformScore}\n`);

    // Verify the update
    const balanceDiff = Number(userAfter.balance) - Number(userBefore.balance);
    const scoreDiff = Number(userAfter.platformScore) - Number(userBefore.platformScore);

    console.log('✅ Verification:');
    console.log(`   Balance increase: ${balanceDiff} (expected: ${depositAmount})`);
    console.log(`   Platform Score increase: ${scoreDiff} (expected: ${depositAmount})\n`);

    if (balanceDiff === depositAmount && scoreDiff === depositAmount) {
      console.log('✅ Deposit simulation successful! Balance updated correctly.');
    } else {
      console.error('❌ Deposit simulation failed! Balance not updated correctly.');
      console.error(`   Expected: ${depositAmount}, Got: Balance=${balanceDiff}, PlatformScore=${scoreDiff}`);
    }

    // Check for string concatenation bug (if balance is string)
    if (typeof userAfter.balance === 'string') {
      const balanceStr = String(userAfter.balance);
      const beforeStr = String(userBefore.balance);
      if (balanceStr === beforeStr + String(depositAmount)) {
        console.error('\n❌ STRING CONCATENATION BUG DETECTED!');
        console.error(`   Balance is being concatenated as strings: "${beforeStr}" + "${depositAmount}" = "${balanceStr}"`);
        console.error('   This causes the "100100" bug when depositing 100 to balance 100');
      }
    }

    // Check wallet table if it exists
    const walletCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'wallets';
    `);

    if (walletCheck.rows.length > 0) {
      console.log('\n💼 Checking wallet table...');
      const walletResult = await client.query(`
        SELECT id, balance, "availableBalance", "lockedBalance"
        FROM wallets
        WHERE "userId" = $1;
      `, [userId]);

      if (walletResult.rows.length > 0) {
        const wallet = walletResult.rows[0];
        console.log(`   Wallet Balance: ${wallet.balance}`);
        console.log(`   Available Balance: ${wallet.availableBalance}`);
        console.log(`   Locked Balance: ${wallet.lockedBalance}`);
      } else {
        console.log('   No wallet found for this user');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the test
testDeposit();

