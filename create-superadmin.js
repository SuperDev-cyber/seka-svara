const { Client } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function createSuperAdmin() {
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

    // Check if user already exists
    const checkResult = await client.query(
      `SELECT id, email, username, role FROM users WHERE email = $1`,
      ['superadmin123@seka.com']
    );

    if (checkResult.rows.length > 0) {
      console.log('⚠️  User already exists!');
      console.log(`   Email: ${checkResult.rows[0].email}`);
      console.log(`   Username: ${checkResult.rows[0].username}`);
      console.log(`   Current Role: ${checkResult.rows[0].role}`);
      console.log('');
      
      // Update to admin
      const updateResult = await client.query(
        `UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, email, username, role`,
        ['superadmin123@seka.com']
      );
      
      console.log('✅ USER UPDATED TO ADMIN!');
      console.log('═══════════════════════════════════════');
      console.log(`📧 Email: ${updateResult.rows[0].email}`);
      console.log(`👤 Username: ${updateResult.rows[0].username}`);
      console.log(`👑 Role: ${updateResult.rows[0].role}`);
      console.log(`🆔 ID: ${updateResult.rows[0].id}`);
      console.log('═══════════════════════════════════════\n');
    } else {
      // Create new admin user
      console.log('📝 Creating new admin user...\n');
      
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
      const hashedPassword = await bcrypt.hash('Kingtiger19990427!', saltRounds);
      
      const result = await client.query(
        `INSERT INTO users (username, email, password, role, status, "emailVerified", balance, "totalGamesPlayed", "totalGamesWon", "totalWinnings", level, experience)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, username, email, role`,
        [
          'super_admin',
          'superadmin123@seka.com',
          hashedPassword,
          'admin',
          'active',
          true,
          0,
          0,
          0,
          0,
          1,
          0
        ]
      );

      console.log('🎉 ADMIN USER CREATED SUCCESSFULLY!');
      console.log('═══════════════════════════════════════');
      console.log(`📧 Email: ${result.rows[0].email}`);
      console.log(`👤 Username: ${result.rows[0].username}`);
      console.log(`👑 Role: ${result.rows[0].role}`);
      console.log(`🆔 ID: ${result.rows[0].id}`);
      console.log(`🔑 Password: Kingtiger19990427!`);
      console.log('═══════════════════════════════════════\n');
    }

    console.log('✅ NEXT STEPS:');
    console.log('1. Login with superadmin123@seka.com');
    console.log('2. Password: Kingtiger19990427!');
    console.log('3. Navigate to User Management');
    console.log('4. You will see real users from database!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

createSuperAdmin();

