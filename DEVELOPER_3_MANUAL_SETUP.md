# 🛠️ Developer 3: Manual Setup Guide (No Docker)

## 📋 Overview

This guide is for **Developer 3** who cannot use Docker.  
You'll install PostgreSQL **manually on Windows** for authentication, user management, and admin panel development.

**⏱️ Total Time Required:** 30-60 minutes  
**✅ Your Role:** Authentication, Security, Users, Admin Panel, Notifications

---

## 🎯 What You Need

### **Services Required:**
1. **PostgreSQL 14.5** (Database for users, auth, sessions, admin data)
   - Stores user accounts, sessions, roles, permissions
   - Authentication tokens, refresh tokens
   - Admin panel data, analytics
   - Audit logs, security events

### **Services NOT Required:**
- ❌ **Redis** - Not critical for your auth work (Developer 2 uses this for WebSocket)
- You can skip Redis installation unless you want to test full integration

### **Why These Exact Versions:**
- Developer 1 & 2 use Docker with PostgreSQL 14.5 + Redis 7.0
- You must match their version to avoid compatibility issues
- Production server uses PostgreSQL 14.5
- **Critical:** Auth data, sessions, and user management must work consistently across all environments

---

## 📥 Step 1: Install PostgreSQL 14.5

### **Download:**
1. Go to: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
2. Select version: **PostgreSQL 14.5** (NOT 15.x, NOT 16.x)
3. Platform: **Windows x86-64**
4. Download the installer (approx. 250 MB)

### **Installation:**

```
1. Run the installer as Administrator
2. Installation Directory: C:\Program Files\PostgreSQL\14
3. Components: Select ALL
   ☑ PostgreSQL Server
   ☑ pgAdmin 4
   ☑ Stack Builder
   ☑ Command Line Tools

4. Data Directory: C:\Program Files\PostgreSQL\14\data

5. Password: postgres123
   ⚠️ IMPORTANT: Remember this password!

6. Port: 5432
   ⚠️ IMPORTANT: Must be 5432 (same as other developers)

7. Locale: [Default locale]

8. Click "Next" → "Next" → Install

⏱️ Installation takes 5-10 minutes
```

### **Verify Installation:**

```powershell
# Open PowerShell (run as Administrator)

# Check PostgreSQL version
psql --version
# Expected output: psql (PostgreSQL) 14.5

# Test connection
psql -U postgres -c "SELECT version();"
# Enter password: postgres123
# Should show PostgreSQL 14.5 info
```

✅ **Success:** You see version 14.5

---

## 🗄️ Step 2: Create Database and Enable Extensions

### **Option A: Using pgAdmin 4 (GUI)**

```
1. Open pgAdmin 4 (installed with PostgreSQL)
2. Connect to PostgreSQL:
   - Right-click "Servers" → Register → Server
   - Name: Local PostgreSQL
   - Host: localhost
   - Port: 5432
   - Username: postgres
   - Password: postgres123

3. Create Database:
   - Right-click "Databases" → Create → Database
   - Database name: seka_svara_dev
   - Owner: postgres
   - Click "Save"

4. Create User:
   - Right-click "Login/Group Roles" → Create → Login/Group Role
   - Name: seka_admin
   - Password: seka_pass_2024
   - Privileges tab: ☑ Can login
   - Click "Save"

5. Grant Permissions:
   - Right-click "seka_svara_dev" → Properties → Security
   - Add: seka_admin
   - Privileges: ALL
   - Click "Save"

6. Enable Extensions (for auth features):
   - Click on "seka_svara_dev"
   - Tools → Query Tool
   - Run these commands:
   
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "pgcrypto";
   
   - Click "Execute" (F5)
   - Should see: "CREATE EXTENSION"
```

### **Option B: Using Command Line (Faster)**

```powershell
# Open PowerShell

# Connect to PostgreSQL
psql -U postgres

# Enter password: postgres123

# Run these SQL commands:
CREATE DATABASE seka_svara_dev;
CREATE USER seka_admin WITH PASSWORD 'seka_pass_2024';
GRANT ALL PRIVILEGES ON DATABASE seka_svara_dev TO seka_admin;

# Connect to the new database
\c seka_svara_dev

# Enable extensions (for auth & security features)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

# Verify extensions
\dx

# Should show:
#   Name      | Version |   Schema   |         Description
# ------------+---------+------------+------------------------------
#  pgcrypto   | 1.3     | public     | cryptographic functions
#  uuid-ossp  | 1.1     | public     | generate universally unique identifiers

# Exit
\q
```

