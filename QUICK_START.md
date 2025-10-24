# 🚀 Quick Start Guide

Get up and running in 5 minutes!

---

## Prerequisites

- **Node.js 18+** ([Download](https://nodejs.org/))
- **PostgreSQL 14+** ([Download](https://www.postgresql.org/download/))
- **Redis** (Optional, but recommended)
- **Git**

---

## Step 1: Clone & Install (2 min)

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install
```

---

## Step 2: Configure Environment (1 min)

```bash
# Copy environment template
cp .env.example .env
```

**Edit `.env` with minimum required settings:**

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=seka_svara_db

# JWT
JWT_SECRET=your-secret-key-change-this-in-production

# Optional: Use Docker for DB & Redis
# docker-compose up -d postgres redis
```

---

## Step 3: Setup Database (1 min)

### Option A: Manual Setup
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE seka_svara_db;

# Exit
\q
```

### Option B: Docker (Recommended)
```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis
```

---

## Step 4: Run Migrations (30 sec)

```bash
npm run migration:run
```

---

## Step 5: Start Server (30 sec)

```bash
npm run start:dev
```

**✅ Server running at:**
- API: http://localhost:8000/api/v1
- Docs: http://localhost:8000/api/docs

---

## Test It Works! 🎉

### Open Swagger UI
Visit: http://localhost:8000/api/docs

### Or test with cURL
```bash
curl http://localhost:8000/api/v1/health
```

**Expected Response:**
```json
{
  "status": "ok"
}
```

---

## What's Next?

### For Project Manager
1. Read `TEAM_GUIDE.md` - Team distribution
2. Assign modules to developers
3. Setup Git branching strategy
4. Schedule daily standups

### For Developer 1 (Auth)
1. Review `src/modules/auth/`
2. Implement JWT authentication
3. Read `API_DOCUMENTATION.md`

### For Developer 2 (Game)
1. Review `src/modules/game/`
2. Implement Seka Svara rules
3. Setup WebSocket testing

### For Developer 3 (Blockchain)
1. Review `src/modules/blockchain/`
2. Setup testnet accounts
3. Compile smart contracts: `cd src/contracts && npx hardhat compile`

---

## Common Issues

### Port 3000 already in use
```bash
# Kill process on port 3000
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

### Database connection failed
1. Check PostgreSQL is running
2. Verify credentials in `.env`
3. Test connection: `psql -U postgres`

### Module not found errors
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

---

## Useful Commands

```bash
# Development
npm run start:dev       # Start with hot-reload

# Testing
npm run test            # Run tests

# Database
npm run migration:run   # Run migrations
npm run seed            # Seed data

# Linting
npm run lint            # Check code
npm run format          # Format code

# Build
npm run build           # Build for production
```

---

## Resources

- **Full Documentation:** `README.md`
- **Team Guide:** `TEAM_GUIDE.md`
- **API Reference:** `API_DOCUMENTATION.md` or http://localhost:8000/api/docs
- **Database Guide:** `DATABASE_SETUP.md`
- **Deployment:** `DEPLOYMENT.md`

---

## Need Help?

1. Check documentation files
2. Visit Swagger UI: http://localhost:8000/api/docs
3. Ask your team members
4. Create GitHub issue

---

## Success! 🎉

You're ready to start development!

**Next:** Read `TEAM_GUIDE.md` to see your assigned tasks.

Happy coding! 🚀

