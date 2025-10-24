# Seka Svara Backend

Backend API for Seka Svara multiplayer card game with USDT (BEP20 & TRC20) betting.

## 🎯 Project Overview

This is a multiplayer card game platform that supports:
- 2-6 players per table
- Real-time gameplay using WebSockets
- USDT deposits/withdrawals via BEP20 (BSC) and TRC20 (Tron)
- Smart contract escrow for secure betting
- Admin panel for platform management
- NFT marketplace integration

## 👥 Team Structure & Responsibilities

### **Developer 1: Authentication & User Management** 👤
**Modules to work on:**
- `src/modules/auth/` - Authentication & authorization
- `src/modules/users/` - User management & profiles
- `src/modules/admin/` - Admin panel & settings
- `src/modules/notifications/` - Notification system
- `src/common/guards/` - Auth guards & decorators
- `src/common/decorators/` - Custom decorators

**Key Tasks:**
- JWT authentication (login, register, refresh tokens)
- User CRUD operations
- Admin dashboard APIs
- Role-based access control (RBAC)
- User profile management
- Platform settings & configuration
- Notification system

---

### **Developer 2: Game Logic & Real-time Features** 🎮
**Modules to work on:**
- `src/modules/game/` - Game logic & rules
- `src/modules/tables/` - Game table management
- `src/modules/websocket/` - WebSocket gateway
- `src/modules/leaderboard/` - Rankings & statistics
- `src/common/services/game-engine.service.ts` - Core game engine

**Key Tasks:**
- Seka Svara game rules implementation
- Game state management
- Real-time WebSocket communication
- Table creation & management
- Player actions (bet, fold, call, raise)
- Turn management & timers
- Leaderboard & statistics
- Game history & replays

---

### **Developer 3: Blockchain & Wallet Integration** 💰
**Modules to work on:**
- `src/modules/blockchain/` - Blockchain services
- `src/modules/wallet/` - Wallet management
- `src/modules/transactions/` - Transaction handling
- `src/modules/nft/` - NFT marketplace
- `src/contracts/` - Smart contracts (Solidity)
- `src/common/services/escrow.service.ts` - Escrow logic

**Key Tasks:**
- BSC (BEP20) USDT integration
- Tron (TRC20) USDT integration
- Smart contract escrow system
- Deposit & withdrawal processing
- Transaction monitoring & confirmations
- Wallet balance tracking
- NFT minting & trading
- Fee calculation & distribution

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+
- Redis 6+
- Git

### Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd backend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Setup environment variables:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Setup database:**
```bash
# Create database
createdb seka_svara_db

# Run migrations
npm run migration:run

# Seed database (optional)
npm run seed
```

5. **Start development server:**
```bash
npm run start:dev
```

