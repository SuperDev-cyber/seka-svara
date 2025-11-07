# How to Get Your Deployer Private Key

## ⚠️ SECURITY WARNING

**NEVER share your private key with anyone!**
- Private key = Full control over your wallet
- If exposed, anyone can steal all funds
- Use a **dedicated deployment wallet** (not your main wallet)
- Consider using a hardware wallet for production

## Method 1: Extract from MetaMask (Most Common)

### Step 1: Open MetaMask Extension
1. Click the MetaMask extension icon in your browser
2. Unlock your wallet with your password

### Step 2: Access Account Details
1. Click the **three dots (⋮)** next to your account name
2. Select **"Account details"**

### Step 3: Export Private Key
1. Click **"Export Private Key"**
2. Enter your MetaMask password
3. Click **"Confirm"**
4. Your private key will be displayed (starts with `0x`)

### Step 4: Copy Private Key
- Click the copy icon or select and copy
- **Format**: `0x1234567890abcdef...` (64 hex characters after 0x)

**Example**:
```
0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

## Method 2: Extract from Trust Wallet

### Mobile App:
1. Open Trust Wallet app
2. Go to **Settings** → **Wallets**
3. Select your wallet
4. Tap **"Show Recovery Phrase"** or **"Export Private Key"**
5. Enter your password/biometric
6. Copy the private key

### Desktop:
1. Open Trust Wallet
2. Settings → Security → Export Private Key
3. Enter password
4. Copy the key

## Method 3: Extract from Hardware Wallet (Ledger/Trezor)

### ⚠️ Important Note
Hardware wallets **do NOT expose private keys** for security reasons. For deployment:

**Option A: Use MetaMask with Hardware Wallet**
1. Connect hardware wallet to MetaMask
2. MetaMask will use hardware wallet for signing
3. You don't need the private key (more secure!)

**Option B: Use Hardhat with Hardware Wallet**
- Configure Hardhat to use hardware wallet directly
- No private key needed

## Method 4: Create a New Dedicated Deployment Wallet

### Recommended Approach: Create Fresh Wallet

**Why?**
- Separate from your main funds
- Lower risk if compromised
- Can be funded with exact amount needed

### Using MetaMask:

1. **Create New Account**:
   - MetaMask → Account menu → "Create Account"
   - Name it "Deployment Wallet" or "Seka Svara Deployer"

2. **Export Private Key** (as shown in Method 1)

3. **Fund with BNB**:
   - Send 0.5-1 BNB to this wallet for gas fees
   - Use your main wallet to send BNB

### Using Hardhat (Programmatic):

```bash
# Generate a new wallet
npx hardhat node

# Or use this script:
node -e "
const ethers = require('ethers');
const wallet = ethers.Wallet.createRandom();
console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);
console.log('Mnemonic:', wallet.mnemonic.phrase);
"
```

**Save the output securely!**

## Method 5: From Recovery Phrase (Mnemonic)

If you have a 12/24-word recovery phrase:

```javascript
// Using ethers.js
const ethers = require('ethers');
const mnemonic = "your twelve word recovery phrase here";
const wallet = ethers.Wallet.fromMnemonic(mnemonic);
console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);
```

**⚠️ Warning**: Recovery phrase gives access to ALL accounts derived from it!

## Setting Up Your .env File

Once you have your private key:

### Step 1: Create .env File

```bash
# Windows PowerShell
cd D:\seka-svara\backend\Seka-Svara-CP-For-Server
New-Item -Path .env -ItemType File -Force
```

### Step 2: Add Private Key

Open `.env` in a text editor and add:

```env
# Deployer Wallet Private Key
BSC_PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# BSCScan API Key (get from https://bscscan.com/apis)
BSCSCAN_API_KEY=your_bscscan_api_key_here

# Fee Receiver (where platform fees go - can be same as deployer)
FEE_RECEIVER=0xYourFeeReceiverAddress

# Settler Address (backend service - optional)
SETTLER_ADDRESS=0xYourSettlerAddress
```

### Step 3: Verify .env is in .gitignore

**CRITICAL**: Ensure `.env` is in `.gitignore`:

```bash
# Check if .gitignore exists and contains .env
cat .gitignore | grep -i env

# If not, add it:
echo ".env" >> .gitignore
```

## Security Best Practices

### ✅ DO:
- Use a **dedicated deployment wallet** (not your main wallet)
- Fund it with **only the BNB needed** for deployment (~0.5-1 BNB)
- Store private key in **secure password manager** (1Password, LastPass, etc.)
- Use **hardware wallet** for production deployments
- **Delete** private key from `.env` after deployment (if not needed for future updates)
- Use **environment variables** on your server (not hardcoded)

### ❌ DON'T:
- **Never** commit `.env` to Git
- **Never** share private key in chat/email
- **Never** use your main wallet's private key
- **Never** store private key in plain text files (except temporarily for deployment)
- **Never** screenshot private keys
- **Never** use private key from a wallet with significant funds

## Alternative: Using Hardware Wallet (Most Secure)

If you have a Ledger or Trezor:

### Option 1: MetaMask + Hardware Wallet
1. Connect hardware wallet to MetaMask
2. Use MetaMask account (no private key needed)
3. Configure Hardhat to use MetaMask provider

### Option 2: Hardhat + Hardware Wallet Plugin
```bash
npm install @ledgerhq/hardhat-ledger
```

Then in `hardhat.config.js`:
```javascript
require("@ledgerhq/hardhat-ledger");

module.exports = {
  networks: {
    bscMainnet: {
      url: 'https://bsc-dataseed.binance.org/',
      chainId: 56,
      ledgerAccounts: [0], // Use first account
    },
  },
};
```

## Testing Your Private Key

Before deploying, verify your private key works:

```bash
# Test connection (don't run on mainnet!)
node -e "
const ethers = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
const wallet = new ethers.Wallet(process.env.BSC_PRIVATE_KEY, provider);
console.log('Address:', wallet.address);
wallet.getBalance().then(balance => {
  console.log('Balance:', ethers.utils.formatEther(balance), 'BNB');
});
"
```

## Quick Checklist

Before deployment:
- [ ] Created dedicated deployment wallet
- [ ] Exported private key securely
- [ ] Added private key to `.env` file
- [ ] Verified `.env` is in `.gitignore`
- [ ] Funded wallet with 0.5-1 BNB
- [ ] Tested private key connection
- [ ] Stored private key backup securely (password manager)
- [ ] Ready to deploy!

## Troubleshooting

### "Invalid private key"
- Ensure it starts with `0x`
- Must be 66 characters total (0x + 64 hex chars)
- No spaces or newlines

### "Insufficient funds"
- Check wallet balance on BSCScan
- Send more BNB to deployment wallet

### "Nonce too high"
- Wait a few minutes
- Or check current nonce on BSCScan

## Summary

**Easiest Method**: 
1. Create new account in MetaMask
2. Export private key from MetaMask
3. Add to `.env` file
4. Fund with BNB
5. Deploy!

**Most Secure Method**:
- Use hardware wallet with MetaMask
- No private key exposure needed

---

**Remember**: Private key = Full wallet control. Treat it like cash - if someone gets it, they can steal everything!


