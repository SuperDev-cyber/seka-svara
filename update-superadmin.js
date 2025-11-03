const { Client } = require('pg');
require('dotenv').config();

async function updateSuperAdminToAdmin() {
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

    // First check if user exists
    const checkResult = await client.query(
      `SELECT id, email, username, role FROM users WHERE email = $1`,
      ['superadmin123@seka.com']
    );

    if (checkResult.rows.length === 0) {
      console.log('❌ USER NOT FOUND: superadmin123@seka.com');
      console.log('This user does not exist in the database.\n');
      console.log('Please register this user first, then run this script again.');
      return;
    }

    console.log('📋 Found user:');
    console.log(`   Email: ${checkResult.rows[0].email}`);
    console.log(`   Username: ${checkResult.rows[0].username}`);
    console.log(`   Current Role: ${checkResult.rows[0].role}`);
    console.log('');

    // Update to admin
    const result = await client.query(
      `UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, email, username, role`,
      ['superadmin123@seka.com']
    );

    if (result.rows.length > 0) {
      console.log('🎉 USER UPDATED TO ADMIN!');
      console.log('═══════════════════════════════════════');
      result.rows.forEach(user => {
        console.log(`📧 Email: ${user.email}`);
        console.log(`👤 Username: ${user.username}`);
        console.log(`👑 Role: ${user.role}`);
        console.log(`🆔 ID: ${user.id}`);
      });
      console.log('═══════════════════════════════════════\n');
      console.log('🔄 NEXT STEPS:');
      console.log('1. If already logged in, LOGOUT from the admin panel');
      console.log('2. LOGIN again with superadmin123@seka.com');
      console.log('3. Navigate to User Management');
      console.log('4. You will see real users from database!\n');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

updateSuperAdminToAdmin();

