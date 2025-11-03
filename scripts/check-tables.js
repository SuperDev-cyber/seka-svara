const { Client } = require('pg');
require('dotenv').config();

async function checkTables() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'seka_svara_db',
  });

  await client.connect();
  
  const result = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND (table_name LIKE '%score%' OR table_name LIKE '%balance%' OR table_name LIKE '%platform%')
    ORDER BY table_name
  `);
  
  console.log('📋 Tables related to score/balance:');
  result.rows.forEach(row => console.log(`   - ${row.table_name}`));
  
  await client.end();
}

checkTables();

