/**
 * Simple Bot User Creation Script
 * 
 * This script creates 4 bot users directly using SQL without TypeORM
 * Run: node scripts/create-bot-users-simple.js
 */

const { Client } = require('pg');
const bcrypt = require('bcrypt');

// Load environment variables
require('dotenv').config();

const BOT_USERS = [
  {
    username: 'bot_aggressive',
    email: 'bot_aggressive@seka.ai',
    displayName: 'Aggressive Annie',
    personality: 'aggressive',
  },
  {
    username: 'bot_conservative',
    email: 'bot_conservative@seka.ai',
    displayName: 'Conservative Carl',
    personality: 'conservative',
  },
  {
    username: 'bot_balanced',
    email: 'bot_balanced@seka.ai',
    displayName: 'Balanced Bob',
    personality: 'balanced',
  },
  {
    username: 'bot_unpredictable',
    email: 'bot_unpredictable@seka.ai',
    displayName: 'Random Rita',
    personality: 'unpredictable',
  },
];

async function createBotUsers() {
  // Try different database name possibilities
  const possibleDbNames = [
    process.env.DB_DATABASE,
    process.env.DB_NAME,
    'seka_svara_db',
    'seka_svara',
    'postgres',
  ].filter(Boolean);

  console.log('🔍 Attempting to connect to database...');
  console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`   Port: ${process.env.DB_PORT || 5432}`);
  console.log(`   Username: ${process.env.DB_USERNAME || 'postgres'}`);
  console.log(`   Trying database names: ${possibleDbNames.join(', ')}`);
  console.log('');

  let client;
  let connectedDb;

  // Try to connect to any of the possible database names
  for (const dbName of possibleDbNames) {
    try {
      const testClient = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        user: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: dbName,
      });

      await testClient.connect();
      console.log(`✅ Connected to database: ${dbName}`);
      client = testClient;
      connectedDb = dbName;
      break;
    } catch (error) {
      console.log(`   ⏭️  Database "${dbName}" not found, trying next...`);
    }
  }

  if (!client) {
    console.error('\n❌ Could not connect to any database!');
    console.error('\nPlease check:');
    console.error('1. PostgreSQL is running');
    console.error('2. Database exists (run: psql -U postgres -c "CREATE DATABASE seka_svara_db;"');
    console.error('3. .env file has correct credentials');
    console.error('\nOr create the database:');
    console.error('   psql -U postgres');
    console.error('   CREATE DATABASE seka_svara_db;');
    console.error('   \\q');
    process.exit(1);
  }

  try {
    console.log(`\n📋 Using database: ${connectedDb}\n`);

    // Bot password (hashed) - not used for login
    const botPassword = await bcrypt.hash('bot_secure_password_12345', 10);

    for (const botData of BOT_USERS) {
      console.log(`🤖 Creating bot user: ${botData.displayName}`);

      // Check if bot already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [botData.email],
      );

      let userId;

      if (existingUser.rows.length > 0) {
        console.log(`   ℹ️  Bot already exists, updating...`);
        userId = existingUser.rows[0].id;

        // Update existing bot
        await client.query(
          `UPDATE users SET 
           username = $1,
           password = $2,
           role = 'bot',
           status = 'active',
           "emailVerified" = true
           WHERE id = $3`,
          [botData.username, botPassword, userId],
        );
      } else {
        // Create new bot user
        const result = await client.query(
          `INSERT INTO users (
            username, email, password, role, status, "emailVerified", 
            "totalGamesPlayed", "totalGamesWon", balance
          ) VALUES ($1, $2, $3, 'bot', 'active', true, 0, 0, 0) 
          RETURNING id`,
          [botData.username, botData.email, botPassword],
        );

        userId = result.rows[0].id;
        console.log(`   ✅ Bot user created with ID: ${userId}`);
      }

      // Set platform score to 10,000 (directly on users table)
      await client.query(
        'UPDATE users SET "platformScore" = $1 WHERE id = $2',
        [10000, userId],
      );
      console.log(`   💰 Platform score set to 10,000`);

      console.log(`   ✅ ${botData.displayName} ready to play!`);
      console.log('');
    }

    console.log('✅ All bot users created successfully!');
    console.log('\n📋 Bot Users Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const bots = await client.query(
      `SELECT id, username, email, "platformScore" 
       FROM users 
       WHERE role = 'bot'
       ORDER BY username`,
    );

    bots.rows.forEach((bot, index) => {
      console.log(`${index + 1}. ${bot.username}`);
      console.log(`   Email: ${bot.email}`);
      console.log(`   Score: ${bot.platformScore || 0}`);
      console.log(`   ID: ${bot.id}`);
      console.log('');
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🎮 Bots are ready for single-player mode!');
    console.log('\n💡 Test by running:');
    console.log('   node scripts/test-bot-connection.js');
  } catch (error) {
    console.error('\n❌ Error creating bot users:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  createBotUsers()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { createBotUsers };

