const { Client } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

/**
 * Generate a unique BEP20 (Binance Smart Chain) address
 */
function generateBEP20Address(userId) {
  const seed = `${userId}-BEP20-${Date.now()}`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return `0x${hash.substring(0, 40)}`;
}

/**
 * Generate a unique TRC20 (Tron) address
 */
function generateTRC20Address(userId) {
  const seed = `${userId}-TRC20-${Date.now()}`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  
  const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let address = 'T';
  
  for (let i = 0; i < 33; i++) {
    const hexPair = hash.substring(i * 2, i * 2 + 2);
    const charIndex = parseInt(hexPair, 16) % base58Chars.length;
    address += base58Chars[charIndex];
  }
  
  return address;
}

/**
 * Generate a unique ERC20 (Ethereum) address
 */
function generateERC20Address(userId) {
  const seed = `${userId}-ERC20-${Date.now()}`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return `0x${hash.substring(0, 40)}`;
}

async function generateWalletAddresses() {
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

    // Get all users without wallet addresses
    const usersResult = await client.query(
      `SELECT id, email FROM users 
       WHERE "bep20WalletAddress" IS NULL 
       OR "trc20WalletAddress" IS NULL 
       OR "erc20WalletAddress" IS NULL`
    );

    console.log(`📋 Found ${usersResult.rows.length} users without wallet addresses\n`);

    if (usersResult.rows.length === 0) {
      console.log('✅ All users already have wallet addresses!');
      return;
    }

    console.log('🔄 Generating wallet addresses...\n');

    for (const user of usersResult.rows) {
      const bep20 = generateBEP20Address(user.id);
      const trc20 = generateTRC20Address(user.id);
      const erc20 = generateERC20Address(user.id);

      await client.query(
        `UPDATE users 
         SET "bep20WalletAddress" = $1, 
             "trc20WalletAddress" = $2, 
             "erc20WalletAddress" = $3
         WHERE id = $4`,
        [bep20, trc20, erc20, user.id]
      );

      console.log(`✅ ${user.email}`);
      console.log(`   BEP20: ${bep20}`);
      console.log(`   TRC20: ${trc20}`);
      console.log(`   ERC20: ${erc20}`);
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`✅ Generated wallet addresses for ${usersResult.rows.length} users!`);
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

generateWalletAddresses();

