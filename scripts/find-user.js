/**
 * Find User Script
 * Helps you find your user ID by username or email
 */

const { Client } = require('pg');
require('dotenv').config();

async function findUser(search) {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'seka_svara_db',
  });

  await client.connect();

  const result = await client.query(
    `SELECT id, username, email, role, "platformScore" 
     FROM users 
     WHERE username ILIKE $1 OR email ILIKE $1
     ORDER BY username`,
    [`%${search}%`],
  );

  console.log(`\n📋 Found ${result.rows.length} user(s):\n`);
  
  result.rows.forEach((user, index) => {
    console.log(`${index + 1}. ${user.username} (${user.role})`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Score: ${user.platformScore || 0}`);
    console.log(`   ID: ${user.id}`);
    console.log('');
  });

  await client.end();
}

const search = process.argv[2];

if (!search) {
  console.log('Usage: node scripts/find-user.js USERNAME_OR_EMAIL');
  console.log('Example: node scripts/find-user.js jackson');
  process.exit(0);
}

findUser(search);

