const { Client } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

/**
 * Generate a unique TRC20 (Tron) address
 */
function generateTRC20Address(userId) {
  const seed = `${userId}-TRC20-${Date.now()}`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  
  const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let address = 'T';
  
  // Generate 33 more characters (we have 64 hex chars, can make 32 pairs safely)
  for (let i = 0; i < 32; i++) {
    const hexPair = hash.substring(i * 2, i * 2 + 2);
    const charIndex = parseInt(hexPair, 16) % base58Chars.length;
    address += base58Chars[charIndex];
  }
  
  // Add one more character from the remaining hash
  const lastChar = parseInt(hash.substring(64), 16) % base58Chars.length || 0;
  address += base58Chars[lastChar];
  
  return address;
}

async function regenerateTRC20() {
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

    // Get all users with broken TRC20 addresses
    const usersResult = await client.query(
      `SELECT id, email, "trc20WalletAddress" FROM users 
       WHERE "trc20WalletAddress" LIKE '%undefined'`
    );

    console.log(`📋 Found ${usersResult.rows.length} users with broken TRC20 addresses\n`);

    if (usersResult.rows.length === 0) {
      console.log('✅ All TRC20 addresses are correct!');
      return;
    }

    console.log('🔄 Regenerating TRC20 addresses...\n');

    for (const user of usersResult.rows) {
      const trc20 = generateTRC20Address(user.id);

      await client.query(
        `UPDATE users SET "trc20WalletAddress" = $1 WHERE id = $2`,
        [trc20, user.id]
      );

      console.log(`✅ ${user.email}`);
      console.log(`   Old: ${user.trc20WalletAddress}`);
      console.log(`   New: ${trc20}`);
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`✅ Fixed ${usersResult.rows.length} TRC20 addresses!`);
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

regenerateTRC20();

