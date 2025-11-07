# Quick Reference: BSC Mainnet Deployment

## One-Command Deployment (After Setup)

```bash
npx hardhat run scripts/deploy-bsc-mainnet.ts --network bscMainnet
```

## Pre-Deployment Checklist

- [ ] `.env` file created with:
  - `BSC_PRIVATE_KEY=0x...`
  - `BSCSCAN_API_KEY=...`
  - `FEE_RECEIVER=0x...` (optional)
  - `SETTLER_ADDRESS=0x...` (optional)
- [ ] Deployer wallet has ≥0.5 BNB
- [ ] Dependencies installed (`npm install`)
- [ ] Contracts compiled (`npx hardhat compile`)

## Deployment Flow

```
1. Deploy UserVault Implementation
   └─> Address: 0xImplementation
   
2. Deploy VaultFactory
   └─> Uses: Implementation address
   └─> Address: 0xFactory
   
3. Deploy SekaSvaraGame
   └─> Uses: Factory address
   └─> Address: 0xGame
   
4. Link Game → Factory
   └─> Factory.setGameContract(0xGame)
   
5. Grant SETTLER_ROLE
   └─> Game.grantRole(SETTLER_ROLE, settlerAddress)
```

## Contract Addresses (Save These!)

After deployment, save these addresses:

```
UserVault Implementation: 0x...
VaultFactory: 0x...
SekaSvaraGame: 0x...
```

## Verification Commands

```bash
# 1. UserVault Implementation
npx hardhat verify --network bscMainnet 0xImplementationAddress

# 2. VaultFactory
npx hardhat verify --network bscMainnet 0xFactoryAddress \
  "0x55d398326f99059fF775485246999027B3197955" \
  "0xFeeReceiverAddress"

# 3. SekaSvaraGame
npx hardhat verify --network bscMainnet 0xGameAddress \
  "0x55d398326f99059fF775485246999027B3197955" \
  "0xFactoryAddress" \
  "0xFeeReceiverAddress"
```

## Common Issues

| Issue | Solution |
|-------|----------|
| Insufficient funds | Add BNB to deployer wallet |
| Compilation error | Run `npm install` again |
| Verification failed | Check constructor parameters match |
| Network error | Try different RPC endpoint |

## Gas Costs

- Total: ~9,150,000 gas (~$0.46 at 3 gwei)
- Have at least 0.5 BNB for safety

## Post-Deployment

1. Save addresses from `deployments/bsc-mainnet.json`
2. Verify all contracts on BSCScan
3. Update backend `.env` with contract addresses
4. Update frontend config with contract addresses
5. Test basic functionality

---

**Full details**: See `DEPLOY_BSC_MAINNET_DETAILED.md`


