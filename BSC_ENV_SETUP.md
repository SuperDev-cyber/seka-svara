# BSC Environment Variables Setup Guide

## Problem
You're seeing this error:
```
BSC service not initialized. Please configure BSC_PRIVATE_KEY and BSC_USDT_CONTRACT.
```

This means the backend needs environment variables to connect to Binance Smart Chain for processing withdrawals.

## Solution: Add Environment Variables to Render.com

### Step 1: Get Your Admin Wallet Private Key

You need a wallet that will hold USDT to send to users when they withdraw. This wallet must:
- Have USDT (BEP20) tokens for withdrawals
- Have BNB for gas fees
- Be secure (use a dedicated wallet, not your personal one)

**Option A: Use Existing Wallet**
1. Open MetaMask or your wallet
2. Export the private key for the wallet that will hold USDT
3. **⚠️ SECURITY:** Never share this private key publicly

**Option B: Create New Dedicated Wallet**
1. Create a new wallet in MetaMask
2. Fund it with:
   - USDT (BEP20) tokens for withdrawals
   - BNB for gas fees (recommend at least 0.5 BNB)
3. Export the private key

### Step 2: Add Environment Variables to Render.com

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com
   - Select your service: `seka-svara-2` (or your backend service name)

2. **Navigate to Environment Tab**
   - Click on your service
   - Go to **Environment** tab in the left sidebar

3. **Add Required Variables**

   Click **Add Environment Variable** for each:

   #### Variable 1: BSC_PRIVATE_KEY
   - **Key:** `BSC_PRIVATE_KEY`
   - **Value:** `0xYourPrivateKeyHere` (the private key from Step 1)
   - **Important:** Must start with `0x` and be 66 characters long
   - **Example:** `0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`

   #### Variable 2: BSC_USDT_CONTRACT
   - **Key:** `BSC_USDT_CONTRACT`
   - **Value:** `0x55d398326f99059fF775485246999027B3197955` (USDT on BSC Mainnet)
   - **Note:** This is the official USDT contract address on BSC Mainnet

   #### Variable 3: BSC_RPC_URL (Optional)
   - **Key:** `BSC_RPC_URL`
   - **Value:** `https://bsc-dataseed.binance.org/`
   - **Note:** This is optional - the service has a default, but it's good to set it explicitly

### Step 3: Save and Redeploy

1. **Save all environment variables**
2. **Redeploy the service:**
   - Go to **Manual Deploy** tab
   - Click **Deploy latest commit**
   - Or wait for auto-deploy (if enabled)

### Step 4: Verify Setup

After redeployment, check the logs:
1. Go to **Logs** tab in Render
2. Look for: `BSC service initialized successfully`
3. If you see this, the setup is correct!

## Important Security Notes

⚠️ **CRITICAL SECURITY:**
- **Never commit** private keys to Git
- **Never share** private keys publicly
- **Use a dedicated wallet** for the admin wallet (not your personal wallet)
- **Keep BNB in the wallet** for gas fees
- **Monitor the wallet balance** regularly

## Testing Withdrawals

After setup:
1. Ensure your admin wallet has USDT (BEP20) tokens
2. Ensure your admin wallet has BNB for gas fees
3. Try a small withdrawal to test
4. Check the transaction on BSCScan: https://bscscan.com

## Troubleshooting

### Error: "BSC service not initialized"
- ✅ Check that `BSC_PRIVATE_KEY` is set correctly (starts with `0x`, 66 chars)
- ✅ Check that `BSC_USDT_CONTRACT` is set to `0x55d398326f99059fF775485246999027B3197955`
- ✅ Redeploy the service after setting variables

### Error: "BEP20: transfer amount exceeds balance" ⚠️ **MOST COMMON**
**This error means your admin wallet doesn't have enough USDT to send to users.**

**How to fix:**
1. **Check your admin wallet balance:**
   - Go to BSCScan: https://bscscan.com
   - Enter your admin wallet address (the one associated with `BSC_PRIVATE_KEY`)
   - Check the USDT (BEP20) balance
   
2. **Fund your admin wallet:**
   - Send USDT (BEP20) tokens to your admin wallet address
   - The wallet needs enough USDT to cover all user withdrawals
   - **Example:** If users want to withdraw 1000 USDT total, your wallet needs at least 1000 USDT
   
3. **Also ensure BNB for gas:**
   - Your admin wallet also needs BNB to pay for transaction fees
   - Recommend at least 0.5 BNB for gas fees
   - Each withdrawal transaction costs ~0.0001-0.001 BNB in gas

4. **Monitor wallet balance:**
   - Set up alerts to notify you when USDT balance is low
   - Regularly top up the wallet to ensure withdrawals don't fail

### Error: "Insufficient funds" or "Insufficient balance"
- ✅ Ensure admin wallet has USDT (BEP20) tokens
- ✅ Ensure admin wallet has BNB for gas fees (at least 0.1 BNB recommended)

### Error: "Transaction failed"
- ✅ Check BSC network status
- ✅ Verify RPC URL is accessible
- ✅ Check wallet has enough BNB for gas

## Quick Reference

**Required Environment Variables:**
```env
BSC_PRIVATE_KEY=0xYourPrivateKeyHere
BSC_USDT_CONTRACT=0x55d398326f99059fF775485246999027B3197955
BSC_RPC_URL=https://bsc-dataseed.binance.org/
```

**USDT Contract Addresses:**
- **BSC Mainnet:** `0x55d398326f99059fF775485246999027B3197955`
- **BSC Testnet:** `0x337610d27c682E347C9cD60BD4b3b107C9d34dDd` (for testing)

**RPC URLs:**
- **BSC Mainnet:** `https://bsc-dataseed.binance.org/`
- **BSC Testnet:** `https://data-seed-prebsc-1-s1.binance.org:8545/`

---

**Need Help?** Check the logs in Render dashboard for detailed error messages.

