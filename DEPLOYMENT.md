# 🚀 Deployment Guide: Seka Svara Backend to Render.com

Complete step-by-step guide to deploy your NestJS backend to Render.com with Neon PostgreSQL and Upstash Redis.

---

## 📋 Prerequisites

- GitHub account
- Render.com account (free tier available)
- Neon account (free tier available)
- Upstash account (free tier available)
- Backend code pushed to GitHub: `neonflux-io/seka-svara-cp-for-server`

---

## 🗄️ Step 1: Setup Neon PostgreSQL Database

### 1.1 Create Neon Account
1. Go to https://neon.tech
2. Sign up with GitHub/Google/Email
3. Create a new project:
   - **Project Name**: `seka-svara-backend`
   - **Region**: Choose closest to your Render region (e.g., US East)
   - **PostgreSQL Version**: 15 or 16 (recommended)
   - Click **Create Project**

### 1.2 Get Connection String
1. In Neon dashboard, go to your project
2. Click **Connection Details** or **Connection String**
3. Copy the full connection string (format: `postgres://user:password@host:port/db?sslmode=require`)
4. **Important**: The connection string already includes `?sslmode=require` (required for Neon)

**Example Neon Connection String:**
```
postgres://neondb_owner:AbCdEf123456@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### 1.3 (Optional) Test Connection Locally

**Option A: Using a GUI Tool (Recommended for Windows)**
1. Download and install [DBeaver](https://dbeaver.io/download/) (free, cross-platform)
2. Open DBeaver → New Database Connection
3. Select **PostgreSQL**
4. Paste your connection string in the **URL** field:
   ```
   postgresql://neondb_owner:npg_X5GFVMD6grQH@ep-crimson-mud-ahyc8cbg-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```
5. Click **Test Connection** → Should show "Connected"

**Option B: Using Node.js Script**
Create `test-connection.js` in your backend folder:
```javascript
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_X5GFVMD6grQH@ep-crimson-mud-ahyc8cbg-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

client.connect()
  .then(() => {
    console.log('✅ Connected to Neon database!');
    return client.query('SELECT NOW()');
  })
  .then((res) => {
    console.log('Current time:', res.rows[0].now);
    client.end();
  })
  .catch((err) => {
    console.error('❌ Connection error:', err);
    client.end();
  });
```

Run: `node test-connection.js`

**Option C: Install PostgreSQL Client on Windows**
1. Download PostgreSQL from https://www.postgresql.org/download/windows/
2. Install (includes `psql` command-line tool)
3. Open PowerShell and run:
   ```powershell
   psql "postgresql://neondb_owner:npg_X5GFVMD6grQH@ep-crimson-mud-ahyc8cbg-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
   ```

**Option D: Using Docker (if you have Docker installed)**
```powershell
docker run -it --rm postgres psql "postgresql://neondb_owner:npg_X5GFVMD6grQH@ep-crimson-mud-ahyc8cbg-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

---

## 🔴 Step 2: Setup Upstash Redis

### 2.1 Create Upstash Account
1. Go to https://upstash.com
2. Sign up with GitHub/Google/Email

### 2.2 Create Redis Database
1. Click **Create Database**
2. **Name**: `seka-svara-redis`
3. **Type**: Regional (choose region closest to Render)
4. **TLS**: Enabled (required)
5. Click **Create**

### 2.3 Get Connection String
1. In your Redis database dashboard
2. Click **Details** tab
3. Copy the **REST URL** or **Redis URL**
4. **IMPORTANT**: Upstash requires TLS, so use `rediss://` (with double 's') not `redis://`
5. Format: `rediss://default:PASSWORD@HOST:PORT`

**Example Upstash Connection String:**
```
rediss://default:AYHTAAIncDIxNzdmNjc1NTA0MjQ0YjYyOWYwNWFmMzRmZDE0ZGZmZXAyMzMyMzU@native-jennet-33235.upstash.io:6379
```

### 2.4 (Optional) Test Connection Locally

**Option A: Using Node.js Script (Recommended for Windows)**
Create `test-redis-connection.js` in your backend folder:
```javascript
const Redis = require('ioredis');

const redis = new Redis('rediss://default:PASSWORD@HOST:PORT', {
  tls: { rejectUnauthorized: false }
});

redis.ping().then(() => {
  console.log('✅ Connected to Upstash Redis!');
  redis.quit();
});
```

Run: `node test-redis-connection.js`

**Option B: Using Docker (if you have Docker installed)**
```powershell
docker run -it --rm redis redis-cli --tls -u "rediss://default:PASSWORD@HOST:PORT"
```

