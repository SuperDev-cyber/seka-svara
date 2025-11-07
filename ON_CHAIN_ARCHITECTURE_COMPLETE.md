# Seka Svara On-Chain Architecture - Complete Documentation

## 1. Architecture: Per-User Address Generation

### Method: CREATE2 Minimal Proxy Pattern

Each user receives a **deterministic, unique vault address** using the CREATE2 pattern:

```
vaultAddress = CREATE2(
    salt = keccak256(userAddress),
    implementation = UserVault implementation contract,
    factory = VaultFactory contract
)
```

**Key Features**:
- ✅ **Deterministic**: Same user address always generates the same vault address
- ✅ **Gas Efficient**: Minimal proxy (~45KB) vs full contract deployment
- ✅ **Segregated Funds**: Each user's funds are in their own vault contract
- ✅ **No Backend Dependency**: Address can be calculated off-chain
- ✅ **Visible On-Chain**: All deposits/withdrawals visible on blockchain explorer

### Contract Structure

```
UserVault (Implementation)
    ↓ (cloned via CREATE2)
UserVault (Proxy 1) → User 1's funds
UserVault (Proxy 2) → User 2's funds
UserVault (Proxy N) → User N's funds
```

**Factory Pattern**:
- `VaultFactory` creates and manages all user vaults
- One vault per user (enforced by deterministic address)
- Factory grants game contract role to vaults automatically

## 2. Mainnet Contract Addresses

### BSC Mainnet (Chain ID: 56)

**Status**: Ready for deployment

**Contract Addresses** (to be filled after deployment):
- **UserVault Implementation**: `TBD`
- **VaultFactory**: `TBD`
- **SekaSvaraGame**: `TBD`

**Configuration**:
- **USDT Token**: `0x55d398326f99059fF775485246999027B3197955`
- **Network**: Binance Smart Chain Mainnet
- **RPC**: `https://bsc-dataseed.binance.org/`
- **Explorer**: `https://bscscan.com`

### TRON Mainnet

**Status**: Contracts need TRON-specific implementation (different from Solidity)

**Note**: TRON uses a different virtual machine. The same architecture applies but requires:
- TRON-compatible smart contracts (TVM)
- Different deployment process
- Tronscan verification

**Configuration**:
- **USDT Token**: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`
- **Network**: TRON Mainnet
- **Explorer**: `https://tronscan.org`

## 3. Verified Source Code

### Contract Files

All contracts are located in: `backend/Seka-Svara-CP-For-Server/src/contracts/`

1. **UserVault.sol** - Per-user vault contract
2. **VaultFactory.sol** - Factory for creating vaults
3. **SekaSvaraGame.sol** - Main game contract

### Verification Process

After deployment, verify contracts on BSCScan:

```bash
# 1. UserVault Implementation
npx hardhat verify --network bscMainnet <IMPLEMENTATION_ADDRESS>

# 2. VaultFactory
npx hardhat verify --network bscMainnet <FACTORY_ADDRESS> \
  "0x55d398326f99059fF775485246999027B3197955" \
  <FEE_RECEIVER_ADDRESS>

# 3. SekaSvaraGame
npx hardhat verify --network bscMainnet <GAME_ADDRESS> \
  "0x55d398326f99059fF775485246999027B3197955" \
  <FACTORY_ADDRESS> \
  <FEE_RECEIVER_ADDRESS>
```

### ABI Files

ABI files will be generated after compilation in:
- `artifacts/contracts/UserVault.sol/UserVault.json`
- `artifacts/contracts/VaultFactory.sol/VaultFactory.json`
- `artifacts/contracts/SekaSvaraGame.sol/SekaSvaraGame.json`

## 4. Roles

### UserVault Roles
- **DEFAULT_ADMIN_ROLE**: VaultFactory contract
- **ADMIN_ROLE**: VaultFactory contract (can update playthrough)
- **GAME_ROLE**: SekaSvaraGame contract (can place bets and settle)

