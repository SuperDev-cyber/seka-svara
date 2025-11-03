const { Client } = require('pg');
require('dotenv').config();

async function updateRole() {
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

    // Update role to admin
    const result = await client.query(
      `UPDATE users SET role = 'admin', "emailVerified" = true, "updatedAt" = NOW()
       WHERE email = $1
       RETURNING id, email, username, role`,
      ['alaric.0427.hodierne.1999@gmail.com']
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('\n🎉 USER UPDATED TO ADMIN!');
      console.log('═══════════════════════════════════════');
      console.log(`📧 Email: ${user.email}`);
      console.log(`👤 Username: ${user.username}`);
      console.log(`👑 Role: ${user.role}`);
      console.log(`🆔 ID: ${user.id}`);
      console.log('═══════════════════════════════════════');
      console.log('\n✅ NOW LOGIN WITH:');
      console.log('   Email: alaric.0427.hodierne.1999@gmail.com');
      console.log('   Password: Kingtiger19990427!');
      console.log('   URL: http://localhost:5173/admin/login\n');
    } else {
      console.log('❌ User not found');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

updateRole();

