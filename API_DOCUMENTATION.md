# API Documentation

Base URL: `http://localhost:8000/api/v1`

Full Swagger Documentation: `http://localhost:8000/api/docs`

---

## Authentication Endpoints

### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "Password123!",
  "confirmPassword": "Password123!"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "username": "john_doe",
    "email": "john@example.com"
  }
}
```

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "Password123!"
}
```

### Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}
```

### Logout
```http
POST /auth/logout
Authorization: Bearer {access_token}
```

---

## User Endpoints

### Get Profile
```http
GET /users/profile
Authorization: Bearer {access_token}
```

### Update Profile
```http
PUT /users/profile
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "username": "new_username",
  "avatar": "https://..."
}
```

### Get User by ID
```http
GET /users/{userId}
Authorization: Bearer {access_token}
```

---

## Table Endpoints

### Get All Tables
```http
GET /tables?status=waiting&network=BEP20&page=1&limit=10
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "High Stakes Table",
      "status": "waiting",
      "network": "BEP20",
      "buyInAmount": 100,
      "minBet": 10,
      "maxBet": 1000,
      "currentPlayers": 2,
      "maxPlayers": 6,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "totalPages": 5
}
```

### Create Table
```http
POST /tables
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "My Table",
  "network": "BEP20",
  "buyInAmount": 100,
  "minBet": 10,
  "maxBet": 1000,
  "minPlayers": 2,
  "maxPlayers": 6,
  "isPrivate": false
}
```

### Join Table
```http
POST /tables/{tableId}/join
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "seatNumber": 1
}
```

### Leave Table
```http
POST /tables/{tableId}/leave
Authorization: Bearer {access_token}
```

---

## Game Endpoints

### Get Game State
```http
GET /game/{gameId}/state
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "in_progress",
  "currentRound": 1,
  "pot": 200,
  "currentBet": 50,
  "currentTurnPlayerId": "uuid",
  "players": [
    {
      "userId": "uuid",
      "position": 1,
      "betAmount": 50,
      "status": "active"
    }
  ]
}
```

### Perform Action
```http
POST /game/{gameId}/action
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "type": "bet",
  "amount": 50
}
```

**Action Types:**
- `bet` - Place a bet
- `call` - Match current bet
- `raise` - Raise the bet
- `fold` - Fold hand
- `check` - Check (pass)
- `all_in` - Bet all chips

### Get Game History
```http
GET /game/user/history
Authorization: Bearer {access_token}
```

---

## Wallet Endpoints

### Get Wallet
```http
GET /wallet
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "balance": 1000,
  "availableBalance": 800,
  "lockedBalance": 200,
  "bep20Address": "0x...",
  "trc20Address": "T..."
}
```

### Get Balance
```http
GET /wallet/balance
Authorization: Bearer {access_token}
```

### Generate Deposit Address
```http
POST /wallet/generate-address
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "network": "BEP20"
}
```

### Deposit
```http
POST /wallet/deposit
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "network": "BEP20",
  "amount": 100,
  "txHash": "0x..."
}
```

### Withdraw
```http
POST /wallet/withdraw
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "network": "BEP20",
  "amount": 100,
  "toAddress": "0x..."
}
```

---

## Transaction Endpoints

### Get User Transactions
```http
GET /transactions?page=1&limit=10&type=deposit
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "deposit",
      "amount": 100,
      "network": "BEP20",
      "status": "completed",
      "txHash": "0x...",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 20,
  "page": 1,
  "totalPages": 2
}
```

### Get Transaction by ID
```http
GET /transactions/{transactionId}
Authorization: Bearer {access_token}
```

### Verify Transaction
```http
GET /transactions/verify/{txHash}?network=BEP20
Authorization: Bearer {access_token}
```

---

## NFT Endpoints

### Get All NFTs (Marketplace)
```http
GET /nft?page=1&limit=12&category=avatar
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Cool Avatar #1",
      "description": "A unique avatar",
      "imageUrl": "https://...",
      "price": 50,
      "network": "BEP20",
      "status": "listed",
      "category": "avatar"
    }
  ],
  "total": 100,
  "page": 1,
  "totalPages": 9
}
```

### Get NFT by ID
```http
GET /nft/{nftId}
```

### Create/Mint NFT
```http
POST /nft
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "Cool Avatar #1",
  "description": "A unique avatar",
  "imageUrl": "https://...",
  "price": 50,
  "network": "BEP20",
  "category": "avatar"
}
```

### Buy NFT
```http
POST /nft/{nftId}/buy
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "network": "BEP20"
}
```

### Get User Collection
```http
GET /nft/user/collection
Authorization: Bearer {access_token}
```

---

## Leaderboard Endpoints

### Get Top Winners
```http
GET /leaderboard/top-winners?limit=10
```

### Get Top Players
```http
GET /leaderboard/top-players?limit=10
```

### Get Most Active
```http
GET /leaderboard/most-active?limit=10
```

### Get Statistics
```http
GET /leaderboard/statistics
```

---

## Admin Endpoints (Admin Only)

### Get Dashboard Stats
```http
GET /admin/dashboard
Authorization: Bearer {access_token}
```

### Get Settings
```http
GET /admin/settings
Authorization: Bearer {access_token}
```

### Update Settings
```http
PUT /admin/settings
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "platformFeePercentage": 5,
  "minBetAmount": 10,
  "maxBetAmount": 10000,
  "maintenanceMode": false
}
```

### Get All Users
```http
GET /admin/users?page=1&limit=10&status=active
Authorization: Bearer {access_token}
```

### Ban User
```http
POST /users/{userId}/ban
Authorization: Bearer {access_token}
```

---

## WebSocket Events

Connect to: `ws://localhost:8000/game`

