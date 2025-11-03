const { Client } = require('pg');
require('dotenv').config();

/**
 * Get current time in Uzbekistan timezone (UTC+5)
 * Uzbekistan does not observe DST
 */
function getUzbekistanTime() {
  const now = new Date();
  // Uzbekistan is UTC+5
  const uzbekistanOffset = 5 * 60; // 5 hours in minutes
  const localOffset = now.getTimezoneOffset(); // Minutes difference from UTC
  
  // Calculate Uzbekistan time
  const uzbekistanTime = new Date(now.getTime() + (uzbekistanOffset + localOffset) * 60 * 1000);
  
  return uzbekistanTime;
}

/**
 * Get time 1 hour before current Uzbekistan time
 */
function getOneHourAgoUzbekistan() {
  const uzbekistanTime = getUzbekistanTime();
  const oneHourAgo = new Date(uzbekistanTime.getTime() - (60 * 60 * 1000)); // Subtract 1 hour
  return oneHourAgo;
}

async function updateScoresWithUzbekistanTime() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'seka_svara_db',
  });

  try {
    await client.connect();
    
    const currentUzbekistanTime = getUzbekistanTime();
    const oneHourAgo = getOneHourAgoUzbekistan();
    
    console.log('\n✅ Connected to database');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌍 UZBEKISTAN TIMEZONE (UTC+5)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⏰ Current Uzbekistan Time: ${currentUzbekistanTime.toISOString()}`);
    console.log(`   Local Display: ${currentUzbekistanTime.toLocaleString('en-US', { timeZone: 'Asia/Tashkent' })}`);
    console.log(`📅 Transaction Time (1 hour ago): ${oneHourAgo.toISOString()}`);
    console.log(`   Local Display: ${oneHourAgo.toLocaleString('en-US', { timeZone: 'Asia/Tashkent' })}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Get all users
    const usersResult = await client.query(
      'SELECT id, email, balance, "platformScore" FROM users ORDER BY "createdAt" DESC'
    );
    const users = usersResult.rows;

    console.log(`📋 Found ${users.length} users\n`);
    console.log('🔄 Updating Seka-Svara Scores with Uzbekistan timezone...\n');

    let totalTransactions = 0;
    let totalScoreIncrease = 0;

    for (const user of users) {
      const currentBalance = parseFloat(user.balance) || 0;
      const currentPlatformScore = parseFloat(user.platformScore) || 0;

      console.log(`👤 Processing: ${user.email}`);
      console.log(`   Current Balance: ${currentBalance} SEKA`);
      console.log(`   Current Seka-Svara Score: ${currentPlatformScore} points`);

      // Delete existing sample transactions for this user (if any)
      await client.query(
        'DELETE FROM platform_score_transactions WHERE "userId" = $1',
        [user.id]
      );

      let newPlatformScore = currentPlatformScore;

      // Transaction 1: Initial deposit bonus (recorded 1 hour ago)
      const bonus1 = 1000;
      const balanceBefore1 = newPlatformScore;
      newPlatformScore += bonus1;

      await client.query(
        `INSERT INTO platform_score_transactions 
         ("userId", amount, "balanceBefore", "balanceAfter", type, description, "referenceType", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          user.id,
          bonus1,
          balanceBefore1,
          newPlatformScore,
          'bonus',
          'Initial deposit bonus - Welcome to Seka Svara platform',
          'platform_bonus',
          oneHourAgo.toISOString()
        ]
      );
      totalTransactions++;

      // Transaction 2: Game winnings (recorded 1 hour ago + 5 minutes)
      const earnings1 = 350;
      const balanceBefore2 = newPlatformScore;
      newPlatformScore += earnings1;
      const timestamp2 = new Date(oneHourAgo.getTime() + 5 * 60 * 1000);

      await client.query(
        `INSERT INTO platform_score_transactions 
         ("userId", amount, "balanceBefore", "balanceAfter", type, description, "referenceType", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          user.id,
          earnings1,
          balanceBefore2,
          newPlatformScore,
          'earned',
          'Won game: High Stakes Table - Tournament Victory',
          'game',
          timestamp2.toISOString()
        ]
      );
      totalTransactions++;

      // Transaction 3: Platform activity bonus (recorded 1 hour ago + 10 minutes)
      const bonus2 = 150;
      const balanceBefore3 = newPlatformScore;
      newPlatformScore += bonus2;
      const timestamp3 = new Date(oneHourAgo.getTime() + 10 * 60 * 1000);

      await client.query(
        `INSERT INTO platform_score_transactions 
         ("userId", amount, "balanceBefore", "balanceAfter", type, description, "referenceType", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          user.id,
          bonus2,
          balanceBefore3,
          newPlatformScore,
          'bonus',
          'Daily activity bonus - Active player reward',
          'platform_bonus',
          timestamp3.toISOString()
        ]
      );
      totalTransactions++;

      // Transaction 4: Another game win (recorded 1 hour ago + 15 minutes)
      const earnings2 = 500;
      const balanceBefore4 = newPlatformScore;
      newPlatformScore += earnings2;
      const timestamp4 = new Date(oneHourAgo.getTime() + 15 * 60 * 1000);

      await client.query(
        `INSERT INTO platform_score_transactions 
         ("userId", amount, "balanceBefore", "balanceAfter", type, description, "referenceType", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          user.id,
          earnings2,
          balanceBefore4,
          newPlatformScore,
          'earned',
          'Won game: Elite Championship - Grand Prize',
          'game',
          timestamp4.toISOString()
        ]
      );
      totalTransactions++;

      // Calculate total increase for this user
      const scoreIncrease = newPlatformScore - currentPlatformScore;
      totalScoreIncrease += scoreIncrease;

      // Update user's Seka-Svara Score in database
      await client.query(
        'UPDATE users SET "platformScore" = $1 WHERE id = $2',
        [newPlatformScore, user.id]
      );

      console.log(`   ✅ Seka-Svara Score Updated: ${currentPlatformScore} → ${newPlatformScore}`);
      console.log(`   📈 Increase: +${scoreIncrease} points`);
      console.log(`   📝 Transactions Added: 4`);
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ COMPLETED SUCCESSFULLY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👥 Users Updated: ${users.length}`);
    console.log(`📊 Total Transactions Created: ${totalTransactions}`);
    console.log(`📈 Total Seka-Svara Score Increase: +${totalScoreIncrease} points`);
    console.log(`⏰ Timestamp: ${oneHourAgo.toLocaleString('en-US', { timeZone: 'Asia/Tashkent' })} (Uzbekistan Time)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🎯 Next Steps:');
    console.log('1. Start backend: npm run start:dev');
    console.log('2. Login to admin panel: http://localhost:5173/admin/login');
    console.log('3. Go to Score Management to see transactions');
    console.log('4. All timestamps will show in Uzbekistan timezone (UTC+5)');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

updateScoresWithUzbekistanTime();

