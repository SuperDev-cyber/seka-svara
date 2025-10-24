# Smart Contracts

This directory contains the Solidity smart contracts for the Seka Svara platform.

## Contracts

### 1. GameEscrow.sol
- Holds betting pot securely
- Releases funds to winner
- Handles platform fee distribution
- Supports both BEP20 and TRC20

### 2. USDT Integration
- Interfaces with USDT contracts on BSC and Tron
- Handles deposits and withdrawals

## Development

### Setup
```bash
cd src/contracts
npm install
npx hardhat compile
```

### Testing
```bash
npx hardhat test
```

### Deployment

#### BSC Testnet
```bash
npx hardhat run scripts/deploy-bsc.ts --network bscTestnet
```

#### Tron Testnet
```bash
npx hardhat run scripts/deploy-tron.ts --network tronTestnet
```

## Security Considerations

1. **Reentrancy Protection** - All contracts use ReentrancyGuard
2. **Access Control** - Only authorized addresses can release escrow
3. **Time Locks** - Automated refunds after timeout
4. **Emergency Pause** - Owner can pause contracts in emergency
5. **Audit** - Contracts should be audited before mainnet deployment

## Contract Addresses

### Testnet
- BSC Escrow: `TBD`
- Tron Escrow: `TBD`

### Mainnet
- BSC Escrow: `TBD`
- Tron Escrow: `TBD`