The API will be available at `http://localhost:8000`

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── modules/              # Feature modules
│   │   ├── auth/            # [Dev 1] Authentication
│   │   ├── users/           # [Dev 1] User management
│   │   ├── admin/           # [Dev 1] Admin panel
│   │   ├── notifications/   # [Dev 1] Notifications
│   │   ├── game/            # [Dev 2] Game logic
│   │   ├── tables/          # [Dev 2] Table management
│   │   ├── websocket/       # [Dev 2] WebSocket gateway
│   │   ├── leaderboard/     # [Dev 2] Rankings
│   │   ├── blockchain/      # [Dev 3] Blockchain services
│   │   ├── wallet/          # [Dev 3] Wallet management
│   │   ├── transactions/    # [Dev 3] Transactions
│   │   └── nft/             # [Dev 3] NFT marketplace
│   ├── common/              # Shared utilities
│   │   ├── decorators/      # Custom decorators
│   │   ├── guards/          # Auth guards
│   │   ├── filters/         # Exception filters
│   │   ├── interceptors/    # Interceptors
│   │   ├── pipes/           # Validation pipes
│   │   └── services/        # Shared services
│   ├── config/              # Configuration
│   ├── database/            # Database migrations & seeds
│   ├── contracts/           # Smart contracts
│   └── main.ts              # Application entry point
├── test/                    # Tests
├── .env.example            # Environment variables template
├── package.json            # Dependencies
└── README.md              # This file
```

---

## 🛠️ Development Workflow

### Branch Strategy
- `main` - Production branch
- `develop` - Development branch
- `feature/<module-name>` - Feature branches
- `bugfix/<issue-name>` - Bug fix branches

### Workflow
1. **Create feature branch:**
```bash
git checkout develop
git pull origin develop
git checkout -b feature/auth-module
```

2. **Make changes and commit:**
```bash
git add .
git commit -m "feat(auth): implement JWT authentication"
```

3. **Push and create PR:**
```bash
git push origin feature/auth-module
# Create Pull Request on GitHub
```

4. **Code Review & Merge:**
- Request review from team members
- Address feedback
- Merge to develop after approval

### Commit Message Convention
```
feat: New feature
fix: Bug fix
docs: Documentation
style: Code style changes
refactor: Code refactoring
test: Tests
chore: Build/config changes
```

---

## 📚 API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:8000/api/docs`
- API JSON: `http://localhost:8000/api/docs-json`

---

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

# Watch mode
npm run test:watch
```

---

## 📦 Database

### Migrations
```bash
# Generate migration
npm run migration:generate -- src/database/migrations/MigrationName

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

### Seeds
```bash
# Run seeds
npm run seed
```

---

## 🔐 Smart Contracts

### Setup Hardhat
```bash
cd src/contracts
npx hardhat compile
```

### Deploy Contracts
```bash
# Deploy to BSC testnet
npx hardhat run scripts/deploy-bsc.ts --network bscTestnet

# Deploy to Tron testnet
npx hardhat run scripts/deploy-tron.ts --network tronTestnet
```

---

## 🐛 Debugging

### VS Code Debug Configuration
Press F5 or use the Debug panel with the following configuration:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug NestJS",
  "runtimeArgs": ["--nolazy", "-r", "ts-node/register"],
  "args": ["${workspaceFolder}/src/main.ts"],
  "cwd": "${workspaceFolder}",
  "protocol": "inspector"
}
```

---

## 📊 Monitoring & Logs

Logs are stored in:
- Console output (development)
- `logs/` directory (production)

Log levels: `error`, `warn`, `info`, `debug`

---

## 🚢 Deployment

### Build for production
```bash
npm run build
```

### Start production server
```bash
npm run start:prod
```

### Docker (Optional)
```bash
docker-compose up -d
```

---

## 📝 Environment Variables

See `.env.example` for all required environment variables.

Key variables:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `JWT_SECRET` - JWT signing key
- `BSC_RPC_URL` - Binance Smart Chain RPC
- `TRON_API_KEY` - Tron API key

---

## 🤝 Team Collaboration Tips

1. **Daily Standups** - Share progress and blockers
2. **Code Reviews** - Review each other's PRs
3. **Documentation** - Document complex logic
4. **Communication** - Use Slack/Discord for quick questions
5. **Testing** - Write tests for your modules
6. **API Contracts** - Define interfaces before implementation

---

## 📅 Development Timeline

**Week 1-2:** Core setup & authentication (Dev 1)
**Week 2-3:** Game logic & WebSocket (Dev 2)
**Week 2-4:** Blockchain integration (Dev 3)
**Week 4-5:** Integration & testing
**Week 5-6:** Bug fixes & deployment
**Week 6-7:** Final testing & launch

---

## 🆘 Support

For questions or issues:
1. Check this README
2. Review API documentation
3. Ask in team chat
4. Create an issue on GitHub

---

## 📄 License

Private - All rights reserved

---

## 🎉 Good Luck Team!

Let's build an amazing Seka Svara platform together! 🚀

