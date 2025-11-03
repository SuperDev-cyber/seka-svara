const { Client } = require('pg');
require('dotenv').config();

async function deleteUser() {
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

    const result = await client.query(
      `DELETE FROM users WHERE email = $1 RETURNING id, email, username, role`,
      ['alaric.0427.hodierne.1999@gmail.com']
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('\n🗑️  DELETED USER:');
      console.log(`   Email: ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Username: ${user.username}`);
      console.log('\n✅ Now you can login fresh and it will create an ADMIN account!');
    } else {
      console.log('❌ No user found with that email.');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

deleteUser();