### **Verify Database and Extensions:**

```powershell
# Connect to your new database
psql -U seka_admin -d seka_svara_dev

# Enter password: seka_pass_2024

# Should see:
seka_svara_dev=>

# Check extensions
\dx

# Test uuid-ossp:
SELECT uuid_generate_v4();
# Should return a UUID like: 550e8400-e29b-41d4-a716-446655440000

# Test pgcrypto (for password hashing):
SELECT crypt('password123', gen_salt('bf'));
# Should return bcrypt hashed password

# Exit
\q
```

✅ **Success:** You can connect to `seka_svara_dev` and both extensions work

---

## 🔧 Step 3: Configure Project

### **Clone Repository (if not already done):**

```powershell
# Navigate to your workspace
cd D:\

# Clone the project (if not already done)
git clone https://github.com/neonflux-io/Seka-Svara-CP-For-Server.git team3

# Navigate to backend
cd team3\backend

# Switch to develop branch
git checkout develop

# Pull latest changes
git pull origin develop
```

### **Install Dependencies:**

```powershell
# Install Node modules
npm install

# This takes 2-3 minutes
```

### **Create Environment File:**

```powershell
# Copy example environment file
Copy-Item .env.example .env
```

### **Edit .env File:**

Open `backend/.env` in your code editor and set:

```env
# ========================================
# DATABASE CONFIGURATION (PostgreSQL)
# ========================================
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=seka_admin
DB_PASSWORD=seka_pass_2024
DB_DATABASE=seka_svara_dev

# ========================================
# JWT CONFIGURATION (Your Focus!)
# ========================================
JWT_SECRET=your-super-secret-jwt-key-change-in-production-2024-at-least-32-characters
JWT_EXPIRATION=7d
JWT_REFRESH_SECRET=your-super-secret-refresh-token-key-2024
JWT_REFRESH_EXPIRATION=30d

# ========================================
# SESSION CONFIGURATION
# ========================================
SESSION_SECRET=your-session-secret-key-at-least-32-characters

# ========================================
# SECURITY CONFIGURATION
# ========================================
BCRYPT_ROUNDS=10
PASSWORD_MIN_LENGTH=8
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=15m

# ========================================
# OAUTH CONFIGURATION (if implementing)
# ========================================
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=

# ========================================
# 2FA CONFIGURATION
# ========================================
TWO_FA_APP_NAME=SekaSvara
TWO_FA_ISSUER=SekaSvara

# ========================================
# EMAIL CONFIGURATION
# ========================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=noreply@sekasvara.com

# ========================================
# OPTIONAL: Redis (for session storage - not critical)
# ========================================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
# Leave empty if you're not running Redis

# ========================================
# SERVER CONFIGURATION
# ========================================
PORT=3000
NODE_ENV=development

# ========================================
# ADMIN CONFIGURATION
# ========================================
ADMIN_DEFAULT_EMAIL=admin@sekasvara.com
ADMIN_DEFAULT_PASSWORD=ChangeMe123!
```

