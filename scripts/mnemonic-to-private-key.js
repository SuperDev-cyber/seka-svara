/**
 * Convert Mnemonic Phrase to Private Key
 * 
 * Usage:
 *   node scripts/mnemonic-to-private-key.js
 * 
 * Or with environment variable:
 *   MNEMONIC="your twelve word phrase here" node scripts/mnemonic-to-private-key.js
 */

const { ethers } = require('ethers');
const readline = require('readline');

// Create readline interface for secure input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function mnemonicToPrivateKey(mnemonic, accountIndex = 0) {
  try {
    // Validate mnemonic
    if (!ethers.utils.isValidMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic phrase');
    }

    // Derive wallet from mnemonic
    const wallet = ethers.Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${accountIndex}`);
    
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: mnemonic,
      accountIndex: accountIndex
    };
  } catch (error) {
    throw new Error(`Failed to derive private key: ${error.message}`);
  }
}

async function main() {
  let mnemonic = process.env.MNEMONIC;

  // If not in environment variable, prompt user
  if (!mnemonic) {
    console.log('⚠️  Enter your mnemonic phrase (12 or 24 words)');
    console.log('   (Input will be hidden for security)\n');
    
    mnemonic = await new Promise((resolve) => {
      // Hide input (doesn't work perfectly on Windows, but better than nothing)
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      
      let input = '';
      process.stdin.on('data', (char) => {
        if (char === '\n' || char === '\r') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          resolve(input.trim());
        } else if (char === '\u0003') { // Ctrl+C
          process.exit();
        } else {
          input += char;
        }
      });
    });

    // Alternative: simple prompt (less secure but works on Windows)
    mnemonic = await new Promise((resolve) => {
      rl.question('Enter mnemonic phrase: ', (answer) => {
        resolve(answer.trim());
      });
    });
  }

  // Normalize mnemonic (remove extra spaces, convert to lowercase)
  mnemonic = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');

  // Ask for account index (default 0 = first account)
  const accountIndex = process.env.ACCOUNT_INDEX 
    ? parseInt(process.env.ACCOUNT_INDEX) 
    : 0;

  try {
    const result = mnemonicToPrivateKey(mnemonic, accountIndex);

    console.log('\n✅ Successfully derived private key!\n');
    console.log('📋 Wallet Information:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Address:     ', result.address);
    console.log('Private Key: ', result.privateKey);
    console.log('Account #:   ', result.accountIndex);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📝 Add this to your .env file:');
    console.log(`BSC_PRIVATE_KEY=${result.privateKey}\n`);

    console.log('⚠️  SECURITY WARNING:');
    console.log('   - Never share your private key or mnemonic');
    console.log('   - Never commit .env to Git');
    console.log('   - Store securely (password manager)');
    console.log('   - Use dedicated wallet for deployment\n');

    // Optionally check balance
    if (process.env.CHECK_BALANCE === 'true') {
      console.log('💰 Checking balance on BSC Mainnet...');
      const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
      const wallet = new ethers.Wallet(result.privateKey, provider);
      const balance = await wallet.getBalance();
      console.log(`   Balance: ${ethers.utils.formatEther(balance)} BNB\n`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nMake sure:');
    console.error('  - Mnemonic is 12 or 24 words');
    console.error('  - Words are separated by spaces');
    console.error('  - All words are valid BIP39 words');
    process.exit(1);
  }

  rl.close();
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { mnemonicToPrivateKey };


