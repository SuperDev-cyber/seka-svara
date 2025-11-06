# Seka Svara On-Chain Architecture

## Overview

This document describes the on-chain architecture for Seka Svara, implementing per-user segregated vaults with automatic withdrawals and on-chain game volume tracking.

## Architecture Components

### 1. UserVault Contract
- **Purpose**: Per-user vault for deposits and withdrawals
- **Pattern**: Minimal proxy (CREATE2) for gas efficiency
- **Features**:
  - Segregated funds per user
  - Automatic withdrawals (no backend approval)
  - On-chain game volume tracking
  - Configurable playthrough requirement (default: 0)

### 2. VaultFactory Contract
- **Purpose**: Factory that creates and manages user vaults
- **Features**:
  - CREATE2 deterministic address generation
  - One vault per user (deterministic address)
  - Role management for game contracts

### 3. SekaSvaraGame Contract
- **Purpose**: Main game contract for betting and settlement
- **Features**:
  - Game creation and management
  - Bet placement from user vaults
  - Automatic settlement with fee distribution
  - On-chain event emission for all actions

## Address Generation

### Method: CREATE2 Minimal Proxy

Each user gets a **deterministic vault address** calculated using CREATE2:

```
vaultAddress = CREATE2(
    salt = keccak256(userAddress),
    implementation = UserVault implementation
)
```

**Benefits**:
- Same address every time (deterministic)
- Gas efficient (minimal proxy pattern)
- No need to store mapping on-chain (can be calculated off-chain)
- Funds are segregated per user

## Contract Roles

### UserVault
- `DEFAULT_ADMIN_ROLE`: Factory contract
- `ADMIN_ROLE`: Factory contract (can update playthrough)
- `GAME_ROLE`: Game contract (can place bets and settle)

### SekaSvaraGame
- `DEFAULT_ADMIN_ROLE`: Owner
- `ADMIN_ROLE`: Can create games, update fees
- `SETTLER_ROLE`: Can settle games

## Functions & Events

### UserVault Functions
- `deposit(uint256 amount)` - Deposit USDT into vault
- `withdraw(uint256 amount)` - Withdraw USDT (automatic, no approval)
- `placeBet(uint256 amount, bytes32 gameId)` - Place bet (called by game contract)
- `settle(uint256 winnings, bytes32 gameId)` - Settle game (called by game contract)
- `turnover()` - Get total wagered amount
- `getAvailableBalance()` - Get available balance considering playthrough
- `setPlaythroughMultiplier(uint256)` - Update playthrough (admin only)

### UserVault Events
- `Deposit(address indexed user, uint256 amount, uint256 timestamp)`
- `Withdraw(address indexed user, uint256 amount, uint256 timestamp)`
- `BetPlaced(address indexed user, uint256 amount, bytes32 indexed gameId)`
- `GameSettled(address indexed user, uint256 winnings, bytes32 indexed gameId)`
- `PlaythroughUpdated(uint256 oldMultiplier, uint256 newMultiplier)`

### SekaSvaraGame Functions
- `createGame(bytes32 gameId, address[] players)` - Create new game
- `placeBet(bytes32 gameId, uint256 amount)` - Place bet in game
- `settle(bytes32 gameId, address winner)` - Settle game and distribute winnings
- `turnover(address user)` - Get user's total wagered amount
- `setPlatformFee(uint256)` - Update platform fee (admin only)
- `setFeeReceiver(address)` - Update fee receiver (admin only)

### SekaSvaraGame Events
- `GameCreated(bytes32 indexed gameId, address[] players, uint256 timestamp)`
- `BetPlaced(bytes32 indexed gameId, address indexed player, uint256 amount)`
- `GameSettled(bytes32 indexed gameId, address indexed winner, uint256 payout, uint256 fee)`

## Playthrough System

### Default: 0 (No Requirement)
- Users can withdraw anytime (minus fees)
- No wagering requirement by default

### Configurable via Admin Panel
- Playthrough multiplier stored on-chain in UserVault
- Can be set per-user or globally
- Calculated as: `requiredWagering = (totalDeposited - totalWithdrawn) * multiplier / 100`
- Example: multiplier = 130 means 1.3x playthrough

### On-Chain Tracking
- `totalWagered` tracked in UserVault contract
- Updated via `BetPlaced` events
- Fully transparent and verifiable on-chain

## Deployment Flow

1. Deploy UserVault implementation contract
2. Deploy VaultFactory with implementation address
3. Deploy SekaSvaraGame with factory address
4. Set game contract in factory
5. Verify all contracts on BSCScan/Tronscan

## Security Features

- ReentrancyGuard on all state-changing functions
- AccessControl for role-based permissions
- Pausable for emergency stops
- SafeERC20 for token transfers
- Automatic withdrawals (no backend can block)

## Gas Optimization

- Minimal proxy pattern (cheap vault creation)
- CREATE2 deterministic addresses (no storage needed)
- Event-based tracking (cheaper than storage)
- Batch operations where possible

