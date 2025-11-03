/**
 * Test Bot Game Script
 * 
 * This script helps you test bot gameplay by:
 * 1. Creating a test table
 * 2. Adding a human player
 * 3. Adding a bot player
 * 4. Starting the game
 * 
 * Usage: node scripts/test-bot-game.js YOUR_USER_ID
 */

const { Client } = require('pg');
require('dotenv').config();

async function testBotGame(humanUserId) {
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

    // Get human user info
    const humanUser = await client.query(
      'SELECT id, username, email, "platformScore" FROM users WHERE id = $1',
      [humanUserId],
    );

    if (humanUser.rows.length === 0) {
      console.error(`❌ User not found with ID: ${humanUserId}`);
      console.log('\n💡 Get your user ID by running:');
      console.log('   node scripts/list-all-users-simple.js');
      process.exit(1);
    }

    const human = humanUser.rows[0];
    console.log(`👤 Human Player: ${human.username}`);
    console.log(`   Score: ${human.platformScore || 0}`);
    console.log('');

    // Get a random bot
    const botResult = await client.query(
      `SELECT id, username, "platformScore" 
       FROM users 
       WHERE role = 'bot' 
       ORDER BY RANDOM() 
       LIMIT 1`,
    );

    if (botResult.rows.length === 0) {
      console.error('❌ No bots found! Run: node scripts/create-bot-users-simple.js');
      process.exit(1);
    }

    const bot = botResult.rows[0];
    console.log(`🤖 Bot Opponent: ${bot.username}`);
    console.log(`   Score: ${bot.platformScore || 0}`);
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Bot Test Setup Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📋 Next Steps:');
    console.log('');
    console.log('1. Start the backend server:');
    console.log('   npm run start:dev');
    console.log('');
    console.log('2. Start the frontend:');
    console.log('   cd ../../frontend/Seka-Svara-CP-For-Client');
    console.log('   npm start');
    console.log('');
    console.log('3. In your browser:');
    console.log('   - Login with your account');
    console.log('   - Create or join a table');
    console.log('   - Use WebSocket to invite bot:');
    console.log('');
    console.log('   socket.emit("invite_bot_to_table", {');
    console.log(`     tableId: "YOUR_TABLE_ID",`);
    console.log(`     botId: "${bot.id}"`);
    console.log('   });');
    console.log('');
    console.log('OR manually add bot using database:');
    console.log('');
    console.log(`UPDATE game_tables SET "player2Id" = '${bot.id}' WHERE id = 'YOUR_TABLE_ID';`);
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

// Get userId from command line
const userId = process.argv[2];

if (!userId) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎮 Bot Game Test Script');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\nUsage: node scripts/test-bot-game.js YOUR_USER_ID');
  console.log('\n💡 To find your user ID, run:');
  console.log('   node scripts/find-user.js YOUR_USERNAME');
  console.log('');
  process.exit(0);
}

testBotGame(userId)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

