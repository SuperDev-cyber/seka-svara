# Contract Addresses & Verification

## BSC Mainnet

### Contracts
- **UserVault Implementation**: `TBD` (deploy first)
- **VaultFactory**: `TBD` (deploy second)
- **SekaSvaraGame**: `TBD` (deploy third)

### Configuration
- **USDT Token**: `0x55d398326f99059fF775485246999027B3197955`
- **Fee Receiver**: `TBD` (set during deployment)
- **Chain ID**: 56

### Verification Commands
```bash
# After deployment, verify contracts:
npx hardhat verify --network bscMainnet <USER_VAULT_IMPLEMENTATION_ADDRESS>
npx hardhat verify --network bscMainnet <VAULT_FACTORY_ADDRESS> 0x55d398326f99059fF775485246999027B3197955 <FEE_RECEIVER>
npx hardhat verify --network bscMainnet <GAME_CONTRACT_ADDRESS> 0x55d398326f99059fF775485246999027B3197955 <VAULT_FACTORY_ADDRESS> <FEE_RECEIVER>
```

## TRON Mainnet

### Contracts
- **UserVault Implementation**: `TBD`
- **VaultFactory**: `TBD`
- **SekaSvaraGame**: `TBD`

### Configuration
- **USDT Token**: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`
- **Fee Receiver**: `TBD`
- **Network**: TRON Mainnet

### Verification
- Verify on Tronscan after deployment
- Source code will be provided for verification

## Roles

### VaultFactory
- **Owner**: Deployer address
- **Admin**: Factory contract (automatic)

### SekaSvaraGame
- **Owner**: Deployer address
- **Admin**: Deployer address
- **Settler**: Backend service address (granted after deployment)

### UserVault (per user)
- **Owner**: User address
- **Admin**: Factory contract
- **Game Role**: Game contract (granted automatically)

## ABI Files

ABI files will be generated after compilation and saved to:
- `artifacts/contracts/UserVault.sol/UserVault.json`
- `artifacts/contracts/VaultFactory.sol/VaultFactory.json`
- `artifacts/contracts/SekaSvaraGame.sol/SekaSvaraGame.json`


