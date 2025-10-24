# Wallet Service Integration Guide (Developer 2 → Developer 3)

**From**: Developer 2 (Game Logic)  
**To**: Developer 3 (Wallet Service)  
**Date**: October 18, 2025  
**Status**: Ready for Integration

---

## 📋 Overview

This guide explains how to integrate the Wallet Service (Developer 3) with the Game Module (Developer 2). The game engine is ready and waiting for wallet integration.

---

## 🔗 Integration Interface

I've created a complete interface that defines the contract between our modules:

**File**: `src/modules/game/interfaces/wallet.interface.ts`

### **IWalletService Interface**

```typescript
export interface IWalletService {
  // Deduct balance when player bets
  deductBalance(
    userId: string,
    amount: number,
    metadata: WalletTransactionMetadata,
  ): Promise<WalletTransactionResult>;

  // Add balance when player wins
  addBalance(
    userId: string,
    amount: number,
    metadata: WalletTransactionMetadata,
  ): Promise<WalletTransactionResult>;

  // Get current balance
  getBalance(userId: string): Promise<number>;

  // Check if sufficient balance
  hasSufficientBalance(userId: string, amount: number): Promise<boolean>;

  // Lock funds for game (reserve without deducting)
  lockFunds(userId: string, amount: number, gameId: string): Promise<WalletLockResult>;

  // Release locked funds (cancel)
  releaseFunds(userId: string, lockId: string): Promise<void>;

  // Convert locked funds to deduction
  deductLockedFunds(
    userId: string,
    lockId: string,
    metadata: WalletTransactionMetadata,
  ): Promise<WalletTransactionResult>;
}
```

---

## 📍 Integration Points

### **1. Betting Actions** (HIGH PRIORITY)

**Location**: `src/modules/game/services/betting.service.ts`

**Current Code** (lines 169-173):
```typescript
// TODO: Integrate with Developer 3's wallet service
// await this.walletService.deductBalance(player.userId, amount, {
//   type: 'game_bet',
//   gameId: game.id,
//   tableId: game.tableId,
// });
```

**Replace With**:
```typescript
await this.walletService.deductBalance(player.userId, amount, {
  type: WalletTransactionType.GAME_BET,
  gameId: game.id,
  tableId: game.tableId,
  description: `Bet in game ${game.id}`,
  timestamp: new Date(),
});
```

**Similar TODO markers at**:
- Line 204 (RAISE action)
- Line 225 (CALL action)
- Line 303 (ALL_IN action)

---

### **2. Ante Collection** (HIGH PRIORITY)

**Location**: `src/modules/game/services/game-state.service.ts`

**Current Code** (lines 54-58):
```typescript
// TODO: Integrate with Developer 3's wallet service
// await this.walletService.deductBalance(player.userId, ante, {...});
```

**Replace With**:
```typescript
await this.walletService.deductBalance(player.userId, ante, {
  type: WalletTransactionType.GAME_ANTE,
  gameId: game.id,
  tableId: game.tableId,
  description: `Ante for game ${game.id}`,
});
```

---

### **3. Pot Distribution** (HIGH PRIORITY)

**Location**: `src/modules/game/services/game-state.service.ts`

**Current Code** (lines 180-182):
```typescript
// TODO: Integrate with Developer 3's wallet service to credit winnings
// await this.walletService.addBalance(winnerId, amountPerWinner, {...});
```

**Replace With**:
```typescript
await this.walletService.addBalance(winnerId, amountPerWinner, {
  type: WalletTransactionType.GAME_WINNINGS,
  gameId: game.id,
  tableId: game.tableId,
  description: `Winnings from game ${game.id}`,
});
```

**Similar TODO marker at**: Line 224 (side pot distribution)

---

### **4. Balance Validation** (HIGH PRIORITY)

**Location**: `src/modules/game/services/betting.service.ts`

**Current Code** (line 130):
```typescript
// Check if player has enough balance (would integrate with wallet service)
// TODO: Integrate with Developer 3's wallet service
```

**Add Before Processing Bet**:
```typescript
const hasSufficientBalance = await this.walletService.hasSufficientBalance(
  player.userId,
  amount,
);

if (!hasSufficientBalance) {
  throw new BadRequestException('Insufficient balance');
}
```

---

### **5. Game Cancellation Refunds** (MEDIUM PRIORITY)

**Location**: `src/modules/game/game.service.ts`

**Current Code** (line 228):
```typescript
// TODO: Refund all bets to players via wallet service
```

**Replace With**:
```typescript
for (const player of game.players) {
  if (player.totalBet > 0) {
    await this.walletService.addBalance(player.userId, player.totalBet, {
      type: WalletTransactionType.GAME_REFUND,
      gameId: game.id,
      description: `Refund from cancelled game ${game.id}`,
    });
  }
}
```

---

## 🔧 Implementation Steps

### **Step 1: Inject Wallet Service**

Add wallet service to game module:

```typescript
// src/modules/game/game.module.ts
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game, GamePlayer]),
    WalletModule, // <-- Add this
  ],
  ...
})
export class GameModule {}
```

### **Step 2: Add to Service Constructors**

Update services to inject wallet service:

