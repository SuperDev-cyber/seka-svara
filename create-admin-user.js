const { Client } = require('pg');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function createAdminUser() {
  const connectionString = process.env.DATABASE_URL;

  const client = connectionString
    ? new Client({ connectionString, ssl: { rejectUnauthorized: false } })
    : new Client({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'seka_svara_db',
      });

  const email = 'admin@seka.com';
  const username = 'admin';
  const plainPassword = 'password';

  try {
    await client.connect();
    console.log('✅ Connected to database');

    await client.query('BEGIN');

    // Remove any existing user with same email
    await client.query('DELETE FROM users WHERE email = $1', [email]);

    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const passwordHash = await bcrypt.hash(plainPassword, saltRounds);

    const now = new Date();
    const result = await client.query(
      `INSERT INTO users (
        id, username, email, password, role, status,
        "emailVerified", balance, "totalGamesPlayed",
        "totalGamesWon", "totalWinnings", level, experience,
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15
      ) RETURNING id, email, username, role`,
      [
        uuidv4(),
        username,
        email,
        passwordHash,
        'admin',
        'active',
        true,
        0,
        0,
        0,
        0,
        1,
        0,
        now,
        now,
      ]
    );

    await client.query('COMMIT');

    const u = result.rows[0];
    console.log('🎉 Admin user created');
    console.log(`   Email: ${u.email}`);
    console.log(`   Username: ${u.username}`);
    console.log(`   Role: ${u.role}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Error creating admin:', err.message);
  } finally {
    await client.end();
  }
}

createAdminUser();