### SekaSvaraGame Roles
- **DEFAULT_ADMIN_ROLE**: Deployer/Owner
- **ADMIN_ROLE**: Can create games, update fees, pause contract
- **SETTLER_ROLE**: Can settle games (granted to backend service)

### VaultFactory Roles
- **Owner**: Deployer (can pause, update game contract, update fee receiver)

## 5. Functions & Events

### UserVault Functions

#### `deposit(uint256 amount)`
- **Purpose**: User deposits USDT into their vault
- **Access**: Public (anyone can deposit to any vault)
- **Events**: `Deposit(address indexed user, uint256 amount, uint256 timestamp)`

#### `withdraw(uint256 amount)`
- **Purpose**: User withdraws USDT from their vault (automatic, no approval)
- **Access**: Only vault owner (userAddress)
- **Checks**: Available balance considering playthrough requirement
- **Events**: `Withdraw(address indexed user, uint256 amount, uint256 timestamp)`

#### `placeBet(uint256 amount, bytes32 gameId)`
- **Purpose**: Place a bet in a game (called by game contract)
- **Access**: Only GAME_ROLE (SekaSvaraGame contract)
- **Updates**: `totalWagered` (on-chain game volume tracking)
- **Events**: `BetPlaced(address indexed user, uint256 amount, bytes32 indexed gameId)`

#### `settle(uint256 winnings, bytes32 gameId)`
- **Purpose**: Settle game and add winnings to vault
- **Access**: Only GAME_ROLE (SekaSvaraGame contract)
- **Events**: `GameSettled(address indexed user, uint256 winnings, bytes32 indexed gameId)`

#### `turnover() → uint256`
- **Purpose**: Get user's total wagered amount (on-chain game volume)
- **Access**: Public view
- **Returns**: Total amount wagered across all games

#### `getAvailableBalance() → uint256`
- **Purpose**: Get available balance for withdrawal (considering playthrough)
- **Access**: Public view
- **Returns**: Available balance (0 if playthrough not met, full balance if met)

#### `setPlaythroughMultiplier(uint256 newMultiplier)`
- **Purpose**: Update playthrough requirement (admin only)
- **Access**: ADMIN_ROLE
- **Events**: `PlaythroughUpdated(uint256 oldMultiplier, uint256 newMultiplier)`

### SekaSvaraGame Functions

#### `createGame(bytes32 gameId, address[] players)`
- **Purpose**: Create a new game
- **Access**: ADMIN_ROLE
- **Events**: `GameCreated(bytes32 indexed gameId, address[] players, uint256 timestamp)`

#### `placeBet(bytes32 gameId, uint256 amount)`
- **Purpose**: Player places a bet in a game
- **Access**: Public (any player in the game)
- **Flow**: 
  1. Gets or creates user's vault
  2. Calls `vault.placeBet()` to track wagering
  3. Transfers bet from vault to game contract
- **Events**: `BetPlaced(bytes32 indexed gameId, address indexed player, uint256 amount)`

#### `settle(bytes32 gameId, address winner)`
- **Purpose**: Settle game and distribute winnings
- **Access**: SETTLER_ROLE (backend service)
- **Flow**:
  1. Calculates platform fee (5% by default)
  2. Transfers fee to fee receiver
  3. Transfers winnings to winner's vault
  4. Calls `vault.settle()` to update vault state
- **Events**: `GameSettled(bytes32 indexed gameId, address indexed winner, uint256 payout, uint256 fee)`

