# 🚀 Complete Deployment Guide: Seka Svara Backend

## Recommended Stack

- **Backend Hosting**: Render.com (Web Service)
- **Database**: Neon (Serverless PostgreSQL)
- **Cache**: Upstash (Serverless Redis)

---

## 📋 Prerequisites

1. GitHub account with repository: `neonflux-io/seka-svara-cp-for-server`
2. Neon account: https://neon.tech
3. Upstash account: https://upstash.com
4. Render account: https://render.com

---

## Step 1: Set Up Neon PostgreSQL Database

### 1.1 Create Neon Account
1. Go to https://neon.tech
2. Sign up (GitHub/Google/Email)
3. Complete email verification

### 1.2 Create Database Project
1. Click **"Create Project"**
2. **Project Name**: `seka-svara-backend`
3. **Region**: Choose closest to your Render region (e.g., `US East` or `US West`)
4. **PostgreSQL Version**: `15` or `16` (recommended)
5. Click **"Create Project"**

### 1.3 Get Connection String
1. In your Neon project dashboard, go to **"Connection Details"** or **"Connection String"**
2. You'll see a connection string like:
   ```
   postgres://neondb_owner:AbCdEf123456@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. **Copy this entire string** - you'll need it for Render
4. ⚠️ **Important**: The connection string already includes `?sslmode=require` - don't modify it

### 1.4 Test Connection (Optional)
You can test the connection using:
- **psql**: `psql "YOUR_CONNECTION_STRING"`
- **DBeaver** or **pgAdmin**: Use the connection string directly
- **Neon Console**: Built-in SQL editor in Neon dashboard

---

## Step 2: Set Up Upstash Redis

### 2.1 Create Upstash Account
1. Go to https://upstash.com
2. Sign up (GitHub/Google/Email)

### 2.2 Create Redis Database
1. Click **"Create Database"**
2. **Name**: `seka-svara-redis`
3. **Region**: Choose same region as Neon (for low latency)
4. **Type**: `Regional` (recommended) or `Global` (for multi-region)
5. Click **"Create"**

### 2.3 Get Redis Connection String
1. In your Redis database dashboard, go to **"Details"** tab
2. Find **"REST URL"** or **"Connection String"**
3. Format: `rediss://default:PASSWORD@HOST:PORT`
4. Example: `rediss://default:AbCdEf123456@us1-bold-redis-12345.upstash.io:12345`
5. **Copy this entire string** - you'll need it for Render

---

## Step 3: Deploy Backend to Render

### 3.1 Connect GitHub Repository
1. Go to https://render.com
2. Sign up/Login
3. Click **"New +"** → **"Blueprint"**
4. Connect your GitHub account
5. Select repository: `neonflux-io/seka-svara-cp-for-server`
6. Click **"Apply"**

### 3.2 Configure Service (via Blueprint)
The `render.yaml` file will automatically configure:
- **Service Name**: `seka-svara-backend`
- **Environment**: Node.js
- **Build Command**: `npm ci && npm run build`
- **Start Command**: `npm run start:prod`
- **Health Check**: `/health`

### 3.3 Set Environment Variables
After the service is created, go to **Settings** → **Environment** and add:

#### Required Variables:
```
NODE_ENV=production
PORT=8000
DATABASE_URL=postgres://... (from Neon - Step 1.3)
REDIS_URL=rediss://... (from Upstash - Step 2.3)
JWT_SECRET=<generate-strong-secret>
```

#### Optional Variables (if needed):
```
FRONTEND_URL=https://your-frontend.vercel.app
JWT_EXPIRATION=7d
DB_LOGGING=false
DB_SYNCHRONIZE=false
BSC_RPC_URL=https://bsc-dataseed.binance.org/
TRON_API_KEY=your-tron-api-key
```

#### Generate JWT_SECRET:
```bash
# Option 1: Using OpenSSL
openssl rand -base64 32

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option 3: Online generator
# https://www.grc.com/passwords.htm
```

### 3.4 Configure Post-Deploy Migrations
1. Go to **Settings** → **Build & Deploy**
2. Scroll to **"Post-deploy Command"**
3. Enter: `npm run migration:run`
4. This will run TypeORM migrations after each deployment

### 3.5 Deploy
1. Click **"Manual Deploy"** → **"Deploy latest commit"**
2. Watch the build logs
3. Wait for deployment to complete (usually 3-5 minutes)

---

## Step 4: Verify Deployment

### 4.1 Check Health Endpoint
```
https://your-service.onrender.com/health
```
Should return: `{"status": "ok"}`

### 4.2 Check Swagger Documentation
```
https://your-service.onrender.com/api/docs
```
Should show Swagger UI with all API endpoints

### 4.3 Check Database Connection
1. Go to Render → Your Service → **Logs**
2. Look for: `Database connection established` or similar success message
3. No errors like `ECONNREFUSED` or `SSL required`

