/**
 * Add 'bot' role to database enum
 */

const { Client } = require('pg');
require('dotenv').config();

async function addBotRole() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'seka_svara_db',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Add 'bot' role to enum
    await client.query("ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'bot';");
    
    console.log('✅ Added "bot" role to users_role_enum');

    // Verify
    const result = await client.query("SELECT enum_range(NULL::users_role_enum);");
    console.log('\n📋 Available roles:', result.rows[0].enum_range);
    
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('ℹ️  "bot" role already exists in enum');
    } else {
      console.error('❌ Error:', error.message);
      throw error;
    }
  } finally {
    await client.end();
  }
}

addBotRole()
  .then(() => {
    console.log('\n✅ Database updated successfully!');
    console.log('\n💡 Now run: node scripts/create-bot-users-simple.js');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  });

