# Seka Svara Backend - Team Distribution Guide

## 📋 Project Overview

This document outlines the work distribution for the **3-person development team** working on the Seka Svara multiplayer card game backend.

---

## 👥 Team Structure

### **Developer 1: Authentication & User Management** 👤
**Primary Focus:** User-facing features, authentication, admin panel

**Assigned Modules:**
- `src/modules/auth/` - Authentication & JWT
- `src/modules/users/` - User management
- `src/modules/admin/` - Admin panel & settings
- `src/modules/notifications/` - Notification system
- `src/common/guards/` - Auth guards
- `src/common/decorators/` - Custom decorators

**Key Responsibilities:**
1. ✅ Implement JWT authentication (register, login, refresh token)
2. ✅ Email verification & password reset
3. ✅ User profile management (CRUD operations)
4. ✅ Role-based access control (RBAC)
5. ✅ Admin dashboard APIs
6. ✅ Platform settings management
7. ✅ User ban/unban functionality
8. ✅ Notification system (in-app notifications)

**APIs to Implement:**
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh access token
- `POST /auth/forgot-password` - Password reset request
- `GET /users/profile` - Get user profile
- `PUT /users/profile` - Update profile
- `GET /admin/dashboard` - Admin dashboard stats
- `PUT /admin/settings` - Update platform settings
- `GET /notifications` - Get user notifications

**Estimated Timeline:** Week 1-2

---

### **Developer 2: Game Logic & Real-time Features** 🎮
**Primary Focus:** Core game mechanics, WebSocket communication, real-time gameplay

**Assigned Modules:**
- `src/modules/game/` - Game logic & state management
- `src/modules/tables/` - Game table management
- `src/modules/websocket/` - WebSocket gateway
- `src/modules/leaderboard/` - Rankings & statistics
- `src/modules/game/services/game-engine.service.ts` - Core game engine

**Key Responsibilities:**
1. ✅ Implement Seka Svara game rules
2. ✅ Game state management
3. ✅ Real-time WebSocket communication
4. ✅ Table creation & player management
5. ✅ Turn-based gameplay logic
6. ✅ Hand evaluation & winner determination
7. ✅ Leaderboard & statistics
8. ✅ Game history & replays

**Seka Svara Rules to Implement:**
- **Cards:** 36-card deck (6-Ace, 4 suits)
- **Players:** 2-6 players
- **Objective:** Get cards totaling 31 (or closest)
- **Hand Values:**
  - Same suit: Sum of values (Ace=11, Face cards=10, others face value)
  - Three of a kind: Special value
  - 7-8-9 combo: Highest hand
- **Actions:** Bet, Call, Raise, Fold, All-in

**WebSocket Events to Implement:**
- `join_table` - Player joins table
- `leave_table` - Player leaves
- `player_action` - Player performs action
- `game_start` - Game begins
- `game_end` - Game ends
- `turn_change` - Next player's turn
- `card_dealt` - Cards dealt

**APIs to Implement:**
- `POST /tables` - Create table
- `POST /tables/:id/join` - Join table
- `GET /tables` - List all tables
- `GET /game/:id` - Get game state
- `POST /game/:id/action` - Perform action
- `GET /leaderboard/top-winners` - Top winners

**Estimated Timeline:** Week 2-4

---

### **Developer 3: Blockchain & Wallet Integration** 💰
**Primary Focus:** Cryptocurrency integration, wallet management, smart contracts

**Assigned Modules:**
- `src/modules/blockchain/` - Blockchain services
- `src/modules/wallet/` - Wallet management
- `src/modules/transactions/` - Transaction handling
- `src/modules/nft/` - NFT marketplace
- `src/contracts/` - Smart contracts (Solidity)
- `src/modules/blockchain/services/` - BSC, Tron, Escrow services

**Key Responsibilities:**
1. ✅ BSC (BEP20) USDT integration
2. ✅ Tron (TRC20) USDT integration
3. ✅ Smart contract escrow system
4. ✅ Deposit & withdrawal processing
5. ✅ Transaction verification
6. ✅ Wallet balance management
7. ✅ NFT minting & trading
8. ✅ Fee calculation & distribution

**Smart Contract Features:**
- **GameEscrow.sol:**
  - Lock funds until game ends
  - Automatic winner payout
  - Platform fee deduction
  - Refund mechanism
  - Emergency pause

**Blockchain Operations:**
- Generate deposit addresses
- Monitor incoming transactions
- Process withdrawals
- Verify transaction confirmations
- Handle gas fees