#### `turnover(address user) → uint256`
- **Purpose**: Get user's total wagered amount
- **Access**: Public view
- **Returns**: Total amount wagered (from user's vault)

#### `setPlatformFee(uint256 newFee)`
- **Purpose**: Update platform fee percentage
- **Access**: ADMIN_ROLE
- **Events**: `PlatformFeeUpdated(uint256 oldFee, uint256 newFee)`

#### `setFeeReceiver(address newReceiver)`
- **Purpose**: Update fee receiver address
- **Access**: ADMIN_ROLE
- **Events**: `FeeReceiverUpdated(address oldReceiver, address newReceiver)`

## 6. Playthrough System

### Default: 0 (No Requirement)
- Users can withdraw anytime (minus fees)
- No wagering requirement by default
- Set via `setPlaythroughMultiplier(0)` in UserVault

### Configuration
- **Storage**: On-chain in UserVault contract
- **Admin Control**: Can be set per-user via admin panel
- **Formula**: `requiredWagering = (totalDeposited - totalWithdrawn) * multiplier / 100`
- **Example**: 
  - Multiplier = 130 → 1.3x playthrough
  - User deposits 100 USDT
  - Must wager 130 USDT before full withdrawal available

### On-Chain Tracking
- **`totalWagered`**: Tracked in UserVault contract
- **Updated via**: `BetPlaced` events from game contract
- **Fully Transparent**: All wagering visible on blockchain explorer
- **No Backend Dependency**: Calculated entirely on-chain

## 7. Deployment Instructions

### Prerequisites

1. **Install Dependencies**:
```bash
cd backend/Seka-Svara-CP-For-Server
npm install
npm install --save-dev "@nomicfoundation/hardhat-chai-matchers@^2.0.0" \
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

2. **Set Environment Variables**:
```bash
export BSC_PRIVATE_KEY="your_deployer_private_key"
export BSCSCAN_API_KEY="your_bscscan_api_key"
export FEE_RECEIVER="fee_receiver_address"
export SETTLER_ADDRESS="backend_service_address"  # Optional
```

3. **Compile Contracts**:
```bash
npx hardhat compile
```

### Deploy to BSC Mainnet

```bash
npx hardhat run scripts/deploy-bsc-mainnet.ts --network bscMainnet
```

### Post-Deployment

1. **Verify Contracts** (see section 3 above)
2. **Grant SETTLER_ROLE** to backend service:
```solidity
gameContract.grantRole(SETTLER_ROLE, backendServiceAddress)
```
3. **Update Backend Configuration** with contract addresses
4. **Update Frontend Configuration** with contract addresses and ABIs

## 8. Test Proof Requirements

After deployment, create test proof with:

1. **Create User 1** → Get vault address 1
2. **Create User 2** → Get vault address 2
3. **Deposit to User 1** → Transaction hash 1
4. **Deposit to User 2** → Transaction hash 2
5. **Play one hand** (place bet) → Transaction hash 3
6. **Settle game** → Transaction hash 4
7. **Withdraw from User 1** → Transaction hash 5
8. **Withdraw from User 2** → Transaction hash 6

**Required Links**:
- BSCScan link for User 1 vault address
- BSCScan link for User 2 vault address
- BSCScan link for deposit transaction 1
- BSCScan link for deposit transaction 2
- BSCScan link for bet transaction
- BSCScan link for settlement transaction
- BSCScan link for withdrawal transaction 1
- BSCScan link for withdrawal transaction 2

## 9. Security Features

- ✅ **ReentrancyGuard**: All state-changing functions protected
- ✅ **AccessControl**: Role-based permissions
- ✅ **Pausable**: Emergency stop functionality
- ✅ **SafeERC20**: Safe token transfers
- ✅ **Automatic Withdrawals**: No backend can block user funds
- ✅ **Segregated Funds**: Each user's funds in separate contract
- ✅ **Deterministic Addresses**: No address collision risk
- ✅ **On-Chain Tracking**: All game volume tracked on-chain
- ✅ **Transparent**: All events visible on blockchain explorer

## 10. Next Steps

1. ✅ Contracts created and ready
2. ⏳ Install Hardhat dependencies
3. ⏳ Deploy to BSC Mainnet
4. ⏳ Verify contracts on BSCScan
5. ⏳ Update backend to use per-user vault addresses
6. ⏳ Update frontend to interact with new contracts
7. ⏳ Test complete flow
8. ⏳ Create test proof with blockchain links

---

**All contracts are ready for deployment. Follow the deployment instructions above to deploy to mainnet.**


