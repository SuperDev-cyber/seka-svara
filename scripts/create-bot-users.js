const { DataSource } = require('typeorm');
const bcrypt = require('bcrypt');

/**
 * Create Bot Users with 10,000 Platform Score
 * 
 * This script creates computer opponent accounts for single-player mode
 */

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
  // Load environment variables
  require('dotenv').config();
  
  console.log('📋 Database Configuration:');
  console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`   Port: ${process.env.DB_PORT || 5432}`);
  console.log(`   Database: ${process.env.DB_DATABASE || process.env.DB_NAME || 'postgres'}`);
  console.log(`   Username: ${process.env.DB_USERNAME || 'postgres'}`);
  console.log('');
  
  // Create database connection
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || process.env.DB_NAME || 'postgres',
    entities: ['src/**/*.entity.ts'],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');

    // Bot password (hashed) - not used for login
    const botPassword = await bcrypt.hash('bot_secure_password_12345', 10);

    for (const botData of BOT_USERS) {
      console.log(`\n🤖 Creating bot user: ${botData.displayName}`);

      // Check if bot already exists
      const existingUser = await dataSource.query(
        'SELECT id FROM users WHERE email = $1',
        [botData.email],
      );

      let userId;

      if (existingUser.length > 0) {
        console.log(`   ℹ️  Bot already exists, updating...`);
        userId = existingUser[0].id;

        // Update existing bot
        await dataSource.query(
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
        const result = await dataSource.query(
          `INSERT INTO users (
            username, email, password, role, status, "emailVerified", 
            "totalGamesPlayed", "totalGamesWon", balance
          ) VALUES ($1, $2, $3, 'bot', 'active', true, 0, 0, 0) 
          RETURNING id`,
          [botData.username, botData.email, botPassword],
        );

        userId = result[0].id;
        console.log(`   ✅ Bot user created with ID: ${userId}`);
      }

      // Set platform score to 10,000
      const existingScore = await dataSource.query(
        'SELECT * FROM platform_scores WHERE "userId" = $1',
        [userId],
      );

      if (existingScore.length > 0) {
        await dataSource.query(
          'UPDATE platform_scores SET score = $1 WHERE "userId" = $2',
          [10000, userId],
        );
        console.log(`   💰 Platform score updated to 10,000`);
      } else {
        await dataSource.query(
          `INSERT INTO platform_scores ("userId", score, "lastUpdated")
           VALUES ($1, $2, NOW())`,
          [userId, 10000],
        );
        console.log(`   💰 Platform score set to 10,000`);
      }

      console.log(`   ✅ ${botData.displayName} ready to play!`);
    }

    console.log('\n✅ All bot users created successfully!');
    console.log('\n📋 Bot Users Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const bots = await dataSource.query(
      `SELECT u.id, u.username, u.email, ps.score 
       FROM users u 
       LEFT JOIN platform_scores ps ON u.id = ps."userId"
       WHERE u.role = 'bot'
       ORDER BY u.username`,
    );

    bots.forEach((bot, index) => {
      console.log(`${index + 1}. ${bot.username}`);
      console.log(`   Email: ${bot.email}`);
      console.log(`   Score: ${bot.score || 0}`);
      console.log(`   ID: ${bot.id}`);
      console.log('');
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🎮 Bots are ready for single-player mode!');

  } catch (error) {
    console.error('❌ Error creating bot users:', error);
    throw error;
  } finally {
    await dataSource.destroy();
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
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { createBotUsers };

