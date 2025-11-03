const { Client } = require('pg');
require('dotenv').config();

async function checkColumns() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'seka_svara_db',
  });

  await client.connect();
  
  const result = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    ORDER BY ordinal_position
  `);
  
  console.log('📋 Users table columns:');
  result.rows.forEach(row => console.log(`   ${row.column_name} (${row.data_type})`));
  
  await client.end();
}

checkColumns();

