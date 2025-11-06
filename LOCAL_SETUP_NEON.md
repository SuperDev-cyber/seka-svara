# Local Development Setup with NeonDB

This guide shows you how to use NeonDB (online PostgreSQL) as your local database without needing to push changes to Git.

## 🔑 Quick Setup

### Step 1: Get Your Neon Connection String

1. Go to [Neon Console](https://console.neon.tech/)
2. Select your project
3. Go to **Connection Details** or **Connection String**
4. Copy the full connection string (it looks like this):
   ```
   postgresql://user:password@ep-xxx-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

### Step 2: Create Local .env File

1. In the `backend/Seka-Svara-CP-For-Server` directory, create a file named `.env`
2. Copy the contents from `.env.example` (or create it with the following):

```env
# Core Application
NODE_ENV=development
PORT=8000
API_PREFIX=api/v1

# Neon Database (REPLACE WITH YOUR CONNECTION STRING)
DATABASE_URL=postgresql://your-neon-connection-string-here

# Database Settings
DB_SYNCHRONIZE=false
DB_LOGGING=true

# Redis (Upstash or local)
REDIS_URL=rediss://your-redis-connection-string-here
# OR use local Redis:
# REDIS_HOST=localhost
# REDIS_PORT=6379

# JWT Secret (generate a random string)
JWT_SECRET=your-random-secret-key-here

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Optional: Blockchain
BSC_RPC_URL=https://bsc-dataseed.binance.org/
TRON_API_KEY=your-tron-api-key
```

### Step 3: Fill In Your Values

**Important:** Replace these placeholders:
- `DATABASE_URL` - Your Neon connection string
- `REDIS_URL` - Your Upstash Redis connection string (or use local Redis)
- `JWT_SECRET` - Generate a random string (at least 32 characters)

**Generate JWT Secret (Windows PowerShell):**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

### Step 4: Run the Application

```bash
cd backend/Seka-Svara-CP-For-Server
npm install
npm run start:dev
```

The application will automatically:
- ✅ Connect to NeonDB using the `DATABASE_URL`
- ✅ Use SSL connection (required for Neon)
- ✅ Load all your tables and data from the online database

## 🔒 Security Note

- The `.env` file is **gitignored** (won't be committed to Git)
- Never commit your `.env` file with real credentials
- The `.env.example` file is a template only

## ✅ How It Works

The code in `src/app.module.ts` automatically detects `DATABASE_URL` and uses it:

```typescript
// If DATABASE_URL is set, it uses Neon/postgres URL
if (databaseUrl) {
  return {
    type: 'postgres',
    url: databaseUrl,  // Your Neon connection string
    ssl: { rejectUnauthorized: false },  // Required for Neon
    // ...
  };
}
```

## 🧪 Test Connection

You can test your Neon connection using the existing script:

```bash
node test-neon-connection.js
```

Or create a simple test:

```javascript
const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

client.connect()
  .then(() => console.log('✅ Connected to NeonDB!'))
  .catch(err => console.error('❌ Connection failed:', err));
```

## 📝 Notes

- **Database changes are live** - Any changes you make locally will affect the Neon database
- **No Git push needed** - `.env` is gitignored, so your local config stays local
- **Use with caution** - Be careful when testing on production database
- **Consider a separate Neon branch** - For safer testing, create a separate Neon project for development

## 🚀 You're Ready!

Once you have your `.env` file set up with the Neon `DATABASE_URL`, simply run:

```bash
npm run start:dev
```

Your local backend will connect to NeonDB exactly as if it were a local database!

