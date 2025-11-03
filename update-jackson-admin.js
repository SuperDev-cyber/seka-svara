const { Client } = require('pg');
require('dotenv').config();

async function updateJacksonToAdmin() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'seka_svara_db',
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    const result = await client.query(
      `UPDATE users SET role = 'admin' WHERE id = $1 OR email = $2 RETURNING id, email, username, role`,
      ['5e19de95-f5fa-4db3-805a-decb5feb126c', 'jackson19990427@gmail.com']
    );

    if (result.rows.length > 0) {
      console.log('✅ USER UPDATED TO ADMIN!');
      console.log('═══════════════════════════════════════');
      result.rows.forEach(user => {
        console.log(`Email: ${user.email}`);
        console.log(`Username: ${user.username}`);
        console.log(`Role: ${user.role} 👑`);
        console.log(`ID: ${user.id}`);
      });
      console.log('═══════════════════════════════════════\n');
      console.log('🔄 NEXT STEPS:');
      console.log('1. Logout from the admin panel');
      console.log('2. Login again');
      console.log('3. The page will refresh with real user data!\n');
    } else {
      console.log('❌ User not found');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

updateJacksonToAdmin();