**Option C: Install Redis CLI on Windows**
1. Download Redis for Windows from https://github.com/microsoftarchive/redis/releases
2. Or use WSL (Windows Subsystem for Linux) and install Redis CLI there
3. Run: `redis-cli --tls -u "rediss://default:PASSWORD@HOST:PORT"`

---

## 🚢 Step 3: Deploy Backend to Render.com

### 3.1 Create Render Account
1. Go to https://render.com
2. Sign up with GitHub
3. Connect your GitHub account

### 3.2 Create New Web Service
1. Click **New +** → **Web Service**
2. Connect repository: `neonflux-io/seka-svara-cp-for-server`
3. Configure:
   - **Name**: `seka-svara-cp-for-server`
   - **Root Directory**: `backend/Seka-Svara-CP-For-Server`
   - **Environment**: **Docker** (recommended) or **Node**
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Instance Type**: Starter (or higher if needed)

### 3.3 Configure Build & Start Commands

**If using Docker (recommended):**
- **Build Command**: (leave empty, Dockerfile handles it)
- **Start Command**: (leave empty, Dockerfile CMD handles it)

**If using Node:**
- **Build Command**: `npm ci && npm run build`
- **Start Command**: `npm run start:prod`

### 3.4 Set Environment Variables

Go to **Environment** tab and add all the following variables:

#### Complete Environment Variables List:

```env
# ============================================
# REQUIRED - Core Application
# ============================================
NODE_ENV=production
PORT=8000
API_PREFIX=api/v1

# ============================================
# REQUIRED - Database (Neon PostgreSQL)
# ============================================
DATABASE_URL=postgresql://neondb_owner:npg_X5GFVMD6grQH@ep-crimson-mud-ahyc8cbg-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Database Configuration (if not using DATABASE_URL)
# DB_HOST=localhost
# DB_PORT=5432
# DB_USERNAME=postgres
# DB_PASSWORD=postgres
# DB_NAME=seka_svara_db

# Database Settings
DB_SYNCHRONIZE=false
DB_LOGGING=false

# ============================================
# REQUIRED - Redis (Upstash)
# ============================================
REDIS_URL=rediss://default:AYHTAAIncDIxNzdmNjc1NTA0MjQ0YjYyOWYwNWFmMzRmZDE0ZGZmZXAyMzMyMzU@native-jennet-33235.upstash.io:6379

# Redis Configuration (if not using REDIS_URL)
# REDIS_HOST=localhost
# REDIS_PORT=6379
# REDIS_PASSWORD=
# REDIS_DB=0

# ============================================
# REQUIRED - Authentication & Security
# ============================================
JWT_SECRET=CHANGE_THIS_TO_A_STRONG_RANDOM_SECRET_AT_LEAST_32_CHARACTERS_LONG
JWT_EXPIRATION=7d

# ============================================
# REQUIRED - CORS Configuration
# ============================================
CORS_ORIGINS=https://seka-svara-cp.vercel.app,http://localhost:5173,http://localhost:3000

# ============================================
# OPTIONAL - Blockchain Integration (BSC)
# ============================================
BSC_RPC_URL=https://bsc-dataseed.binance.org/
# BSC_RPC_URL=https://bsc-testnet.public.blastapi.io (for testnet)

# ============================================
# OPTIONAL - Blockchain Integration (Tron)
# ============================================
TRON_API_KEY=your-tron-api-key-here
# Get your API key from: https://www.trongrid.io/

# ============================================
# OPTIONAL - Email Service (SMTP)
# ============================================
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password
EMAIL_FROM=noreply@seka-svara.com

# Alternative: Use SendGrid
# SENDGRID_API_KEY=your-sendgrid-api-key
# SENDGRID_FROM_EMAIL=noreply@seka-svara.com

# ============================================
# OPTIONAL - Admin Wallet Addresses (for USDT)
# ============================================
# ADMIN_BEP20_WALLET=0xYourBEP20WalletAddress
# ADMIN_TRC20_WALLET=TYourTRC20WalletAddress

# ============================================
# OPTIONAL - Platform Settings
# ============================================
# PLATFORM_NAME=Seka Svara
# PLATFORM_URL=https://seka-svara-cp.vercel.app
```

#### Important Notes:

1. **JWT_SECRET**: Generate a strong random string:
   ```bash
   # On Linux/Mac:
   openssl rand -base64 32
   
   # On Windows PowerShell:
   -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
   ```

2. **CORS_ORIGINS**: 
   - Remove trailing slashes from URLs
   - Separate multiple origins with commas (no spaces)
   - Include your Vercel frontend URL and localhost for development

3. **DATABASE_URL vs Individual DB vars**: 
   - Use `DATABASE_URL` (recommended for Neon/Render)
   - OR use individual `DB_HOST`, `DB_PORT`, etc. (but not both)

