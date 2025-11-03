const { Client } = require('pg');
require('dotenv').config();

async function checkUser() {
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

    // Check all alaric users
    const result = await client.query(
      `SELECT id, email, username, role FROM users WHERE email LIKE '%alaric%'`
    );

    console.log(`Found ${result.rows.length} users:\n`);
    result.rows.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Role: ${user.role}\n`);
    });

    // Now update by ID directly
    if (result.rows.length > 0) {
      const userId = result.rows[0].id;
      console.log(`\nUpdating user ID: ${userId} to ADMIN...\n`);
      
      const updateResult = await client.query(
        `UPDATE users SET role = 'admin', "emailVerified" = true, "updatedAt" = NOW()
         WHERE id = $1
         RETURNING id, email, username, role`,
        [userId]
      );

      if (updateResult.rows.length > 0) {
        const user = updateResult.rows[0];
        console.log('SUCCESS! USER UPDATED TO ADMIN!');
        console.log('═══════════════════════════════════════');
        console.log(`Email: ${user.email}`);
        console.log(`Username: ${user.username}`);
        console.log(`Role: ${user.role}`);
        console.log(`ID: ${user.id}`);
        console.log('═══════════════════════════════════════\n');
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkUser();