```typescript
// src/modules/game/services/betting.service.ts
import { IWalletService } from '../interfaces/wallet.interface';

@Injectable()
export class BettingService {
  constructor(
    @InjectRepository(Game)
    private readonly gamesRepository: Repository<Game>,
    @InjectRepository(GamePlayer)
    private readonly gamePlayersRepository: Repository<GamePlayer>,
    @Inject('WALLET_SERVICE') // <-- Add this
    private readonly walletService: IWalletService,
  ) {}
  ...
}
```

**Services that need wallet injection**:
- `BettingService`
- `GameStateService`
- `GameService` (for refunds)

---

## 📊 Transaction Types

All transactions are tracked with metadata:

```typescript
export enum WalletTransactionType {
  GAME_ANTE = 'game_ante',           // Initial ante
  GAME_BET = 'game_bet',             // Regular bet
  GAME_RAISE = 'game_raise',         // Raise bet
  GAME_CALL = 'game_call',           // Call bet
  GAME_ALL_IN = 'game_all_in',       // All-in bet
  GAME_WINNINGS = 'game_winnings',   // Winning payout
  GAME_REFUND = 'game_refund',       // Cancelled game refund
  TOURNAMENT_ENTRY = 'tournament_entry',
  TOURNAMENT_PRIZE = 'tournament_prize',
}
```

---

## 🎯 Example Integration Flow

### **Complete Game with Wallet Integration**

```typescript
// 1. Player joins game - lock ante
await walletService.lockFunds(userId, ante, gameId);

// 2. Game starts - deduct ante
await walletService.deductLockedFunds(userId, lockId, {
  type: WalletTransactionType.GAME_ANTE,
  gameId,
});

// 3. Player bets
await walletService.deductBalance(userId, betAmount, {
  type: WalletTransactionType.GAME_BET,
  gameId,
});

// 4. Player wins
await walletService.addBalance(winnerId, winnings, {
  type: WalletTransactionType.GAME_WINNINGS,
  gameId,
});

// 5. Game cancelled - refund
await walletService.releaseFunds(userId, lockId);
```

---

## ⚠️ Error Handling

### **Insufficient Balance**

```typescript
try {
  await walletService.deductBalance(userId, amount, metadata);
} catch (error) {
  if (error instanceof InsufficientBalanceException) {
    throw new BadRequestException(
      `Insufficient balance. Required: ${error.required}, Available: ${error.available}`
    );
  }
  throw error;
}
```

---

## ✅ Testing Integration

### **Unit Tests**

Mock the wallet service in tests:

```typescript
const mockWalletService = {
  deductBalance: jest.fn().mockResolvedValue({
    success: true,
    transactionId: 'tx-123',
    userId: 'user-1',
    amount: 50,
    newBalance: 950,
    timestamp: new Date(),
  }),
  addBalance: jest.fn().mockResolvedValue({...}),
  getBalance: jest.fn().mockResolvedValue(1000),
  hasSufficientBalance: jest.fn().mockResolvedValue(true),
};
```

### **Integration Tests**

Test with actual wallet service:

```typescript
describe('Game with Wallet Integration', () => {
  it('should deduct balance when player bets', async () => {
    const initialBalance = await walletService.getBalance(userId);
    
    await gameService.performAction(gameId, userId, {
      type: 'bet',
      amount: 50,
    });
    
    const newBalance = await walletService.getBalance(userId);
    expect(newBalance).toBe(initialBalance - 50);
  });
});
```

---

## 🚀 Priority Order

1. **CRITICAL**: Balance validation before bets
2. **HIGH**: Deduct balance on betting actions
3. **HIGH**: Add balance on winnings
4. **MEDIUM**: Ante collection
5. **MEDIUM**: Refunds on game cancellation
6. **LOW**: Lock/unlock funds mechanism (optional enhancement)

---

## 📝 Notes for Developer 3

### **Database Transactions**

Please ensure all wallet operations use database transactions:
- Deduct from one user → Add to pot (atomic)
- Deduct from pot → Add to winner (atomic)

### **Concurrency**

Handle concurrent access:
- Multiple games deducting simultaneously
- Use row-level locking for balance updates

### **Audit Trail**

Keep complete transaction history:
- Every deduction and addition
- Link to game ID
- Timestamp
- Transaction type

### **Balance Checks**

Always check balance before deducting:
- Prevent negative balances
- Throw `InsufficientBalanceException` if needed

---

## 🔗 Communication

### **When You're Ready**

1. Implement `IWalletService` interface
2. Export service from `WalletModule`
3. Let me know - I'll complete integration
4. We'll test together

### **Questions?**

- Interface unclear? Let me know!
- Need different transaction types? I can add them!
- Performance concerns? We can optimize!

---

## ✅ Checklist for Developer 3

- [ ] Review `IWalletService` interface
- [ ] Implement all interface methods
- [ ] Add database transactions
- [ ] Add concurrency handling
- [ ] Create unit tests
- [ ] Export from WalletModule
- [ ] Notify Developer 2 when ready

---

**Contact**: Developer 2  
**Interface File**: `src/modules/game/interfaces/wallet.interface.ts`  
**Integration Guide**: This file

**Status**: ✅ Game module ready, waiting for wallet service!

