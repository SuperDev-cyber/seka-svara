const { Client } = require('pg');
require('dotenv').config();

async function checkSuperAdmins() {
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
      `SELECT email, username, role FROM users WHERE email LIKE '%superadmin%' OR email LIKE '%admin%' ORDER BY email`
    );

    console.log('📋 ALL ADMIN-RELATED USERS:');
    console.log('═══════════════════════════════════════════════════════════════');
    
    result.rows.forEach((user, index) => {
      const roleIcon = user.role === 'admin' ? '👑' : '👤';
      console.log(`\n${index + 1}. ${roleIcon} ${user.email}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Role: ${user.role}`);
    });
    
    console.log('\n═══════════════════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkSuperAdmins();