4. **REDIS_URL vs Individual Redis vars**:
   - Use `REDIS_URL` (recommended for Upstash)
   - OR use individual `REDIS_HOST`, `REDIS_PORT`, etc. (but not both)

5. **Optional Variables**:
   - Only add variables you actually use
   - Blockchain variables are only needed if you use BSC/TRON features
   - Email variables are only needed if you send emails

### 3.5 Configure Post-Deploy Migrations

1. Go to **Settings** → **Build & Deploy**
2. **Post-deploy Command**: `npm run migration:run`
3. This runs database migrations automatically after each deploy

### 3.6 Health Check

1. Go to **Settings** → **Health Check Path**
2. Set to: `/health`
3. (If you don't have a health endpoint, create one - see below)

### 3.7 Create Health Endpoint (if missing)

Add to `src/app.controller.ts`:
```typescript
@Get('health')
health() {
  return { status: 'ok', timestamp: new Date().toISOString() };
}
```

### 3.8 Deploy

1. Click **Create Web Service**
2. Render will:
   - Clone your repo
   - Build the Docker image (or run npm build)
   - Start the service
   - Run migrations (post-deploy)
3. Watch the **Logs** tab for progress

---

## ✅ Step 4: Verify Deployment

### 4.1 Check Logs
- Go to **Logs** tab in Render dashboard
- Look for:
  - ✅ "Database connection established"
  - ✅ "Server is running on: http://localhost:8000"
  - ✅ No errors

### 4.2 Test Endpoints

**Health Check:**
```bash
curl https://your-service.onrender.com/health
```

**Swagger Documentation:**
```
https://your-service.onrender.com/api/docs
```

**API Base URL:**
```
https://your-service.onrender.com/api/v1
```

### 4.3 Update Frontend

Update your frontend `.env` or config to point to Render backend:
```env
VITE_API_URL=https://your-service.onrender.com/api/v1
VITE_WS_URL=wss://your-service.onrender.com
```

---

## 🔄 Step 5: Continuous Deployment

Render automatically deploys on every push to `main` branch.

To deploy manually:
1. Go to **Manual Deploy** tab
2. Click **Deploy latest commit**

---

## 🛠️ Troubleshooting

### Database Connection Issues

**Problem**: "Connection refused" or "SSL required"
- ✅ Verify `DATABASE_URL` includes `?sslmode=require`
- ✅ Check Neon project is active (not suspended)
- ✅ Verify connection string is correct

**Problem**: "Migration failed"
- ✅ Check `DATABASE_URL` is set correctly
- ✅ Verify migrations folder exists: `src/database/migrations/`
- ✅ Check logs for specific migration errors

### Redis Connection Issues

**Problem**: "Connection timeout"
- ✅ Verify `REDIS_URL` uses `rediss://` (TLS) not `redis://`
- ✅ Check Upstash dashboard for active connections
- ✅ Verify password is correct

### Build Issues

**Problem**: "Build failed"
- ✅ Check logs for specific npm/TypeScript errors
- ✅ Verify `package.json` has correct scripts
- ✅ Ensure all dependencies are in `dependencies` (not `devDependencies`) for production

### CORS Issues

**Problem**: Frontend can't connect to backend
- ✅ Add frontend URL to `CORS_ORIGINS` env var
- ✅ Verify format: `https://your-app.vercel.app,http://localhost:5173`
- ✅ Check backend logs for CORS errors

---

## 📊 Monitoring & Scaling

### Render Dashboard
- **Metrics**: CPU, Memory, Requests
- **Logs**: Real-time application logs
- **Events**: Deploy history, errors

### Neon Dashboard
- **Queries**: Query performance
- **Connections**: Active connections
- **Storage**: Database size

### Upstash Dashboard
- **Commands**: Redis command stats
- **Memory**: Memory usage
- **Requests**: Request counts

---

## 🔐 Security Checklist

- [ ] `JWT_SECRET` is a strong random string
- [ ] `DB_SYNCHRONIZE=false` in production (use migrations)
- [ ] CORS only allows your frontend domain
- [ ] Database connection uses SSL (`sslmode=require`)
- [ ] Redis connection uses TLS (`rediss://`)
- [ ] No sensitive data in code (use env vars)
- [ ] Health check endpoint exists

---

## 🎉 Success!

Your backend is now live at:
```
https://your-service.onrender.com
```

API Documentation:
```
https://your-service.onrender.com/api/docs
```

---

## 📞 Support

- Render Docs: https://render.com/docs
- Neon Docs: https://neon.tech/docs
- Upstash Docs: https://docs.upstash.com

---

## 🚀 Next Steps

1. Update frontend to use Render backend URL
2. Test all API endpoints
3. Set up monitoring/alerts
4. Configure custom domain (optional)
5. Set up staging environment (optional)

