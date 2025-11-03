/**
 * List All Users Script
 * 
 * Shows all users in the database with their details
 * Useful for finding user IDs for testing
 */

const { Client } = require('pg');
require('dotenv').config();

async function listAllUsers() {
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

    // Get all users
    const result = await client.query(
      `SELECT 
        id, 
        username, 
        email, 
        role, 
        status,
        "platformScore",
        "totalGamesPlayed",
        "totalGamesWon",
        "emailVerified",
        "createdAt"
       FROM users 
       ORDER BY 
         CASE role 
           WHEN 'admin' THEN 1
           WHEN 'moderator' THEN 2
           WHEN 'user' THEN 3
           WHEN 'bot' THEN 4
           ELSE 5
         END,
         username`,
    );

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 Total Users: ${result.rows.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Group users by role
    const usersByRole = {
      admin: [],
      moderator: [],
      user: [],
      bot: [],
    };

    result.rows.forEach(user => {
      if (usersByRole[user.role]) {
        usersByRole[user.role].push(user);
      }
    });

    // Display users by role
    Object.keys(usersByRole).forEach(role => {
      const users = usersByRole[role];
      if (users.length === 0) return;

      const roleEmoji = {
        admin: '👑',
        moderator: '🛡️',
        user: '👤',
        bot: '🤖',
      };

      console.log(`${roleEmoji[role]} ${role.toUpperCase()}S (${users.length}):`);
      console.log('');

      users.forEach((user, index) => {
        const verified = user.emailVerified ? '✅' : '❌';
        const gamesPlayed = user.totalGamesPlayed || 0;
        const gamesWon = user.totalGamesWon || 0;
        const winRate = gamesPlayed > 0 ? ((gamesWon / gamesPlayed) * 100).toFixed(1) : '0.0';
        
        console.log(`  ${index + 1}. ${user.username}`);
        console.log(`     ID: ${user.id}`);
        console.log(`     Email: ${user.email} ${verified}`);
        console.log(`     Status: ${user.status}`);
        console.log(`     Platform Score: ${user.platformScore || 0}`);
        console.log(`     Games: ${gamesPlayed} played, ${gamesWon} won (${winRate}% win rate)`);
        console.log(`     Created: ${new Date(user.createdAt).toLocaleDateString()}`);
        console.log('');
      });

      console.log('');
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 To test bot gameplay with a specific user:');
    console.log('   node scripts/test-bot-game.js USER_ID');
    console.log('');
    console.log('Example:');
    if (usersByRole.user.length > 0) {
      console.log(`   node scripts/test-bot-game.js ${usersByRole.user[0].id}`);
    }
    console.log('');

    // Summary
    console.log('📊 Summary:');
    console.log(`   👑 Admins: ${usersByRole.admin.length}`);
    console.log(`   🛡️  Moderators: ${usersByRole.moderator.length}`);
    console.log(`   👤 Users: ${usersByRole.user.length}`);
    console.log(`   🤖 Bots: ${usersByRole.bot.length}`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

listAllUsers()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  });

