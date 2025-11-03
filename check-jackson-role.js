const { Client } = require('pg');
require('dotenv').config();

async function checkJacksonRole() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'seka_svara_db',
  });

  try {
    await client.connect();
    
    // Check jackson user
    const result = await client.query(
      `SELECT id, email, username, role FROM users WHERE email = $1 OR id = $2`,
      ['jackson19990427@gmail.com', '5e19de95-f5fa-4db3-805a-decb5feb126c']
    );

    console.log('\n🔍 Jackson User Status:\n');
    
    if (result.rows.length === 0) {
      console.log('❌ NO USER FOUND');
    } else {
      result.rows.forEach((user) => {
        console.log(`Email: ${user.email}`);
        console.log(`ID: ${user.id}`);
        console.log(`Username: ${user.username}`);
        console.log(`Role: ${user.role}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkJacksonRole();