### Client → Server Events

#### Authenticate
```javascript
socket.emit('authenticate', {
  userId: 'uuid',
  token: 'jwt_token'
});
```

#### Join Table
```javascript
socket.emit('join_table', {
  tableId: 'uuid'
});
```

#### Leave Table
```javascript
socket.emit('leave_table', {
  tableId: 'uuid'
});
```

#### Player Action
```javascript
socket.emit('player_action', {
  tableId: 'uuid',
  action: 'bet',
  amount: 50
});
```

#### Chat Message
```javascript
socket.emit('chat_message', {
  tableId: 'uuid',
  message: 'Good game!'
});
```

### Server → Client Events

#### Player Joined
```javascript
socket.on('player_joined', (data) => {
  // data: { userId, timestamp }
});
```

#### Player Left
```javascript
socket.on('player_left', (data) => {
  // data: { userId, timestamp }
});
```

#### Game Start
```javascript
socket.on('game_start', (data) => {
  // data: { gameId, players, ... }
});
```

#### Game End
```javascript
socket.on('game_end', (data) => {
  // data: { winnerId, pot, ... }
});
```

#### Turn Change
```javascript
socket.on('turn_change', (data) => {
  // data: { nextPlayerId }
});
```

#### Action Performed
```javascript
socket.on('action_performed', (data) => {
  // data: { userId, action, amount }
});
```

---

## Error Responses

All errors follow this format:

```json
{
  "statusCode": 400,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/auth/login",
  "method": "POST",
  "message": "Invalid credentials"
}
```

**Common Status Codes:**
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

- **Default:** 100 requests per minute per IP
- **Headers:**
  - `X-RateLimit-Limit`: 100
  - `X-RateLimit-Remaining`: 95
  - `X-RateLimit-Reset`: 1234567890

---

## Pagination

All list endpoints support pagination:

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10, max: 100)

**Response:**
```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 10,
  "totalPages": 10
}
```

---

## Testing with Postman

1. Import collection from `/postman/seka-svara.json`
2. Set environment variables:
   - `base_url`: http://localhost:8000/api/v1
   - `access_token`: Your JWT token
3. Run collection

---

## Testing with cURL

```bash
# Register
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"Test123!","confirmPassword":"Test123!"}'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# Get Profile
curl -X GET http://localhost:8000/api/v1/users/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

For complete interactive documentation, visit:
**http://localhost:8000/api/docs**

