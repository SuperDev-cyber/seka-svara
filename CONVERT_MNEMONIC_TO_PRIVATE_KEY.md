# Convert Mnemonic Phrase to Private Key

## What You Have

You have a **mnemonic phrase** (also called recovery phrase or seed phrase):
```
viable light abuse fatal scatter burden orchard citizen suggest job road machine
```

This is **12 words** that can be converted to a private key.

## Quick Method: Using the Script

### Step 1: Run the Conversion Script

```bash
cd D:\seka-svara\backend\Seka-Svara-CP-For-Server
node scripts/mnemonic-to-private-key.js
```

### Step 2: Enter Your Mnemonic

When prompted, paste your mnemonic phrase:
```
viable light abuse fatal scatter burden orchard citizen suggest job road machine
```

### Step 3: Get Your Private Key

The script will output:
- Your wallet address
- Your private key (starts with `0x`)
- Ready-to-use `.env` format

## Alternative: Using Environment Variable

```bash
# Windows PowerShell
$env:MNEMONIC="viable light abuse fatal scatter burden orchard citizen suggest job road machine"
node scripts/mnemonic-to-private-key.js
```

## Manual Method: Using Node.js

Create a file `convert.js`:

```javascript
const { ethers } = require('ethers');

// Your mnemonic phrase
const mnemonic = "viable light abuse fatal scatter burden orchard citizen suggest job road machine";

// Derive private key (account index 0 = first account)
const wallet = ethers.Wallet.fromMnemonic(mnemonic);

console.log("Address:", wallet.address);
console.log("Private Key:", wallet.privateKey);
```

Run it:
```bash
node convert.js
```

## Using Different Account Index

If you need a different account (not the first one):

```javascript
const { ethers } = require('ethers');

const mnemonic = "viable light abuse fatal scatter burden orchard citizen suggest job road machine";

// Account 0 (first account)
const wallet0 = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/0");
console.log("Account 0:", wallet0.address, wallet0.privateKey);

// Account 1 (second account)
const wallet1 = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/1");
console.log("Account 1:", wallet1.address, wallet1.privateKey);
```

## Add to .env File

Once you have the private key, add it to your `.env` file:

```env
BSC_PRIVATE_KEY=0xYourPrivateKeyHere
BSCSCAN_API_KEY=your_bscscan_api_key
FEE_RECEIVER=0xYourFeeReceiverAddress
```

## Verify It Works

Test that your private key is correct:

```bash
node -e "
const ethers = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
const wallet = new ethers.Wallet('YOUR_PRIVATE_KEY_HERE', provider);
console.log('Address:', wallet.address);
wallet.getBalance().then(balance => {
  console.log('Balance:', ethers.utils.formatEther(balance), 'BNB');
});
"
```

## Security Reminders

⚠️ **IMPORTANT**:
- **Never share** your mnemonic phrase or private key
- **Never commit** `.env` to Git
- **Use dedicated wallet** for deployment (not your main wallet)
- **Store securely** (password manager, encrypted file)

## Troubleshooting

### "Invalid mnemonic"
- Check all words are correct
- Ensure 12 or 24 words
- Words separated by single spaces
- All lowercase

### "Failed to derive"
- Verify mnemonic is valid BIP39 phrase
- Check for typos
- Try account index 0, 1, 2, etc.

### Need Different Account?
If the first account doesn't have funds, try:
- Account 0: `m/44'/60'/0'/0/0`
- Account 1: `m/44'/60'/0'/0/1`
- Account 2: `m/44'/60'/0'/0/2`

## Quick Reference

**Your Mnemonic** (12 words):
```
viable light abuse fatal scatter burden orchard citizen suggest job road machine
```

**To Convert**:
```bash
node scripts/mnemonic-to-private-key.js
```

**Output Format**:
```
Address:     0x1234...
Private Key: 0xabcd...
```

**Add to .env**:
```
BSC_PRIVATE_KEY=0xabcd...
```

---

**Ready to deploy!** Once you have the private key in your `.env` file, you can proceed with deployment.

