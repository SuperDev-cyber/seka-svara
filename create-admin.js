const { Client } = require('pg');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function createAdmin() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'seka_svara_db',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // First, delete any existing user with this email
    await client.query(
      `DELETE FROM users WHERE email = $1`,
      ['alaric.0427.hodierne.1999@gmail.com']
    );
    console.log('🗑️  Deleted any existing user with this email');

    // Hash the password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    const hashedPassword = await bcrypt.hash('Kingtiger19990427!', saltRounds);

    // Create the admin user
    const result = await client.query(
      `INSERT INTO users (
        id, username, email, password, role, status, 
        "emailVerified", balance, "totalGamesPlayed", 
        "totalGamesWon", "totalWinnings", level, experience,
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()
      ) RETURNING id, email, username, role`,
      [
        uuidv4(),
        'admin',
        'alaric.0427.hodierne.1999@gmail.com',
        hashedPassword,
        'admin',  // ← ADMIN ROLE
        'active',
        true,     // Email verified
        0,        // Balance
        0,        // Total games played
        0,        // Total games won
        0,        // Total winnings
        1,        // Level
        0         // Experience
      ]
    );

    const user = result.rows[0];
    console.log('\n🎉 ADMIN USER CREATED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════');
    console.log(`📧 Email: ${user.email}`);
    console.log(`👤 Username: ${user.username}`);
    console.log(`🔑 Password: Kingtiger19990427!`);
    console.log(`👑 Role: ${user.role}`);
    console.log(`🆔 ID: ${user.id}`);
    console.log('═══════════════════════════════════════');
    console.log('\n✅ You can now login at: http://localhost:5173/admin/login\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

createAdmin();

