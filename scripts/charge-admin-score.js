/**
 * Charge Admin Score Script
 * 
 * Adds 10,000 platform score to all admin accounts
 */

const { Client } = require('pg');
require('dotenv').config();

async function chargeAdminScore() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'seka_svara_db',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Get all admin users
    const admins = await client.query(
      `SELECT id, username, email, "platformScore" 
       FROM users 
       WHERE role = 'admin'
       ORDER BY username`,
    );

    if (admins.rows.length === 0) {
      console.log('❌ No admin users found!');
      return;
    }

    console.log(`📋 Found ${admins.rows.length} admin(s):\n`);

    for (const admin of admins.rows) {
      const currentScore = parseFloat(admin.platformScore) || 0;
      const newScore = 10000;

      console.log(`👑 ${admin.username}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Current Score: ${currentScore.toFixed(0)}`);
      console.log(`   New Score: ${newScore.toFixed(0)}`);

      // Update platform score
      await client.query(
        'UPDATE users SET "platformScore" = $1 WHERE id = $2',
        [newScore, admin.id],
      );

      console.log(`   ✅ Charged ${newScore.toFixed(0)} points!`);
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All admins charged successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Show final summary
    const updated = await client.query(
      `SELECT username, "platformScore" 
       FROM users 
       WHERE role = 'admin'
       ORDER BY username`,
    );

    console.log('\n📊 Final Admin Scores:');
    updated.rows.forEach((admin, index) => {
      console.log(`   ${index + 1}. ${admin.username}: ${parseFloat(admin.platformScore).toFixed(0)} points`);
    });
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

chargeAdminScore()
  .then(() => {
    console.log('✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });

