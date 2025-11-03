const { Client } = require('pg');
require('dotenv').config();

async function checkWallets() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'seka_svara_db',
  });

  try {
    await client.connect();
    console.log('\n📋 Wallet Addresses in Database:');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const result = await client.query(
      `SELECT email, "bep20WalletAddress", "trc20WalletAddress", "erc20WalletAddress" 
       FROM users 
       ORDER BY "createdAt" DESC 
       LIMIT 7`
    );

    result.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   BEP20: ${user.bep20WalletAddress || 'NULL'}`);
      console.log(`   TRC20: ${user.trc20WalletAddress || 'NULL'}`);
      console.log(`   ERC20: ${user.erc20WalletAddress || 'NULL'}`);
      console.log('');
    });

    console.log('═══════════════════════════════════════════════════════════════');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkWallets();