**APIs to Implement:**
- `POST /wallet/deposit` - Process deposit
- `POST /wallet/withdraw` - Request withdrawal
- `GET /wallet/balance` - Get wallet balance
- `POST /wallet/generate-address` - Generate deposit address
- `GET /transactions` - Get transaction history
- `POST /nft` - Create/Mint NFT
- `POST /nft/:id/buy` - Buy NFT

**Estimated Timeline:** Week 2-5

---

## 🔄 Integration Points

### Week 3-4: Integration Phase

**Developer 1 ↔ Developer 2:**
- User authentication in WebSocket connections
- User balance checks before joining tables
- User statistics updates after games

**Developer 2 ↔ Developer 3:**
- Lock/unlock wallet funds when joining tables
- Create escrow when game starts
- Release escrow to winner
- Distribute platform fees

**Developer 1 ↔ Developer 3:**
- Update user balance after transactions
- Notify users of transaction status
- Admin monitoring of transactions

---

## 📝 Development Workflow

### Branch Strategy
```
main (production)
  └── develop (development)
        ├── feature/auth-module (Dev 1)
        ├── feature/game-logic (Dev 2)
        └── feature/blockchain (Dev 3)
```

### Daily Routine
1. **Morning:** Pull latest changes from `develop`
2. **Work:** Implement your assigned features
3. **Commit:** Push changes with clear commit messages
4. **Evening:** Create PR for review

### Commit Message Format
```
feat(auth): implement JWT authentication
fix(game): resolve turn management bug
docs(readme): update API documentation
test(wallet): add deposit tests
```

---

## 🧪 Testing Strategy

### Developer 1
- Unit tests for auth service
- Integration tests for user APIs
- Test RBAC permissions

### Developer 2
- Unit tests for game engine
- WebSocket event tests
- Game flow integration tests

### Developer 3
- Mock blockchain tests
- Transaction verification tests
- Smart contract unit tests

---

## 📊 Progress Tracking

### Week 1
- [Dev 1] Auth module complete
- [Dev 1] User module structure
- [Dev 2] Game engine foundation
- [Dev 3] Blockchain service setup

### Week 2
- [Dev 1] Admin panel APIs
- [Dev 2] WebSocket implementation
- [Dev 3] BSC integration

### Week 3
- [Dev 1] Notifications system
- [Dev 2] Game logic complete
- [Dev 3] Tron integration

### Week 4
- [Dev 2] Tables & matchmaking
- [Dev 3] Escrow smart contract
- **ALL:** Integration testing

### Week 5
- [Dev 3] NFT marketplace
- **ALL:** Bug fixes
- **ALL:** End-to-end testing

### Week 6
- **ALL:** Performance optimization
- **ALL:** Security review
- **ALL:** Documentation

---

## 🚀 Quick Start for Each Developer

### Developer 1 Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your settings
npm run start:dev

# Test your endpoints
curl http://localhost:8000/api/v1/auth/...
```

### Developer 2 Setup
```bash
cd backend
npm install
# Start Redis for WebSocket
# docker run -d -p 6379:6379 redis
npm run start:dev

# Test WebSocket connection
# Use Postman or Socket.io client
```

### Developer 3 Setup
```bash
cd backend
npm install
# Configure blockchain RPC URLs in .env
npm run start:dev

# Compile smart contracts
cd src/contracts
npx hardhat compile
```

---

## 📞 Communication

- **Daily Standup:** 10:00 AM (15 minutes)
- **Code Review:** Before merging to develop
- **Integration Sync:** Every Monday & Thursday
- **Sprint Planning:** Every Monday morning

---

## 🛠️ Tools & Resources

- **Project Management:** GitHub Projects / Jira
- **Communication:** Slack / Discord
- **Code Review:** GitHub Pull Requests
- **API Testing:** Postman / Insomnia
- **Database:** pgAdmin / DBeaver
- **Blockchain:** BSCScan / TronScan

---

## ⚠️ Important Notes

1. **Always test locally** before pushing
2. **Don't commit .env files**
3. **Write clear commit messages**
4. **Comment complex logic**
5. **Update API documentation**
6. **Ask for help when stuck**
7. **Review PRs within 24 hours**
8. **Keep dependencies updated**

---

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [TronWeb Documentation](https://developers.tron.network/)
- [Socket.io Documentation](https://socket.io/docs/)

---

## 🎯 Success Criteria

- ✅ All APIs working as expected
- ✅ Real-time gameplay functional
- ✅ Blockchain integration stable
- ✅ 80%+ test coverage
- ✅ Security audit passed
- ✅ Documentation complete

---

**Let's build an amazing Seka Svara platform! 🎉**

