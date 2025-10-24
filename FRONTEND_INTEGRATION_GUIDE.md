# Frontend Integration Guide - Seka Svara Game

**For**: Frontend Developers  
**From**: Developer 2 (Backend Game Logic)  
**Date**: October 18, 2025  
**Status**: ✅ Ready for Frontend Integration!

---

## 🎯 **Quick Start**

Your backend is **100% ready** for frontend integration with mock data! You can test all game features without waiting for other developers.

---

## 🚀 **Start the Backend Server**

```bash
# 1. Start Docker (PostgreSQL + Redis)
cd D:\developer2\backend\Seka-Svara-CP-For-Server
docker-compose -f docker-compose.dev2.yml up -d

# 2. Start the NestJS server
npm run start:dev

# Server will run on: http://localhost:8000
```

**✅ CORS is enabled** - Your frontend can connect from any origin during development!

---

## 🎮 **REST API Endpoints**

Base URL: `http://localhost:8000`

### **1. Create a Game**

```http
POST /games
Content-Type: application/json

{
  "tableId": "table-123",
  "playerIds": ["player1", "player2", "player3"],
  "ante": 10
}
```

**Response:**
```json
{
  "gameId": "game-abc-123",
  "status": "in_progress",
  "phase": "betting",
  "pot": 30,
  "currentPlayerId": "player1",
  "players": [...]
}
```

---

### **2. Get Game State**

```http
GET /games/{gameId}/state
```

**Response:**
```json
{
  "gameId": "game-abc-123",
  "phase": "betting",
  "pot": 150,
  "currentBet": 50,
  "currentPlayerId": "player2",
  "players": [
    {
      "userId": "player1",
      "position": 0,
      "currentBet": 50,
      "totalBet": 60,
      "status": "active",
      "hand": null
    }
  ]
}
```

---

### **3. Perform Action**

```http
POST /games/{gameId}/actions
Content-Type: application/json

{
  "userId": "player1",
  "action": {
    "type": "bet",
    "amount": 50
  }
}
```

**Action Types:**
- `"bet"` - Place initial bet (requires `amount`)
- `"raise"` - Increase bet (requires `amount`)
- `"call"` - Match current bet
- `"fold"` - Forfeit hand
- `"check"` - Pass without betting
- `"all_in"` - Bet everything

---

### **4. Get Available Actions**

```http
GET /games/{gameId}/players/{userId}/actions
```

**Response:**
```json
{
  "availableActions": ["fold", "call", "raise", "all_in"],
  "currentBet": 50,
  "playerCurrentBet": 25,
  "callAmount": 25
}
```

---

### **5. Get User History**

```http
GET /games/users/{userId}/history?limit=20
```

---

### **6. Get Active Games**

```http
GET /games/users/{userId}/active
```

---

## 🔌 **WebSocket Connection**

Connect to: `ws://localhost:8000/game`

### **Example Frontend Code:**

```javascript
import io from 'socket.io-client';

// Connect to WebSocket
const socket = io('http://localhost:8000/game');

// 1. Authenticate (optional for testing)
socket.emit('authenticate', {
  userId: 'player1',
  token: 'mock-token-123' // Any string works for now
});

// 2. Join game room
socket.emit('join_game', {
  gameId: 'game-abc-123',
  userId: 'player1'
});

// 3. Listen for game state updates
socket.on('game_state_updated', (data) => {
  console.log('Game state:', data);
  // Update your UI with new game state
});

// 4. Listen for your turn
socket.on('your_turn', (data) => {
  console.log('Your turn!', data);
  console.log('Available actions:', data.availableActions);
  // Show action buttons: BET, RAISE, CALL, FOLD, etc.
});

// 5. Perform action
socket.emit('player_action', {
  gameId: 'game-abc-123',
  userId: 'player1',
  action: {
    type: 'bet',
    amount: 50
  }
});

// 6. Listen for other players' actions
socket.on('player_action_performed', (data) => {
  console.log(`${data.playerId} performed ${data.action}`);
  // Update UI to show what other players did
});

// 7. Listen for showdown
socket.on('showdown', (data) => {
  console.log('Showdown!', data);
  // Show all players' hands
  // Display winners
});

// 8. Listen for game completion
socket.on('game_completed', (data) => {
  console.log('Game over!', data);
  console.log('Winners:', data.winners);
  console.log('Winnings:', data.winnings);
  // Show final results
});

// 9. Send chat message
socket.emit('chat_message', {
  gameId: 'game-abc-123',
  userId: 'player1',
  message: 'Good game!'
});

// 10. Listen for chat messages
socket.on('chat_message', (data) => {
  console.log(`${data.userId}: ${data.message}`);
  // Display in chat UI
});
```

---

## 💰 **Mock Wallet Service**

**Good news!** The backend includes a mock wallet service for testing:

- ✅ Each player starts with **10,000 virtual currency**
- ✅ Balances are tracked in-memory
- ✅ All betting actions work
- ✅ Winnings are credited automatically
- ✅ No need to wait for Developer 3!

**Test Users Pre-configured:**
- `player1` - 10,000 balance
- `player2` - 10,000 balance
- `player3` - 10,000 balance
- `player4` - 10,000 balance
- `player5` - 10,000 balance

**Any new userId gets 10,000 automatically!**

---

## 🎮 **Complete Game Flow Example**

