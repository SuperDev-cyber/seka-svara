const { Client } = require('pg');
require('dotenv').config();

async function addSampleScores() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'seka_svara_db',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Get all users
    const usersResult = await client.query('SELECT id, email, "platformScore" FROM users');
    const users = usersResult.rows;

    console.log(`📋 Found ${users.length} users\n`);
    console.log('🎯 Adding sample score transactions...\n');

    let transactionCount = 0;

    for (const user of users) {
      const currentScore = parseFloat(user.platformScore) || 0;
      let newScore = currentScore;

      // Transaction 1: Initial welcome bonus
      const bonus1 = 1000;
      newScore += bonus1;
      await client.query(
        `INSERT INTO platform_score_transactions 
         ("userId", amount, "balanceBefore", "balanceAfter", type, description, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '10 days')`,
        [user.id, bonus1, currentScore, newScore, 'bonus', 'Welcome Bonus - New User']
      );
      transactionCount++;

      // Transaction 2: Won a game
      const earnings1 = 350;
      const balanceBefore2 = newScore;
      newScore += earnings1;
      await client.query(
        `INSERT INTO platform_score_transactions 
         ("userId", amount, "balanceBefore", "balanceAfter", type, description, "referenceType", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - INTERVAL '8 days')`,
        [user.id, earnings1, balanceBefore2, newScore, 'earned', 'Won game: High Stakes Table', 'game']
      );
      transactionCount++;

      // Transaction 3: Spent on features
      const spent1 = -150;
      const balanceBefore3 = newScore;
      newScore += spent1;
      await client.query(
        `INSERT INTO platform_score_transactions 
         ("userId", amount, "balanceBefore", "balanceAfter", type, description, "referenceType", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - INTERVAL '6 days')`,
        [user.id, spent1, balanceBefore3, newScore, 'spent', 'Purchased Premium Avatar', 'purchase']
      );
      transactionCount++;

      // Transaction 4: Another game win
      const earnings2 = 500;
      const balanceBefore4 = newScore;
      newScore += earnings2;
      await client.query(
        `INSERT INTO platform_score_transactions 
         ("userId", amount, "balanceBefore", "balanceAfter", type, description, "referenceType", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - INTERVAL '4 days')`,
        [user.id, earnings2, balanceBefore4, newScore, 'earned', 'Won game: Tournament Round 1', 'game']
      );
      transactionCount++;

      // Transaction 5: Daily login bonus
      const bonus2 = 100;
      const balanceBefore5 = newScore;
      newScore += bonus2;
      await client.query(
        `INSERT INTO platform_score_transactions 
         ("userId", amount, "balanceBefore", "balanceAfter", type, description, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '2 days')`,
        [user.id, bonus2, balanceBefore5, newScore, 'bonus', 'Daily Login Bonus']
      );
      transactionCount++;

      // Transaction 6: Spent on tournament entry
      const spent2 = -200;
      const balanceBefore6 = newScore;
      newScore += spent2;
      await client.query(
        `INSERT INTO platform_score_transactions 
         ("userId", amount, "balanceBefore", "balanceAfter", type, description, "referenceType", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - INTERVAL '1 day')`,
        [user.id, spent2, balanceBefore6, newScore, 'spent', 'Tournament Entry Fee', 'tournament']
      );
      transactionCount++;

      // Transaction 7: Recent game win
      const earnings3 = 750;
      const balanceBefore7 = newScore;
      newScore += earnings3;
      await client.query(
        `INSERT INTO platform_score_transactions 
         ("userId", amount, "balanceBefore", "balanceAfter", type, description, "referenceType", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - INTERVAL '12 hours')`,
        [user.id, earnings3, balanceBefore7, newScore, 'earned', 'Won game: Elite Championship', 'game']
      );
      transactionCount++;

      // Update user's final Seka-Svara Score
      await client.query(
        'UPDATE users SET "platformScore" = $1 WHERE id = $2',
        [newScore, user.id]
      );

      console.log(`✅ ${user.email}`);
      console.log(`   Initial Score: ${currentScore}`);
      console.log(`   Final Score: ${newScore}`);
      console.log(`   Transactions Added: 7`);
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`✅ Successfully added ${transactionCount} score transactions!`);
    console.log(`📊 Updated ${users.length} user Seka-Svara Scores`);
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

addSampleScores();

