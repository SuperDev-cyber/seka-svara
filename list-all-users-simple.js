const { Client } = require('pg');
require('dotenv').config();

async function listAllUsers() {
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

    const result = await client.query(
      `SELECT id, username, email, role FROM users ORDER BY "createdAt" DESC LIMIT 10`
    );

    console.log('📋 LATEST 10 USERS IN DATABASE:');
    console.log('═══════════════════════════════════════════════════════════════');
    
    if (result.rows.length === 0) {
      console.log('No users found.');
    } else {
      result.rows.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.username} (${user.email})`);
        console.log(`   Role: ${user.role}`);
        console.log(`   ID: ${user.id}`);
      });
    }
    console.log('\n═══════════════════════════════════════════════════════════════\n');
    console.log(`Total users found: ${result.rows.length}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

listAllUsers();