⚠️ **IMPORTANT SECURITY NOTES:**
- **DO NOT commit `.env` to Git** (it's in `.gitignore`)
- Each developer has their own `.env` file
- Never push secrets, API keys, or credentials to GitHub
- Use strong, unique secrets for JWT and sessions

---

## ✅ Step 4: Test Your Setup

### **4.1: Test Database Connection**

```powershell
# Create a test script
New-Item -Path "test-db-dev3.js" -ItemType File
```

Add to `test-db-dev3.js`:

```javascript
// test-db-dev3.js - Developer 3 Database Test
const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'seka_admin',
  password: 'seka_pass_2024',
  database: 'seka_svara_dev',
});

async function testConnection() {
  try {
    await client.connect();
    console.log('✅ PostgreSQL connected successfully!');
    
    const versionResult = await client.query('SELECT version()');
    console.log('📊 Database version:', versionResult.rows[0].version);
    
    // Test uuid-ossp extension
    const uuidTest = await client.query('SELECT uuid_generate_v4() as id');
    console.log('🆔 uuid-ossp test: PASSED');
    console.log('   Generated UUID:', uuidTest.rows[0].id);
    
    // Test pgcrypto (password hashing)
    const hashTest = await client.query(`
      SELECT crypt('testpassword', gen_salt('bf')) as hash
    `);
    console.log('🔐 pgcrypto (bcrypt) test: PASSED');
    console.log('   Hashed password:', hashTest.rows[0].hash.substring(0, 30) + '...');
    
    await client.end();
    console.log('\n✅ All database tests passed! Ready for auth development!');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check PostgreSQL is running: Get-Service postgresql*');
    console.error('2. Verify password: postgres123 or seka_pass_2024');
    console.error('3. Check extensions installed: psql -U seka_admin -d seka_svara_dev -c "\\dx"');
    process.exit(1);
  }
}

testConnection();
```

```powershell
# Install pg package (if not already installed)
npm install pg

# Run test
node test-db-dev3.js

# Expected output:
# ✅ PostgreSQL connected successfully!
# 📊 Database version: PostgreSQL 14.5 on x86_64-pc-mingw64...
# 🆔 uuid-ossp test: PASSED
#    Generated UUID: 550e8400-e29b-41d4-a716-446655440000
# 🔐 pgcrypto (bcrypt) test: PASSED
#    Hashed password: $2a$10$rZ8kh...
# 
# ✅ All database tests passed! Ready for auth development!
```

### **4.2: Run Database Migrations**

```powershell
# Run TypeORM migrations (creates users, sessions, roles tables)
npm run migration:run

# Expected output:
# Migration UserEntity1697520000000 has been executed successfully.
# Migration SessionEntity1697520001000 has been executed successfully.
# Migration RoleEntity1697520002000 has been executed successfully.
# ...

# Verify tables created
psql -U seka_admin -d seka_svara_dev -c "\dt"

# Should show tables:
#  Schema |       Name       | Type  |   Owner
# --------+------------------+-------+-----------
#  public | users            | table | seka_admin
#  public | sessions         | table | seka_admin
#  public | roles            | table | seka_admin
#  public | permissions      | table | seka_admin
#  public | refresh_tokens   | table | seka_admin
#  public | audit_logs       | table | seka_admin
```

### **4.3: Start Development Server**

```powershell
# Start the NestJS backend
npm run start:dev

# Expected output:
# [Nest] 12345  - 10/18/2025, 10:30:00 AM     LOG [NestFactory] Starting Nest application...
# [Nest] 12345  - 10/18/2025, 10:30:01 AM     LOG [InstanceLoader] AppModule dependencies initialized
# [Nest] 12345  - 10/18/2025, 10:30:01 AM     LOG [InstanceLoader] TypeOrmModule dependencies initialized
# [Nest] 12345  - 10/18/2025, 10:30:02 AM     LOG [InstanceLoader] AuthModule dependencies initialized
# [Nest] 12345  - 10/18/2025, 10:30:02 AM     LOG [InstanceLoader] UserModule dependencies initialized
# [Nest] 12345  - 10/18/2025, 10:30:02 AM     LOG [NestApplication] Nest application successfully started
# [Nest] 12345  - 10/18/2025, 10:30:02 AM     LOG Server running on http://localhost:8000
```

✅ **Success:** Server starts without errors

### **4.4: Test Auth API**

Open a **new PowerShell window** (keep server running):

```powershell
# Test health check
curl http://localhost:8000/health

# Expected: {"status":"ok","timestamp":"2025-10-18T..."}

# Test database connection
curl http://localhost:8000/health/db

# Expected: {"status":"ok","database":"connected"}
```

---

## 📝 Step 5: Daily Workflow

### **Every Morning:**

```powershell
cd D:\team3\backend

# 1. Pull latest changes from develop
git checkout develop
git pull origin develop

# 2. Switch to your feature branch
git checkout feature/dev3-auth

# 3. Merge develop into your branch
git merge develop

# 4. Install any new dependencies
npm install

# 5. Run migrations (if any new)
npm run migration:run

# 6. Start development server
npm run start:dev
```

### **When You Complete a Feature:**

```powershell
# 1. Check your changes
git status

# 2. Add files
git add .

# 3. Commit with meaningful message
git commit -m "feat(auth): implement JWT authentication with refresh tokens"

# 4. Push to your branch
git push origin feature/dev3-auth

# 5. Notify Project Manager:
# "Feature ready for review: feature/dev3-auth"
```

### **When Merging to Develop:**

```powershell
# ⚠️ IMPORTANT: Ask Developer 1 or 2 to test your code in Docker first!

# They will run:
git checkout feature/dev3-auth
docker-compose up -d
npm run test:auth
npm run start:dev

# If tests pass → PM will merge your branch to develop
# If tests fail → You'll get feedback on what to fix
```

---

## ⚠️ Important Rules for Developer 3

### **✅ DO:**
1. Use **exact version**: PostgreSQL 14.5 (NOT 14.6, NOT 15.x)
2. **Always enable** uuid-ossp and pgcrypto extensions
3. Keep your `.env` file **local** (never commit)
4. **Pull from `develop`** every day before starting work
5. **Ask for Docker verification** before merging to `develop`
6. **Hash passwords** before storing (use bcrypt)
7. **Validate all user input** (email, passwords, usernames)
8. **Implement proper error handling** (don't leak sensitive info)

### **❌ DON'T:**
1. Don't upgrade PostgreSQL to 15.x or 16.x
2. Don't change port numbers (5432, 3000)
3. Don't commit `.env` file to Git
4. Don't store passwords in plain text (always hash)
5. Don't modify code to work around environment issues
6. Don't merge to `develop` without Docker verification from Dev 1 or 2
7. Don't log sensitive data (passwords, tokens, API keys)
8. Don't skip input validation or sanitization

---

## 🔒 Security Best Practices for Auth Development

### **1. Password Management:**

```typescript
// ❌ WRONG: Plain text storage
await userRepository.save({
  email: 'user@example.com',
  password: 'plain-text-password',  // NEVER DO THIS
});

// ✅ CORRECT: Hashed storage (use bcrypt)
import * as bcrypt from 'bcrypt';

const hashedPassword = await bcrypt.hash(password, 10);
await userRepository.save({
  email: 'user@example.com',
  password: hashedPassword,  // Safe
});

// Verify password
const isValid = await bcrypt.compare(inputPassword, user.password);
```

### **2. JWT Token Security:**

```typescript
// ✅ CORRECT: Strong JWT configuration
import { JwtService } from '@nestjs/jwt';

const token = this.jwtService.sign(
  { userId: user.id, email: user.email },
  {
    secret: process.env.JWT_SECRET,  // At least 32 characters
    expiresIn: '15m',  // Short-lived access tokens
  },
);

const refreshToken = this.jwtService.sign(
  { userId: user.id },
  {
    secret: process.env.JWT_REFRESH_SECRET,
    expiresIn: '7d',  // Longer-lived refresh tokens
  },
);
```

### **3. Input Validation:**

```typescript
// ✅ CORRECT: Validate all inputs
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain uppercase, lowercase, number, and special character',
  })
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  username: string;
}
```

---

## 🔍 Troubleshooting

### **Problem: PostgreSQL service won't start**

```powershell
# Check if port 5432 is in use
netstat -ano | findstr :5432

# If another service is using it:
# Option 1: Stop the other service
# Option 2: Change PostgreSQL port (NOT recommended)

# Start PostgreSQL service
Get-Service postgresql* | Start-Service
```

### **Problem: Can't connect to database**

```powershell
# Verify PostgreSQL is running
Get-Service postgresql*

# Test connection manually
psql -U seka_admin -d seka_svara_dev

# If password error → Reset password:
psql -U postgres
ALTER USER seka_admin WITH PASSWORD 'seka_pass_2024';
```

### **Problem: Extensions not found**

```sql
-- Connect as superuser
psql -U postgres -d seka_svara_dev

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verify
\dx

-- Should show both extensions in the list
```

### **Problem: Migration fails with encoding error**

```powershell
# Reset database with UTF-8 encoding
psql -U postgres
DROP DATABASE seka_svara_dev;
CREATE DATABASE seka_svara_dev 
  WITH ENCODING 'UTF8' 
  LC_COLLATE='English_United States.1252' 
  LC_CTYPE='English_United States.1252';
GRANT ALL PRIVILEGES ON DATABASE seka_svara_dev TO seka_admin;

# Reconnect and create extensions
\c seka_svara_dev
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

# Run migrations again
npm run migration:run
```

---

## 🆘 Getting Help

### **If Setup Fails:**

1. **Screenshot the error** (full terminal output)
2. **Check what step failed** (installation, connection, extension, migration?)
3. **Send to team chat** with:
   ```
   🆘 Developer 3 Setup Issue
   
   Step: [e.g. "Step 4.1: Test Database Connection"]
   Error: [paste full error message]
   Screenshot: [attach image]
   
   What I tried:
   - [list what you attempted]
   ```

4. **Project Manager will:**
   - Ask Developer 1 or 2 to help debug
   - Schedule a quick screen-share session
   - Provide alternative solution if needed

### **Contact Info:**

- **Project Manager:** [Your contact]
- **Developer 1:** [Contact] (Blockchain expert, can help with PostgreSQL)
- **Developer 2:** [Contact] (Can help with general setup)

---

## ✅ Verification Checklist

Before you start coding, verify ALL of these:

```
Developer 3 Setup Verification:
- [ ] PostgreSQL 14.5 installed
- [ ] psql --version shows 14.5
- [ ] Database 'seka_svara_dev' created
- [ ] User 'seka_admin' can connect
- [ ] uuid-ossp extension enabled
- [ ] pgcrypto extension enabled
- [ ] test-db-dev3.js passes (uuid and bcrypt test)
- [ ] Git repository cloned
- [ ] On 'develop' branch
- [ ] npm install completed (no errors)
- [ ] .env file configured with JWT secrets
- [ ] npm run migration:run succeeds
- [ ] npm run start:dev starts server
- [ ] curl http://localhost:8000/health returns OK
- [ ] Feature branch created (feature/dev3-auth)
```

**When ALL checkboxes are checked ✅ → You're ready to start auth development!**

---

## 🎯 What's Next?

After setup is complete, read these documents in order:

1. **DEVELOPER_3_PRODUCTION_TASKS.md**
   - Detailed Day 1, Day 2, Day 3 tasks
   - Authentication implementation
   - User management, admin panel
   - Security features, KYC/AML

2. **GIT_WORKFLOW.md**
   - Git commands reference
   - How to merge and resolve conflicts
   - Team collaboration process

3. **DOCKER_VS_MANUAL_SETUP.md**
   - Understand why Docker is important
   - Why manual setup has trade-offs
   - Long-term plan to standardize

4. **DOCKER_VERIFICATION_WORKFLOW.md**
   - How Developer 1 or 2 will verify your code
   - Communication templates
   - Merge process

5. **Start Coding!**
   - Follow Day 1 tasks in DEVELOPER_3_PRODUCTION_TASKS.md
   - Start with User entity and repository
   - Implement JWT authentication
   - Build registration and login endpoints

---

## 🔐 Auth Development Checklist

### **Day 1 - Foundation:**
- [ ] Create User entity (email, password, username, role)
- [ ] Implement user repository (CRUD operations)
- [ ] Set up bcrypt for password hashing
- [ ] Implement JWT authentication service
- [ ] Create registration endpoint
- [ ] Create login endpoint (with JWT tokens)
- [ ] Create refresh token endpoint
- [ ] Write unit tests for auth service

### **Day 2 - Advanced Features:**
- [ ] Implement 2FA (TOTP)
- [ ] OAuth integration (Google, Facebook)
- [ ] Role-Based Access Control (RBAC)
- [ ] Rate limiting & brute force protection
- [ ] Password reset flow
- [ ] Email verification
- [ ] Session management

### **Day 3 - Admin & Security:**
- [ ] Admin panel dashboard
- [ ] User management UI
- [ ] Fraud detection system
- [ ] Audit logging
- [ ] Security hardening
- [ ] Comprehensive testing
- [ ] Documentation and deployment

---

## 📞 Final Notes

**Remember:**
- Your manual setup is **temporary** (3-day deadline priority)
- After launch, we'll help you set up Docker properly
- Your environment is **close** to production, but Developer 1 & 2 (Docker) are **identical**
- Always verify features work in Docker environment before merging
- **Security is CRITICAL**: Never expose passwords, tokens, or secrets

**Special Notes for Auth:**
- Validate all user inputs
- Hash passwords with bcrypt (10 rounds minimum)
- Use strong JWT secrets (32+ characters)
- Implement rate limiting on login endpoints
- Log all authentication events (for audit)
- Never log sensitive data (passwords, tokens)

**You got this! 💪 Start building secure authentication! 🔐👤**

---

**Setup Time:** 30-60 minutes  
**Difficulty:** Medium (well documented)  
**Support:** Full team backing you up!

**Questions? Ask immediately in team chat. Don't waste time stuck!** 🚀

---

**Document Version:** 1.0  
**Last Updated:** October 18, 2025  
**Developer:** Developer 3 (Authentication & Security)  
**Status:** Active (Temporary 3-day manual setup)