```javascript
// 1. Create a game
const createResponse = await fetch('http://localhost:8000/games', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tableId: 'table-1',
    playerIds: ['player1', 'player2', 'player3'],
    ante: 10
  })
});
const game = await createResponse.json();
console.log('Game created:', game.gameId);

// 2. Connect to WebSocket
const socket = io('http://localhost:8000/game');
socket.emit('join_game', {
  gameId: game.gameId,
  userId: 'player1'
});

// 3. Wait for your turn
socket.on('your_turn', async (data) => {
  // Player 1's turn - let's bet 50
  if (data.userId === 'player1') {
    socket.emit('player_action', {
      gameId: game.gameId,
      userId: 'player1',
      action: { type: 'bet', amount: 50 }
    });
  }
});

// 4. Game continues automatically
// - Players take turns
// - Betting rounds complete
// - Showdown happens automatically
// - Winners determined
// - Prizes distributed

// 5. Listen for completion
socket.on('game_completed', (data) => {
  console.log('Game finished!');
  console.log('Winners:', data.winners);
  console.log('Final pot:', data.finalPot);
});
```

---

## 🧪 **Testing Scenarios**

### **Scenario 1: Simple 3-Player Game**

```javascript
// Create game
POST /games
{
  "tableId": "test-1",
  "playerIds": ["alice", "bob", "charlie"],
  "ante": 10
}

// Players bet in sequence
// alice: BET 50
// bob: CALL
// charlie: RAISE 100
// alice: CALL
// bob: FOLD
// charlie wins!
```

### **Scenario 2: All-in Scenario**

```javascript
// alice: BET 50
// bob: ALL_IN (all remaining balance)
// charlie: CALL
// Automatic side pot calculation
// Showdown determines winners for each pot
```

### **Scenario 3: Everyone Folds Except One**

```javascript
// alice: BET 100
// bob: FOLD
// charlie: FOLD
// alice wins automatically (no showdown)
```

---

## 🎨 **UI Components You'll Need**

### **1. Game Table Component**
- Show 3 cards per player (face down until showdown)
- Display pot amount
- Show current bet
- Highlight current player's turn

### **2. Action Buttons**
- BET (with amount input)
- RAISE (with amount input)
- CALL
- FOLD
- CHECK
- ALL-IN

### **3. Player Info**
- Username
- Current bet
- Total chips
- Status (active/folded/all-in)

### **4. Game State**
- Phase (betting/showdown/completed)
- Pot amount
- Current bet
- Betting round (1, 2, or 3)

### **5. Results Display**
- Show all hands at showdown
- Highlight winners
- Display winnings
- Show hand descriptions (e.g., "Three 7s - 34 points")

---

## 🎴 **Card Display**

Cards are returned as:
```json
{
  "suit": "♥",
  "rank": "A",
  "value": 11,
  "isJoker": false
}
```

**Suits:** ♥ ♦ ♣ ♠  
**Ranks:** 6, 7, 8, 9, 10, J, Q, K, A  
**Joker:** 7♣ (7 of Clubs)

---

## 🐛 **Debugging**

### **Check Server Status**
```bash
curl http://localhost:8000/api/v1/health
```

### **View Logs**
The backend logs all actions:
```
💰 Deducted 50 from player1. New balance: 9950
🎮 Player player1 performed BET 50 in game game-abc-123
📢 Broadcasting game state to room game:game-abc-123
```

### **Check Database**
```bash
# Connect to PostgreSQL
docker exec -it seka-postgres-dev2 psql -U postgres -d seka_svara

# View games
SELECT * FROM games;

# View players
SELECT * FROM game_players;
```

---

## ⚠️ **Known Limitations (for now)**

1. **No actual authentication** - Any userId works
2. **Mock wallet** - Balances reset on server restart
3. **No persistence** - Games lost on server restart (use database for real games)
4. **No Developer 1 integration** - Tables module not connected yet
5. **No Developer 3 integration** - Real wallet not connected yet

**These are intentional for frontend testing!**

---

## ✅ **What's Fully Functional**

- ✅ Complete game logic (official Seka Svara rules)
- ✅ All 6 betting actions
- ✅ Turn management
- ✅ Pot calculation
- ✅ Side pots for all-in
- ✅ Showdown logic
- ✅ Winner determination
- ✅ Prize distribution
- ✅ Real-time WebSocket updates
- ✅ Chat system
- ✅ Player disconnect handling
- ✅ Game history
- ✅ Mock wallet (10,000 per player)

---

## 🚀 **Next Steps**

1. **Build your frontend UI**
2. **Connect to REST API**
3. **Connect to WebSocket**
4. **Test all features**
5. **Report any bugs** to Developer 2

---

## 📞 **Need Help?**

### **Backend API not responding?**
- Check server is running: `npm run start:dev`
- Check Docker is running: `docker ps`
- Check port 3001 is not in use

### **WebSocket not connecting?**
- Make sure you're using `http://` not `https://`
- Check Socket.IO client version matches server

### **Game logic questions?**
- See `OFFICIAL_SEKA_RULES.md` for complete rules
- See `GAME_API_DOCUMENTATION.md` for API details

---

## 🎉 **You're Ready to Build!**

Everything you need is ready:
- ✅ Backend server running
- ✅ REST API complete
- ✅ WebSocket functional
- ✅ Mock data available
- ✅ All game features working

**Start building your frontend and test the full game flow!** 🚀

---

**Developer**: Developer 2  
**Backend URL**: `http://localhost:8000`  
**WebSocket URL**: `ws://localhost:8000/game`  
**Status**: ✅ Ready for Frontend Integration!

