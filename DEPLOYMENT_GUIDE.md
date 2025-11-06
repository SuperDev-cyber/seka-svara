# Seka Svara On-Chain Deployment Guide

## Architecture Summary

### Per-User Address Generation
**Method**: CREATE2 Minimal Proxy Pattern

Each user gets a **deterministic vault address** that can be calculated off-chain:
```
vaultAddress = CREATE2(
    salt = keccak256(userAddress),
    bytecode = UserVault minimal proxy
)
```

**Benefits**:
- Same address every time (deterministic)
- Gas efficient (minimal proxy ~45KB vs full contract)
- Funds segregated per user
- Address can be calculated without on-chain lookup

### Contract Structure

1. **UserVault** (Implementation) - Base contract for user vaults
2. **VaultFactory** - Creates and manages user vaults
3. **SekaSvaraGame** - Main game contract for betting and settlement

## Contract Functions & Events

### UserVault

#### Functions
- `deposit(uint256 amount)` - User deposits USDT
- `withdraw(uint256 amount)` - User withdraws USDT (automatic, no approval)
- `placeBet(uint256 amount, bytes32 gameId)` - Place bet (game contract only)
- `settle(uint256 winnings, bytes32 gameId)` - Settle game (game contract only)
- `turnover()` - Returns total wagered amount
- `getAvailableBalance()` - Returns available balance (considering playthrough)
- `setPlaythroughMultiplier(uint256)` - Update playthrough (admin only)

#### Events
```solidity
event Deposit(address indexed user, uint256 amount, uint256 timestamp);
event Withdraw(address indexed user, uint256 amount, uint256 timestamp);
event BetPlaced(address indexed user, uint256 amount, bytes32 indexed gameId);
event GameSettled(address indexed user, uint256 winnings, bytes32 indexed gameId);
event PlaythroughUpdated(uint256 oldMultiplier, uint256 newMultiplier);
```

### SekaSvaraGame

#### Functions
- `createGame(bytes32 gameId, address[] players)` - Create new game (admin only)
- `placeBet(bytes32 gameId, uint256 amount)` - Place bet in game
- `settle(bytes32 gameId, address winner)` - Settle game (settler only)
- `turnover(address user)` - Get user's total wagered
- `setPlatformFee(uint256)` - Update platform fee (admin only)
- `setFeeReceiver(address)` - Update fee receiver (admin only)

#### Events
```solidity
event GameCreated(bytes32 indexed gameId, address[] players, uint256 timestamp);
event BetPlaced(bytes32 indexed gameId, address indexed player, uint256 amount);
event GameSettled(bytes32 indexed gameId, address indexed winner, uint256 payout, uint256 fee);
```

## Roles

### UserVault
- `DEFAULT_ADMIN_ROLE`: Factory contract
- `ADMIN_ROLE`: Factory contract
- `GAME_ROLE`: Game contract (for placing bets and settling)

### SekaSvaraGame
- `DEFAULT_ADMIN_ROLE`: Owner/deployer
- `ADMIN_ROLE`: Can create games, update fees
- `SETTLER_ROLE`: Can settle games (backend service)

### VaultFactory
- `Owner`: Deployer (can pause, update game contract)

## Deployment Steps

### Prerequisites
1. Set environment variables:
   ```bash
   export BSC_PRIVATE_KEY="your_private_key"
   export BSCSCAN_API_KEY="your_bscscan_api_key"
   export FEE_RECEIVER="fee_receiver_address"
   export SETTLER_ADDRESS="settler_address"  # Optional, defaults to deployer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile contracts:
   ```bash
   npx hardhat compile
   ```

### Deploy to BSC Mainnet

```bash
npx hardhat run scripts/deploy-bsc-mainnet.ts --network bscMainnet
```

### Verify Contracts

After deployment, verify on BSCScan:

```bash
# UserVault Implementation
npx hardhat verify --network bscMainnet <USER_VAULT_IMPLEMENTATION_ADDRESS>

# VaultFactory
npx hardhat verify --network bscMainnet <VAULT_FACTORY_ADDRESS> 0x55d398326f99059fF775485246999027B3197955 <FEE_RECEIVER>

# SekaSvaraGame
npx hardhat verify --network bscMainnet <GAME_CONTRACT_ADDRESS> 0x55d398326f99059fF775485246999027B3197955 <VAULT_FACTORY_ADDRESS> <FEE_RECEIVER>
```

## Playthrough System

### Default: 0 (No Requirement)
- Users can withdraw anytime (minus fees)
- No wagering requirement by default

### Configuration
- Playthrough multiplier stored on-chain in UserVault
- Can be set per-user via admin panel
- Formula: `requiredWagering = (totalDeposited - totalWithdrawn) * multiplier / 100`
- Example: multiplier = 130 means 1.3x playthrough

### On-Chain Tracking
- `totalWagered` tracked in UserVault contract
- Updated via `BetPlaced` events
- Fully transparent and verifiable on-chain

## Security Features

- ✅ ReentrancyGuard on all state-changing functions
- ✅ AccessControl for role-based permissions
- ✅ Pausable for emergency stops
- ✅ SafeERC20 for token transfers
- ✅ Automatic withdrawals (no backend can block)
- ✅ Segregated funds per user
- ✅ Deterministic addresses (no address collision risk)

## Gas Optimization

- Minimal proxy pattern (~45KB vs full contract)
- CREATE2 deterministic addresses (no storage mapping needed)
- Event-based tracking (cheaper than storage)
- Batch operations where possible

## Testing Checklist

After deployment, test the following:

1. ✅ Create two users → show two different addresses
2. ✅ Deposit to each user's vault
3. ✅ Play one hand (place bet)
4. ✅ Settle game
5. ✅ Withdraw from each vault
6. ✅ Verify all transactions on BSCScan

## Next Steps

1. Deploy contracts to BSC Mainnet
2. Verify contracts on BSCScan
3. Update backend to use per-user vault addresses
4. Update frontend to interact with new contracts
5. Test complete flow with real transactions
6. Document contract addresses and ABIs

