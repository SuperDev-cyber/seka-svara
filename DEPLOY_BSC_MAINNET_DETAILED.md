# Detailed Guide: Deploy to BSC Mainnet

## Overview

This guide provides step-by-step instructions for deploying the Seka Svara smart contracts to Binance Smart Chain (BSC) Mainnet. The deployment process involves deploying three contracts in sequence and linking them together.

## Prerequisites

### 1. Required Accounts & Tools

- **MetaMask or Hardware Wallet**: With BNB for gas fees (recommend at least 0.5 BNB)
- **BSCScan API Key**: For contract verification (get free at https://bscscan.com/apis)
- **Node.js**: Version 16+ installed
- **Git**: For cloning/accessing the repository

### 2. Required Information

Before starting, gather:
- **Deployer Private Key**: The private key of the wallet that will deploy contracts
- **Fee Receiver Address**: Where platform fees will be sent (can be same as deployer)
- **Settler Address**: Backend service address that will settle games (optional, defaults to deployer)

## Step-by-Step Deployment

### Step 1: Navigate to Project Directory

```bash
cd D:\seka-svara\backend\Seka-Svara-CP-For-Server
```

### Step 2: Install Dependencies

First, ensure all Hardhat dependencies are installed:

```bash
npm install

# Install Hardhat toolbox dependencies
npm install --save-dev \
  "@nomicfoundation/hardhat-chai-matchers@^2.0.0" \
  "@nomicfoundation/hardhat-ethers@^3.0.0" \
  "@nomicfoundation/hardhat-network-helpers@^1.0.0" \
  "@nomicfoundation/hardhat-verify@^2.0.0" \
  "@typechain/ethers-v6@^0.5.0" \
  "@typechain/hardhat@^9.0.0" \
  "@types/chai@^4.2.0" \
  "@types/mocha@>=9.1.0" \
  "chai@^4.2.0" \
  "hardhat-gas-reporter@^1.0.8" \
  "solidity-coverage@^0.8.1" \
  "typechain@^8.3.0"
```

### Step 3: Set Environment Variables

Create a `.env` file in the project root (if it doesn't exist):

```bash
# Windows PowerShell
New-Item -Path .env -ItemType File -Force
```

Add the following variables to `.env`:

```env
# BSC Mainnet Deployment
BSC_PRIVATE_KEY=your_deployer_wallet_private_key_here
BSCSCAN_API_KEY=your_bscscan_api_key_here

# Optional: Fee receiver (defaults to deployer if not set)
FEE_RECEIVER=0xYourFeeReceiverAddress

# Optional: Settler address (defaults to deployer if not set)
SETTLER_ADDRESS=0xYourSettlerAddress
```

**⚠️ SECURITY WARNING**: 
- Never commit `.env` file to Git
- Keep your private key secure
- Use a dedicated wallet for deployment (not your main wallet)
- Consider using a hardware wallet for production deployments

### Step 4: Verify Hardhat Configuration

Check that `hardhat.config.js` has the BSC mainnet network configured:

```javascript
networks: {
  bscMainnet: {
    url: 'https://bsc-dataseed.binance.org/',
    chainId: 56,
    accounts: process.env.BSC_PRIVATE_KEY ? [process.env.BSC_PRIVATE_KEY] : [],
  },
}
```

### Step 5: Compile Contracts

Before deploying, compile the contracts to check for errors:

```bash
npx hardhat compile
```

**Expected Output**:
```
Compiling 3 files with 0.8.19
Compiling contracts/UserVault.sol...
Compiling contracts/VaultFactory.sol...
Compiling contracts/SekaSvaraGame.sol...
Compilation finished successfully
```

If compilation fails, fix any errors before proceeding.

### Step 6: Check Deployer Balance

Verify your deployer wallet has sufficient BNB for gas:

```bash
# You can check balance manually on BSCScan or use this script
node -e "
const ethers = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
const wallet = new ethers.Wallet(process.env.BSC_PRIVATE_KEY, provider);
wallet.getBalance().then(balance => {
  console.log('Balance:', ethers.utils.formatEther(balance), 'BNB');
});
"
```

**Recommended**: Have at least 0.5 BNB in your deployer wallet.

### Step 7: Deploy Contracts

Run the deployment script:

```bash
npx hardhat run scripts/deploy-bsc-mainnet.ts --network bscMainnet
```

## What Happens During Deployment

The deployment script performs the following steps in order:

### 1. Deploy UserVault Implementation (Step 1)
- **Contract**: `UserVault.sol`
- **Type**: Implementation contract (used as template for minimal proxies)
- **Gas Cost**: ~2,000,000 gas (~$0.10 USD at current prices)
- **Output**: Implementation contract address

**What it does**:
- Deploys the base UserVault contract
- This contract will be cloned for each user
- Only deployed once (shared by all user vaults)

### 2. Deploy VaultFactory (Step 2)
- **Contract**: `VaultFactory.sol`
- **Parameters**: 
  - `USDT_ADDRESS`: `0x55d398326f99059fF775485246999027B3197955`
  - `FEE_RECEIVER`: Your fee receiver address
- **Gas Cost**: ~3,000,000 gas (~$0.15 USD)
- **Output**: Factory contract address

**What it does**:
- Creates the factory that will generate user vaults
- Stores the UserVault implementation address
- Sets up fee receiver address

### 3. Deploy SekaSvaraGame (Step 3)
- **Contract**: `SekaSvaraGame.sol`
- **Parameters**:
  - `USDT_ADDRESS`: `0x55d398326f99059fF775485246999027B3197955`
  - `VAULT_FACTORY_ADDRESS`: Address from Step 2
  - `FEE_RECEIVER`: Your fee receiver address
- **Gas Cost**: ~4,000,000 gas (~$0.20 USD)
- **Output**: Game contract address

**What it does**:
- Deploys the main game contract
- Links to the VaultFactory
- Sets up platform fee (default 5%)

### 4. Link Game Contract to Factory (Step 4)
- **Action**: Calls `vaultFactory.setGameContract(gameContract.address)`
- **Gas Cost**: ~100,000 gas (~$0.005 USD)
- **Purpose**: Grants game contract permission to interact with user vaults

**What it does**:
- Sets the game contract address in the factory
- Factory will automatically grant GAME_ROLE to new vaults
- Existing vaults (if any) get the role granted

### 5. Grant SETTLER_ROLE (Step 5)
- **Action**: Grants SETTLER_ROLE to backend service address
- **Gas Cost**: ~50,000 gas (~$0.002 USD)
- **Purpose**: Allows backend to settle games

**What it does**:
- Grants SETTLER_ROLE to specified address (or deployer if not set)
- This address can call `settle()` function to complete games

## Expected Deployment Output

```
🚀 Deploying Seka Svara contracts to BSC Mainnet...

📝 Deploying with account: 0xYourDeployerAddress
💰 Account balance: 1.234 BNB

📋 Configuration:
  USDT Address: 0x55d398326f99059fF775485246999027B3197955
  Fee Receiver: 0xYourFeeReceiverAddress

📦 Step 1: Deploying UserVault implementation...
✅ UserVault implementation deployed to: 0xImplementationAddress

📦 Step 2: Deploying VaultFactory...
✅ VaultFactory deployed to: 0xFactoryAddress

📦 Step 3: Deploying SekaSvaraGame...
✅ SekaSvaraGame deployed to: 0xGameAddress

🔗 Step 4: Linking game contract to factory...
✅ Game contract linked to factory

🔐 Step 5: Granting SETTLER_ROLE...
✅ SETTLER_ROLE granted to: 0xSettlerAddress

📄 Deployment info saved to: deployments/bsc-mainnet.json

✅ Deployment complete!

📋 Contract Addresses:
  UserVault Implementation: 0xImplementationAddress
  VaultFactory: 0xFactoryAddress
  SekaSvaraGame: 0xGameAddress

🔍 Verify contracts on BSCScan:
  npx hardhat verify --network bscMainnet 0xImplementationAddress
  npx hardhat verify --network bscMainnet 0xFactoryAddress 0x55d398326f99059fF775485246999027B3197955 0xYourFeeReceiverAddress
  npx hardend verify --network bscMainnet 0xGameAddress 0x55d398326f99059fF775485246999027B3197955 0xFactoryAddress 0xYourFeeReceiverAddress
```

## Post-Deployment Steps

### Step 8: Save Contract Addresses

The deployment script automatically saves addresses to:
- `deployments/bsc-mainnet.json`

**Important**: Save these addresses securely:
- UserVault Implementation: `0x...`
- VaultFactory: `0x...`
- SekaSvaraGame: `0x...`

### Step 9: Verify Contracts on BSCScan

Verification makes contract source code publicly visible and enables interaction via BSCScan.

#### Verify UserVault Implementation

```bash
npx hardhat verify --network bscMainnet \
  0xImplementationAddress
```

**Note**: Implementation contract has no constructor parameters.

#### Verify VaultFactory

```bash
npx hardhat verify --network bscMainnet \
  0xFactoryAddress \
  "0x55d398326f99059fF775485246999027B3197955" \
  "0xYourFeeReceiverAddress"
```

**Parameters**:
1. Factory contract address
2. USDT token address
3. Fee receiver address

#### Verify SekaSvaraGame

```bash
npx hardhat verify --network bscMainnet \
  0xGameAddress \
  "0x55d398326f99059fF775485246999027B3197955" \
  "0xFactoryAddress" \
  "0xYourFeeReceiverAddress"
```

**Parameters**:
1. Game contract address
2. USDT token address
3. VaultFactory address
4. Fee receiver address

**Expected Output**:
```
Successfully submitted source code for contract
contracts/SekaSvaraGame.sol:SekaSvaraGame at 0xGameAddress
for verification on the block explorer. Waiting for verification result...

Successfully verified contract SekaSvaraGame on BSCScan.
https://bscscan.com/address/0xGameAddress#code
```

### Step 10: Update Backend Configuration

Update your backend `.env` or config file:

```env
# Smart Contract Addresses
VAULT_FACTORY_ADDRESS=0xFactoryAddress
GAME_CONTRACT_ADDRESS=0xGameAddress
USER_VAULT_IMPLEMENTATION_ADDRESS=0xImplementationAddress

# Network
BSC_RPC_URL=https://bsc-dataseed.binance.org/
BSC_CHAIN_ID=56
USDT_CONTRACT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
```

### Step 11: Update Frontend Configuration

Update `frontend/seka-svara-cp/src/blockchain/config.ts`:

```typescript
export const BLOCKCHAIN_CONFIG = {
  network: {
    name: 'Binance Smart Chain',
    chainId: 56,
    rpcUrl: 'https://bsc-dataseed.binance.org/',
    blockExplorer: 'https://bscscan.com',
  },
  vaultFactory: {
    address: '0xFactoryAddress', // Add this
  },
  gameContract: {
    address: '0xGameAddress', // Add this
  },
  // ... rest of config
};
```

### Step 12: Test Deployment

#### Test 1: Create User Vault

```javascript
// Using ethers.js
const factory = new ethers.Contract(
  '0xFactoryAddress',
  VaultFactoryABI,
  signer
);

const vaultAddress = await factory.getOrCreateVault(userAddress);
console.log('User vault address:', vaultAddress);
```

#### Test 2: Deposit to Vault

```javascript
const vault = new ethers.Contract(
  vaultAddress,
  UserVaultABI,
  signer
);

const depositTx = await vault.deposit(ethers.utils.parseUnits('10', 18));
await depositTx.wait();
console.log('Deposit successful:', depositTx.hash);
```

#### Test 3: Check Balance

```javascript
const balance = await vault.getAvailableBalance();
console.log('Available balance:', ethers.utils.formatEther(balance));
```

## Troubleshooting

### Error: "Insufficient funds for gas"

**Solution**: Add more BNB to your deployer wallet
- Check balance on BSCScan
- Send BNB from another wallet if needed
- Recommended: 0.5+ BNB for deployment

### Error: "Nonce too high"

**Solution**: Reset nonce or wait
- Check current nonce on BSCScan
- Wait a few minutes and retry
- Or manually set nonce in deployment script

### Error: "Contract verification failed"

**Solution**: 
- Ensure all constructor parameters are correct
- Check contract was deployed successfully
- Try manual verification on BSCScan

### Error: "Compilation failed"

**Solution**:
- Check Solidity version (should be 0.8.19)
- Ensure all OpenZeppelin contracts are installed
- Run `npm install` again

### Error: "Network connection failed"

**Solution**:
- Check internet connection
- Try alternative RPC: `https://bsc-dataseed1.defibit.io/`
- Or: `https://bsc-dataseed1.ninicoin.io/`

## Gas Cost Estimates

| Step | Contract | Estimated Gas | Cost (at 3 gwei) |
|------|----------|---------------|------------------|
| 1 | UserVault Implementation | ~2,000,000 | ~$0.10 |
| 2 | VaultFactory | ~3,000,000 | ~$0.15 |
| 3 | SekaSvaraGame | ~4,000,000 | ~$0.20 |
| 4 | Link Game Contract | ~100,000 | ~$0.005 |
| 5 | Grant SETTLER_ROLE | ~50,000 | ~$0.002 |
| **Total** | | **~9,150,000** | **~$0.46** |

*Note: Gas costs vary with network congestion*

## Security Checklist

Before deploying to mainnet:

- [ ] Tested on BSC Testnet first
- [ ] Reviewed all contract code
- [ ] Verified environment variables are correct
- [ ] Confirmed deployer wallet has sufficient BNB
- [ ] Saved contract addresses securely
- [ ] Verified all contracts on BSCScan
- [ ] Updated backend configuration
- [ ] Updated frontend configuration
- [ ] Tested basic functionality (deposit/withdraw)
- [ ] Documented all addresses and ABIs

## Next Steps After Deployment

1. ✅ Contracts deployed and verified
2. ⏳ Update backend to use new contract addresses
3. ⏳ Update frontend to interact with new contracts
4. ⏳ Test complete user flow (deposit → play → withdraw)
5. ⏳ Create test proof with blockchain links
6. ⏳ Monitor contracts on BSCScan
7. ⏳ Set up event listeners for game events

## Support

If you encounter issues:

1. Check BSCScan for transaction status
2. Review contract code on BSCScan (after verification)
3. Check Hardhat deployment logs
4. Verify all environment variables are set correctly
5. Ensure sufficient BNB balance

---

**Ready to deploy? Follow steps 1-7 above, then verify contracts and update your configuration files.**


