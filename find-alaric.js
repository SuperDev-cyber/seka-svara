const { Client } = require('pg');
require('dotenv').config();

async function findAlaric() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'seka_svara_db',
  });

  try {
    await client.connect();
    
    // Search for alaric user
    const result = await client.query(
      `SELECT id, email, username, role, "emailVerified", balance, "createdAt" 
       FROM users 
       WHERE email = $1 OR email LIKE '%alaric%' OR username LIKE '%alaric%'`,
      ['alaric.0427.hodierne.1999@gmail.com']
    );

    console.log('\n🔍 Searching for alaric user...\n');
    
    if (result.rows.length === 0) {
      console.log('❌ NO USER FOUND with email containing "alaric"');
      console.log('\nThis means the user does NOT exist in the database.');
      console.log('The AdminLogin page will AUTO-CREATE it on first login.\n');
    } else {
      console.log(`✅ FOUND ${result.rows.length} user(s):\n`);
      result.rows.forEach((user, index) => {
        console.log(`${index + 1}. User:`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Balance: ${user.balance} SEKA`);
        console.log(`   Created: ${user.createdAt}\n`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

findAlaric();

