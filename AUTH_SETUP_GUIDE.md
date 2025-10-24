# 🔐 Authentication Setup Guide

Complete guide to set up and test the authentication system for Seka Svara.

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis (optional but recommended)

## 🚀 Quick Setup

### 1. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your database credentials
# Minimum required settings:
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=seka_svara_db
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
```

### 2. Database Setup

```bash
# Option A: Using Docker (Recommended)
docker-compose up -d postgres redis

# Option B: Manual PostgreSQL setup
# Create database manually:
psql -U postgres
CREATE DATABASE seka_svara_db;
\q
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Database Migrations

```bash
# Run migrations to create users table
npm run migration:run
```

### 5. Seed Initial Data

```bash
# Create admin and test users
npm run seed
```

### 6. Start Development Server

```bash
npm run start:dev
```

## 🧪 Testing Authentication

### Option 1: Using the Test Script

```bash
# Run the automated test script
node test-auth.js
```

### Option 2: Using cURL

#### Register a new user:
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test123!",
    "confirmPassword": "Test123!"
  }'
```

#### Login:
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'
```

#### Logout (requires Bearer token):
```bash
curl -X POST http://localhost:8000/api/v1/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Option 3: Using Swagger UI

1. Start the server: `npm run start:dev`
2. Open: http://localhost:8000/api/docs
3. Navigate to the "auth" section
4. Test endpoints directly in the browser

## 📊 API Endpoints

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login user | No |
| POST | `/auth/refresh` | Refresh access token | No |
| POST | `/auth/logout` | Logout user | Yes |
| POST | `/auth/verify-email` | Verify email address | No |
| POST | `/auth/forgot-password` | Request password reset | No |
| POST | `/auth/reset-password` | Reset password | No |

### Request/Response Examples

#### Register Request:
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "Password123!",
  "confirmPassword": "Password123!"
}
```

#### Register Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "username": "john_doe",
    "email": "john@example.com",
    "role": "user",
    "status": "active",
    "emailVerified": false,
    "balance": 0,
    "totalGamesPlayed": 0,
    "totalGamesWon": 0,
    "totalWinnings": 0,
    "level": 1,
    "experience": 0,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## 🔒 Security Features

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number or special character

### Username Requirements
- Minimum 3 characters
- Only letters, numbers, and underscores allowed
- Must be unique

### JWT Configuration
- Access tokens expire in 7 days (configurable)
- Refresh tokens expire in 30 days (configurable)
- Tokens are stored securely in database

### Account Security
- Passwords are hashed with bcrypt (12 rounds)
- Email verification system (ready for implementation)
- Password reset functionality
- Account status management (active, inactive, banned, suspended)

## 👥 Default Users

After running `npm run seed`, you'll have:

### Admin User
- **Email:** admin@sekasvara.com
- **Password:** Admin123!
- **Role:** admin

### Test User
- **Email:** test@sekasvara.com
- **Password:** Test123!
- **Role:** user
- **Balance:** 1000 USDT

## 🛠️ Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```bash
# Check if PostgreSQL is running
pg_ctl status

# Or with Docker
docker ps | grep postgres
```

#### 2. Migration Errors
```bash
# Reset database (WARNING: This will delete all data)
npm run migration:revert
npm run migration:run
```

#### 3. JWT Secret Not Set
```bash
# Make sure JWT_SECRET is set in .env
echo $JWT_SECRET
```

#### 4. Port Already in Use
```bash
# Kill process on port 3000
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

### Debug Mode

```bash
# Start with debug logging
npm run start:debug
```

## 📝 Environment Variables

### Required Variables
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=seka_svara_db
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
```

### Optional Variables
```env
JWT_EXPIRATION=7d
JWT_REFRESH_EXPIRATION=30d
BCRYPT_ROUNDS=12
NODE_ENV=development
PORT=3000
```

## 🎯 Next Steps

1. **Test the endpoints** using the methods above
2. **Integrate with frontend** - use the API endpoints in your React app
3. **Add email verification** - implement SMTP configuration
4. **Add rate limiting** - configure throttling for auth endpoints
5. **Add 2FA** - implement two-factor authentication
6. **Add social login** - integrate Google/Facebook login

## 📚 Additional Resources

- [NestJS Authentication](https://docs.nestjs.com/security/authentication)
- [JWT Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
- [bcrypt Security](https://auth0.com/blog/hashing-in-action-understanding-bcrypt/)
- [TypeORM Migrations](https://typeorm.io/migrations)

## 🆘 Support

If you encounter issues:

1. Check the console logs for error messages
2. Verify your environment variables
3. Ensure PostgreSQL is running
4. Check the Swagger documentation at http://localhost:8000/api/docs
5. Review the test script output for specific error details

---

**Happy coding! 🚀**