### 4.4 Test API Endpoints
```bash
# Health check
curl https://your-service.onrender.com/health

# API endpoint (if you have one)
curl https://your-service.onrender.com/api/v1/users
```

---

## Step 5: Update Frontend Configuration

### 5.1 Update Frontend API URL
In your frontend (Vercel), set environment variable:
```
VITE_API_URL=https://your-service.onrender.com/api/v1
```

### 5.2 Update Backend CORS
In Render, add environment variable:
```
FRONTEND_URL=https://your-frontend.vercel.app
```

---

## 🔧 Troubleshooting

### Database Connection Issues

**Problem**: `ECONNREFUSED` or connection timeout
- ✅ Check Neon project is active (not suspended)
- ✅ Verify `DATABASE_URL` is correct in Render
- ✅ Ensure `?sslmode=require` is in the connection string
- ✅ Check Neon dashboard for active connections

**Problem**: SSL errors
- ✅ Neon requires SSL - ensure `?sslmode=require` is in URL
- ✅ Check Render logs for specific SSL error messages

### Redis Connection Issues

**Problem**: Cannot connect to Redis
- ✅ Verify `REDIS_URL` is correct (should start with `rediss://`)
- ✅ Check Upstash dashboard - Redis should be active
- ✅ Verify you're using the correct region

### Migration Issues

**Problem**: Migrations fail on deploy
- ✅ Check `postDeployCommand` is set: `npm run migration:run`
- ✅ Verify migration files exist in `src/database/migrations/`
- ✅ Check Render logs for specific migration errors

### Build Issues

**Problem**: Build fails
- ✅ Check `package.json` has all dependencies
- ✅ Verify Node version is 18+ (Render uses 20.x by default)
- ✅ Check build logs for specific errors

### CORS Issues

**Problem**: Frontend can't connect to backend
- ✅ Add `FRONTEND_URL` environment variable in Render
- ✅ Verify frontend URL matches exactly (no trailing slash)
- ✅ Check browser console for CORS error details

---

## 📊 Monitoring & Maintenance

### Neon Dashboard
- Monitor database usage, connections, queries
- View query performance
- Set up alerts for storage/queries

### Upstash Dashboard
- Monitor Redis operations, memory usage
- View command statistics
- Set up alerts

### Render Dashboard
- View deployment logs
- Monitor service health
- Check resource usage
- Set up alerts for downtime

---

## 🚀 Scaling Considerations

### When to Upgrade

**Neon**:
- Free tier: 3 projects, 0.5GB storage
- Paid: Starts at $19/month - unlimited projects, more storage

**Upstash**:
- Free tier: 10,000 commands/day
- Paid: Starts at $0.20 per 100K commands

**Render**:
- Free tier: Sleeps after 15min inactivity
- Paid: Starts at $7/month - always on, better performance

---

## 📝 Environment Variables Summary

### Required for Production:
```
NODE_ENV=production
PORT=8000
DATABASE_URL=postgres://... (from Neon)
REDIS_URL=rediss://... (from Upstash)
JWT_SECRET=<strong-random-string>
```

### Optional but Recommended:
```
FRONTEND_URL=https://your-frontend.vercel.app
JWT_EXPIRATION=7d
DB_LOGGING=false
DB_SYNCHRONIZE=false
```

### Blockchain/Crypto (if needed):
```
BSC_RPC_URL=https://bsc-dataseed.binance.org/
TRON_API_KEY=your-tron-api-key
```

---

## ✅ Deployment Checklist

- [ ] Neon database created and connection string copied
- [ ] Upstash Redis created and connection string copied
- [ ] Render account created and GitHub connected
- [ ] Backend service deployed on Render
- [ ] All environment variables set in Render
- [ ] Post-deploy migration command configured
- [ ] Health endpoint returns 200
- [ ] Swagger documentation accessible
- [ ] Database connection successful (check logs)
- [ ] Redis connection successful (check logs)
- [ ] Frontend updated with backend URL
- [ ] CORS configured for frontend domain
- [ ] API endpoints tested and working

---

## 🎉 You're Done!

Your backend is now live and ready to serve your frontend application!

**Backend URL**: `https://your-service.onrender.com`
**API Docs**: `https://your-service.onrender.com/api/docs`
**Health Check**: `https://your-service.onrender.com/health`

---

## 📞 Support

- **Render Docs**: https://render.com/docs
- **Neon Docs**: https://neon.tech/docs
- **Upstash Docs**: https://docs.upstash.com
- **NestJS Docs**: https://docs.nestjs.com

---

## 🔄 Updating/Re-deploying

1. Push changes to GitHub `main` branch
2. Render will automatically deploy (if auto-deploy enabled)
3. Migrations run automatically via post-deploy command
4. Service restarts with new code

---

**Last Updated**: 2025-01-03
**Stack Version**: NestJS 10.x, PostgreSQL 15+, Redis 6+

