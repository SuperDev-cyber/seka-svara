# Seka Svara Game API Documentation

**Version**: 1.0.0  
**Base URL**: `http://localhost:8000/api/v1`  
**Developer**: Developer 2  
**Last Updated**: October 18, 2025

---

## 📚 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Game Endpoints](#game-endpoints)
4. [WebSocket Events](#websocket-events)
5. [Data Models](#data-models)
6. [Error Handling](#error-handling)
7. [Examples](#examples)

---

## Overview

The Seka Svara Game API provides endpoints for:
- Creating and managing games
- Processing player actions (betting)
- Retrieving game state and history
- Real-time updates via WebSocket

### Official Seka Rules
All game logic follows official Seka Svara rules from [seka-ru.com](http://seka-ru.com/en/rules-seka.php):
- 36-card deck (6 to Ace)
- 3 cards per player
- Point-based scoring (not poker-style rankings)
- **7 of Clubs is joker**
- **Three 7s = 34 points (highest hand)**
- **Two Aces = always 22 points**

---

## Authentication

All endpoints require JWT authentication (except health check).

**Header:**
```http
Authorization: Bearer <jwt_token>
```

---

## Game Endpoints

### 1. Create Game

Create a new Seka Svara game.

**Endpoint:** `POST /games`

**Request Body:**
```json
{
  "tableId": "table-123",
  "playerIds": ["user-1", "user-2", "user-3"],
  "ante": 10
}
```

**Parameters:**
- `tableId` (string, required): Table identifier
- `playerIds` (array, required): Array of 2-10 player user IDs
- `ante` (number, optional): Ante amount per player (default: 0)

**Response:** `201 Created`
```json
{
  "gameId": "game-abc-123",
  "tableId": "table-123",
  "status": "in_progress",
  "phase": "betting",
  "bettingRound": 1,
  "pot": 30,
  "currentBet": 0,
  "currentPlayerId": "user-1",
  "players": [
    {
      "userId": "user-1",
      "position": 0,
      "currentBet": 0,
      "totalBet": 10,
      "status": "active",
      "hasActed": false,
      "hand": null
    }
  ],
  "startedAt": "2025-10-18T10:30:00Z"
}
```

**Errors:**
- `400 Bad Request`: Invalid player count (must be 2-10)
- `401 Unauthorized`: Invalid/missing JWT token
- `404 Not Found`: Table not found

---

### 2. Get Game State

Retrieve current game state.

**Endpoint:** `GET /games/:gameId`

**URL Parameters:**
- `gameId` (string, required): Game ID

**Response:** `200 OK`
```json
{
  "gameId": "game-abc-123",
  "phase": "betting",
  "status": "in_progress",
  "bettingRound": 2,
  "currentPlayerId": "user-2",
  "pot": 150,
  "currentBet": 50,
  "winners": [],
  "players": [
    {
      "userId": "user-1",
      "position": 0,
      "currentBet": 50,
      "totalBet": 60,
      "status": "active",
      "hasActed": true,
      "isWinner": false,
      "winnings": 0,
      "hand": null
    },
    {
      "userId": "user-2",
      "position": 1,
      "currentBet": 25,
      "totalBet": 35,
      "status": "active",
      "hasActed": false,
      "isWinner": false,
      "winnings": 0,
      "hand": null
    }
  ],
  "bettingHistory": [
    {
      "playerId": "user-1",
      "action": "bet",
      "amount": 50,
      "timestamp": "2025-10-18T10:31:00Z"
    }
  ],
  "startedAt": "2025-10-18T10:30:00Z",
  "finishedAt": null
}
```

**Notes:**
- `hand` is only visible during showdown/completed phase
- Each player can only see their own cards

**Errors:**
- `404 Not Found`: Game not found
- `401 Unauthorized`: Not authenticated

---

### 3. Perform Player Action

Execute a betting action for a player.

**Endpoint:** `POST /games/:gameId/actions`

**URL Parameters:**
- `gameId` (string, required): Game ID

**Request Body:**
```json
{
  "userId": "user-1",
  "action": {
    "type": "raise",
    "amount": 100
  }
}
```

**Action Types:**
- `bet` - Place initial bet (requires `amount`)
- `raise` - Increase current bet (requires `amount`)
- `call` - Match current bet (no `amount` needed)
- `fold` - Forfeit hand (no `amount` needed)
- `check` - Pass without betting (no `amount` needed)
- `all_in` or `allin` - Bet entire balance (no `amount` needed)

**Response:** `200 OK`
```json
{
  "gameId": "game-abc-123",
  "phase": "betting",
  "currentPlayerId": "user-2",
  "pot": 200,
  "currentBet": 100,
  "message": "Action processed successfully"
}
```

**Validation Rules:**
1. Must be player's turn (`currentPlayerId` must match)
2. Player must be active (not folded)
3. Game must be in betting phase
4. BET/RAISE: amount must be >= currentBet
5. CALL: only valid if currentBet > player's currentBet
6. CHECK: only valid if currentBet === player's currentBet
7. FOLD: always valid

**Errors:**
- `400 Bad Request`: Invalid action/amount
- `400 Bad Request`: Not your turn
- `400 Bad Request`: Invalid game phase
- `404 Not Found`: Game or player not found
- `401 Unauthorized`: Not authenticated

---

### 4. Get Available Actions

Get list of available actions for a player.

**Endpoint:** `GET /games/:gameId/players/:userId/actions`

**URL Parameters:**
- `gameId` (string, required): Game ID
- `userId` (string, required): User ID

**Response:** `200 OK`
```json
{
  "availableActions": [
    "fold",
    "call",
    "raise",
    "all_in"
  ],
  "currentBet": 50,
  "playerCurrentBet": 25,
  "callAmount": 25,
  "minRaise": 50
}
```

**Errors:**
- `404 Not Found`: Game or player not found

---

### 5. Start Game

Start a game that's in pending state.

**Endpoint:** `POST /games/:gameId/start`

**URL Parameters:**
- `gameId` (string, required): Game ID

**Request Body:**
```json
{
  "ante": 10
}
```

**Response:** `200 OK`
```json
{
  "gameId": "game-abc-123",
  "status": "in_progress",
  "phase": "betting",
  "message": "Game started successfully"
}
```

**Errors:**
- `400 Bad Request`: Game already started
- `400 Bad Request`: Not enough players (min 2)
- `404 Not Found`: Game not found

---

### 6. Get User Game History

Retrieve a user's game history.

**Endpoint:** `GET /users/:userId/games/history`

**URL Parameters:**
- `userId` (string, required): User ID

**Query Parameters:**
- `limit` (number, optional): Max results (default: 20)

**Response:** `200 OK`
```json
{
  "games": [
    {
      "gameId": "game-abc-123",
      "tableId": "table-123",
      "status": "completed",
      "position": 0,
      "totalBet": 150,
      "winnings": 450,
      "isWinner": true,
      "createdAt": "2025-10-18T10:30:00Z",
      "finishedAt": "2025-10-18T10:45:00Z"
    }
  ],
  "total": 1
}
```

---

### 7. Get User Active Games

Get all active games for a user.

**Endpoint:** `GET /users/:userId/games/active`

**URL Parameters:**
- `userId` (string, required): User ID

**Response:** `200 OK`
```json
{
  "activeGames": [
    {
      "gameId": "game-xyz-456",
      "tableId": "table-456",
      "status": "in_progress",
      "phase": "betting",
      "position": 1,
      "pot": 200,
      "currentPlayerId": "user-1",
      "isMyTurn": false
    }
  ],
  "total": 1
}
```

---

### 8. Cancel Game

Cancel a game (admin/force end).

**Endpoint:** `DELETE /games/:gameId`

**URL Parameters:**
- `gameId` (string, required): Game ID

**Response:** `200 OK`
```json
{
  "gameId": "game-abc-123",
  "status": "cancelled",
  "message": "Game cancelled, all bets refunded"
}
```

**Errors:**
- `400 Bad Request`: Cannot cancel completed game
- `404 Not Found`: Game not found

---

## WebSocket Events

Connect to WebSocket for real-time game updates.

**WebSocket URL:** `ws://localhost:8000/game`

### Client → Server Events

#### 1. Join Game Room
```json
{
  "event": "join_game",
  "data": {
    "gameId": "game-abc-123",
    "userId": "user-1"
  }
}
```

#### 2. Leave Game Room
```json
{
  "event": "leave_game",
  "data": {
    "gameId": "game-abc-123",
    "userId": "user-1"
  }
}
```

#### 3. Player Action
```json
{
  "event": "player_action",
  "data": {
    "gameId": "game-abc-123",
    "userId": "user-1",
    "action": {
      "type": "raise",
      "amount": 100
    }
  }
}
```

#### 4. Send Chat Message
```json
{
  "event": "chat_message",
  "data": {
    "gameId": "game-abc-123",
    "userId": "user-1",
    "message": "Good game!"
  }
}
```

---

### Server → Client Events

#### 1. Game State Update
Sent when game state changes.
```json
{
  "event": "game_state_updated",
  "data": {
    "gameId": "game-abc-123",
    "phase": "betting",
    "pot": 200,
    "currentBet": 100,
    "currentPlayerId": "user-2"
  }
}
```

#### 2. Player Action Broadcast
Sent when a player performs an action.
```json
{
  "event": "player_action_performed",
  "data": {
    "gameId": "game-abc-123",
    "playerId": "user-1",
    "action": "raise",
    "amount": 100,
    "newPot": 200,
    "newCurrentBet": 100,
    "nextPlayerId": "user-2"
  }
}
```

#### 3. Turn Notification
Sent when it becomes a player's turn.
```json
{
  "event": "your_turn",
  "data": {
    "gameId": "game-abc-123",
    "userId": "user-2",
    "availableActions": ["fold", "call", "raise", "all_in"],
    "currentBet": 100,
    "timeLimit": 30
  }
}
```

#### 4. Showdown Result
Sent when game reaches showdown.
```json
{
  "event": "showdown",
  "data": {
    "gameId": "game-abc-123",
    "players": [
      {
        "userId": "user-1",
        "hand": [
          {"suit": "♥", "rank": "7", "value": 7},
          {"suit": "♦", "rank": "7", "value": 7},
          {"suit": "♠", "rank": "7", "value": 7}
        ],
        "handDescription": "Three 7s (Sherkes) - 34 points",
        "points": 34
      }
    ],
    "winners": ["user-1"],
    "winnings": 450
  }
}
```

#### 5. Game Completed
Sent when game ends.
```json
{
  "event": "game_completed",
  "data": {
    "gameId": "game-abc-123",
    "winners": ["user-1"],
    "finalPot": 450,
    "winnings": {
      "user-1": 450
    },
    "platformFee": 22.5,
    "finishedAt": "2025-10-18T10:45:00Z"
  }
}
```

#### 6. Player Connected/Disconnected
```json
{
  "event": "player_disconnected",
  "data": {
    "gameId": "game-abc-123",
    "userId": "user-3",
    "status": "disconnected"
  }
}
```

#### 7. Chat Message
```json
{
  "event": "chat_message",
  "data": {
    "gameId": "game-abc-123",
    "userId": "user-1",
    "username": "Player1",
    "message": "Good game!",
    "timestamp": "2025-10-18T10:40:00Z"
  }
}
```

---

## Data Models

### Game
```typescript
{
  id: string;              // UUID
  tableId: string;         // Table reference
  status: GameStatus;      // 'pending' | 'in_progress' | 'completed' | 'cancelled'
  pot: number;            // Total pot amount
  currentBet: number;     // Current bet to match
  winnerId?: string;      // Winner user ID (deprecated, use state.winners)
  state: GameState;       // Current game state
  players: GamePlayer[];  // Array of players
  createdAt: Date;
  updatedAt: Date;
  finishedAt?: Date;
}
```

### GameState
```typescript
{
  phase: GamePhase;           // 'waiting' | 'dealing' | 'betting' | 'showdown' | 'completed'
  bettingRound: number;       // Current round (1-3)
  currentPlayerId: string;    // Whose turn
  pot: number;                // Total pot
  currentBet: number;         // Current bet
  bettingHistory: Bet[];      // All bets
  winners: string[];          // Winner IDs (multiple if tie)
  playerStates: object;       // Player-specific state
  startedAt: Date;
  completedAt?: Date;
}
```

### GamePlayer
```typescript
{
  id: string;
  gameId: string;
  userId: string;
  position: number;           // 0-9 (seat position)
  hand: Card[];              // Player's 3 cards
  betAmount: number;         // Current bet this round
  totalBet: number;          // Total bet in game
  status: PlayerStatus;      // 'active' | 'folded' | 'all_in' | 'disconnected'
  isWinner: boolean;
  winnings: number;
  hasActed: boolean;         // Has acted this round
}
```

### Card
```typescript
{
  suit: Suit;    // '♥' | '♦' | '♣' | '♠'
  rank: Rank;    // '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'
  value: number; // Point value (6-11)
  isJoker: boolean; // true for 7♣
}
```

### Hand Rankings (Official Seka Rules)
```typescript
enum HandRank {
  HIGH_CARD = 0,        // Highest card
  FLUSH = 1,            // Same suit
  TWO_ACES = 2,         // 2 Aces = 22 pts
  THREE_OF_A_KIND = 3,  // 3 same rank
  THREE_SEVENS = 4      // 3 Sevens = 34 pts (HIGHEST!)
}
```

---

## Error Handling

### Standard Error Response
```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request",
  "timestamp": "2025-10-18T10:30:00Z",
  "path": "/games/123/actions"
}
```

### Common Error Codes

| Code | Error | Description |
|------|-------|-------------|
| 400 | Bad Request | Invalid input/validation error |
| 401 | Unauthorized | Missing/invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | State conflict (e.g., game already started) |
| 500 | Internal Server Error | Server error |

---

## Examples

### Example 1: Complete Game Flow

```typescript
// 1. Create game
POST /games
{
  "tableId": "table-123",
  "playerIds": ["alice", "bob", "charlie"],
  "ante": 10
}
// Response: gameId = "game-abc-123"

// 2. Connect to WebSocket
ws://localhost:8000/game
{
  "event": "join_game",
  "data": { "gameId": "game-abc-123", "userId": "alice" }
}

// 3. Player 1 bets
POST /games/game-abc-123/actions
{
  "userId": "alice",
  "action": { "type": "bet", "amount": 50 }
}

// 4. Player 2 raises
POST /games/game-abc-123/actions
{
  "userId": "bob",
  "action": { "type": "raise", "amount": 100 }
}

// 5. Player 3 calls
POST /games/game-abc-123/actions
{
  "userId": "charlie",
  "action": { "type": "call" }
}

// 6. Player 1 calls
POST /games/game-abc-123/actions
{
  "userId": "alice",
  "action": { "type": "call" }
}

// 7. Showdown happens automatically
// WebSocket event: "showdown" with all hands revealed

// 8. Game completes
// WebSocket event: "game_completed" with winners and winnings
```

---

### Example 2: Query Game State

```bash
# Get current game state
curl -X GET http://localhost:8000/api/v1/games/game-abc-123 \
  -H "Authorization: Bearer <jwt_token>"

# Get available actions for player
curl -X GET http://localhost:8000/api/v1/games/game-abc-123/players/alice/actions \
  -H "Authorization: Bearer <jwt_token>"

# Get user's game history
curl -X GET http://localhost:8000/api/v1/users/alice/games/history?limit=10 \
  -H "Authorization: Bearer <jwt_token>"
```

---

## Testing

### Postman Collection
Import the included `seka-svara-game-api.postman_collection.json`

### Sample Test Scenarios

1. **Happy Path**: 3 players, complete game
2. **All Fold**: All players fold except one
3. **All-In**: Player goes all-in with side pots
4. **Tie (Svara)**: Two players with same points
5. **Disconnection**: Player disconnects mid-game
6. **Invalid Actions**: Test validation errors

---

## Rate Limiting

- **General endpoints**: 100 requests/minute per user
- **WebSocket**: 50 messages/minute per connection
- **Game actions**: 10 actions/minute per player

---

## Support

For issues or questions:
- **Developer**: Developer 2
- **Documentation**: This file + OFFICIAL_SEKA_RULES.md
- **Source Code**: `/src/modules/game/`

---

**Last Updated**: October 18, 2025  
**API Version**: 1.0.0  
**Status**: ✅ Core Implementation Complete, WebSocket In Progress

