# System Architecture

## 📐 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│                  (React/Next.js - Vite)                      │
└───────────────┬─────────────────────────────────────────────┘
                │
                │ REST API / WebSocket
                ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                             │
│                   (NestJS Backend)                           │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │   Auth   │   Game   │  Wallet  │   NFT    │  Admin   │  │
│  │  Module  │  Module  │  Module  │  Module  │  Module  │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
└───────┬───────────┬───────────┬────────────┬────────────────┘
        │           │           │            │
        ▼           ▼           ▼            ▼
  ┌──────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐
  │PostgreSQL│ │  Redis  │ │   BSC   │ │   Tron   │
  │ Database │ │  Cache  │ │ Network │ │ Network  │
  └──────────┘ └─────────┘ └─────────┘ └──────────┘
```

---

## 🏗️ Module Architecture

### Layer Structure

```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│     (Controllers / WebSocket)           │
├─────────────────────────────────────────┤
│         Business Logic Layer            │
│          (Services / DTOs)              │
├─────────────────────────────────────────┤
│         Data Access Layer               │
│     (Repositories / Entities)           │
├─────────────────────────────────────────┤
│         External Services               │
│  (Blockchain / APIs / Storage)          │
└─────────────────────────────────────────┘
```

---

## 📦 Module Dependencies

```
┌──────────────────────────────────────────────────────┐
│                    App Module                         │
└───────────┬──────────────────────────────────────────┘
            │
     ┌──────┼──────┬──────┬──────┬──────┬──────┐
     ▼      ▼      ▼      ▼      ▼      ▼      ▼
  ┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐
  │Auth ││Users││Game ││Table││Block││Wallet││ NFT │
  │ [1] ││ [1] ││ [2] ││ [2] ││chain││ [3] ││ [3] │
  └─────┘└─────┘└─────┘└─────┘│ [3] │└─────┘└─────┘
                               └─────┘
  [1] Developer 1
  [2] Developer 2
  [3] Developer 3
```

**Dependency Flow:**
- Auth → Users
- Game → Tables → Wallet
- Wallet → Blockchain
- NFT → Blockchain
- All → Auth (Guards)

---

## 🔐 Authentication Flow

```
┌────────┐                ┌────────┐                ┌──────────┐
│ Client │                │ Backend│                │ Database │
└───┬────┘                └───┬────┘                └────┬─────┘
    │                         │                          │
    │ POST /auth/register     │                          │
    ├────────────────────────>│                          │
    │                         │ Hash Password            │
    │                         ├─────────┐                │
    │                         │         │                │
    │                         │<────────┘                │
    │                         │                          │
    │                         │ Save User                │
    │                         ├─────────────────────────>│
    │                         │                          │
    │                         │<─────────────────────────┤
    │                         │                          │
    │                         │ Generate JWT             │
    │                         ├─────────┐                │
    │                         │         │                │
    │                         │<────────┘                │
    │                         │                          │
    │  { access_token, ... }  │                          │
    │<────────────────────────┤                          │
    │                         │                          │
    │ GET /users/profile      │                          │
    │ Authorization: Bearer   │                          │
    ├────────────────────────>│                          │
    │                         │ Verify JWT               │
    │                         ├─────────┐                │
    │                         │         │                │
    │                         │<────────┘                │
    │                         │                          │
    │                         │ Get User                 │
    │                         ├─────────────────────────>│
    │                         │                          │
    │                         │<─────────────────────────┤
    │                         │                          │
    │      User Profile       │                          │
    │<────────────────────────┤                          │
    │                         │                          │
```

---

## 🎮 Game Flow

```
┌───────────────────────────────────────────────────────────┐
│                   Game Lifecycle                           │
└───────────────────────────────────────────────────────────┘

1. CREATE TABLE
   Player creates table with buy-in amount
   ↓
2. PLAYERS JOIN
   Other players join the table (2-6 players)
   ↓
3. LOCK FUNDS
   Wallet locks buy-in amount for each player
   ↓
4. CREATE ESCROW
   Smart contract holds total pot
   ↓
5. START GAME
   Deal cards, set initial state
   ↓
6. GAMEPLAY LOOP
   ├─> Player Turn
   ├─> Action (Bet/Call/Raise/Fold)
   ├─> Update State
   ├─> Broadcast to All
   └─> Next Player
   ↓
7. DETERMINE WINNER
   Evaluate hands, find winner
   ↓
8. RELEASE ESCROW
   Transfer pot to winner (minus fee)
   ↓
9. UPDATE BALANCES
   Update wallet & user stats
   ↓
10. GAME COMPLETE
    Store history, show results
```

---

## 🌐 WebSocket Communication

```
┌─────────┐           ┌──────────────┐           ┌─────────┐
│Player 1 │           │ WebSocket    │           │Player 2 │
│         │           │   Gateway    │           │         │
└────┬────┘           └──────┬───────┘           └────┬────┘
     │                       │                        │
     │ Connect               │                        │
     ├──────────────────────>│                        │
     │                       │                        │
     │                       │           Connect      │
     │                       │<───────────────────────┤
     │                       │                        │
     │ join_table            │                        │
     ├──────────────────────>│                        │
     │                       │                        │
     │                       │ player_joined (broadcast)
     │                       ├───────────────────────>│
     │<──────────────────────┤                        │
     │                       │                        │
     │ player_action (bet)   │                        │
     ├──────────────────────>│                        │
     │                       │ Validate & Process     │
     │                       ├────────┐               │
     │                       │        │               │
     │                       │<───────┘               │
     │                       │                        │
     │                       │ action_performed       │
     │<──────────────────────┤───────────────────────>│
     │                       │                        │
     │                       │ turn_change            │
     │<──────────────────────┤───────────────────────>│
     │                       │                        │
```

---

## 💰 Blockchain Integration

```
┌────────────────────────────────────────────────────────┐
│                  Blockchain Layer                      │
└────────────────────────────────────────────────────────┘

USER ACTION                 BACKEND                 BLOCKCHAIN
─────────────────────────────────────────────────────────────

DEPOSIT
  │
  ├─> Send USDT             Monitor TX              BSC/Tron
  │   to deposit address    ├────────────────────>  Network
  │                         │                       │
  │                         │  Confirm TX           │
  │                         │<──────────────────────┤
  │                         │                       │
  │                         │  Update Wallet        
  │                         ├─> Balance++          
  │   Success Notification  │                       
  │<────────────────────────┤                       

WITHDRAWAL
  │
  ├─> Request Withdrawal    Validate Balance       
  │                         ├────────┐             
  │                         │        │             
  │                         │<───────┘             
  │                         │                       
  │                         │  Create TX            BSC/Tron
  │                         ├────────────────────>  Network
  │                         │                       │
  │                         │  Get TX Hash          │
  │                         │<──────────────────────┤
  │                         │                       │
  │   TX Hash               │  Wait Confirmation    
  │<────────────────────────┤                       
  │                         │                       
  │                         │  Update Wallet        
  │                         ├─> Balance--          

ESCROW (Game)
  │
  ├─> Start Game            Lock Funds             
  │                         ├─> Create Escrow      Smart
  │                         │                      Contract
  │                         │  Deposit to Escrow   │
  │                         ├────────────────────> │
  │                         │                      │
  │   ...Game Play...       │  Hold Funds          │
  │                         │                      │
  │   Game Ends             │  Determine Winner    
  │                         ├────────┐             │
  │                         │        │             │
  │                         │<───────┘             │
  │                         │                      │
  │                         │  Release to Winner   │
  │                         ├────────────────────> │
  │                         │  (minus platform fee)│
  │   Winner Receives       │                      │
  │<────────────────────────┤                      
```

---

## 💾 Database Schema Relationships

```
┌─────────┐
│  users  │
└────┬────┘
     │ 1:1
     ├──────> ┌─────────┐
     │        │ wallets │
     │        └─────────┘
     │ 1:N
     ├──────> ┌──────────────┐
     │        │ transactions │
     │        └──────────────┘
     │ 1:N
     ├──────> ┌──────────────┐
     │        │game_tables   │
     │        │(as creator)  │
     │        └──────┬───────┘
     │               │ 1:N
     │               └──────> ┌──────────────┐
     │                        │table_players │
     │ 1:N                    └──────────────┘
     ├──────> ┌──────────────┐
     │        │    games     │
     │        └──────┬───────┘
     │               │ 1:N
     │               └──────> ┌──────────────┐
     │                        │game_players  │
     │                        └──────────────┘
     │ 1:N
     └──────> ┌──────────────┐
              │     nfts     │
              │(as owner)    │
              └──────────────┘
```

---

## 🔄 Request Lifecycle

```
1. CLIENT REQUEST
   ↓
2. MIDDLEWARE
   - Helmet (Security)
   - CORS
   - Compression
   - Cookie Parser
   ↓
3. GUARDS
   - JWT Auth Guard (verify token)
   - Roles Guard (check permissions)
   ↓
4. INTERCEPTORS (Before)
   - Logging Interceptor
   ↓
5. PIPES
   - Validation Pipe (DTO validation)
   ↓
6. CONTROLLER
   - Route handler
   ↓
7. SERVICE
   - Business logic
   ↓
8. REPOSITORY
   - Database operations
   ↓
9. DATABASE
   - Execute query
   ↓
10. RESPONSE
    ↓
11. INTERCEPTORS (After)
    - Transform response
    - Logging
    ↓
12. EXCEPTION FILTERS
    - Handle errors
    ↓
13. CLIENT RESPONSE
```

---

## 🎯 Design Patterns Used

### 1. **Module Pattern**
Each feature is a self-contained module with its own:
- Controller (routes)
- Service (business logic)
- Repository (data access)
- DTOs (data transfer objects)
- Entities (database models)

### 2. **Dependency Injection**
- Services injected via constructor
- Loosely coupled components
- Easy testing with mocks

### 3. **Repository Pattern**
- TypeORM repositories for data access
- Abstraction over database operations
- Easy to swap data sources

### 4. **DTO Pattern**
- Data validation at API boundary
- Type safety
- Swagger documentation

### 5. **Guard Pattern**
- Reusable authorization logic
- JwtAuthGuard, RolesGuard
- Applied via decorators

### 6. **Observer Pattern**
- WebSocket events
- Real-time updates
- Event-driven architecture

### 7. **Strategy Pattern**
- Multiple blockchain networks
- BscService, TronService
- Common interface

---

## 🔒 Security Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Security Layers                       │
└────────────────────────────────────────────────────────┘

LAYER 1: Network Security
  ├─> HTTPS/TLS encryption
  ├─> Firewall rules
  └─> DDoS protection

LAYER 2: Application Security
  ├─> Helmet.js (HTTP headers)
  ├─> CORS configuration
  ├─> Rate limiting
  └─> Input validation

LAYER 3: Authentication
  ├─> JWT tokens
  ├─> Password hashing (bcrypt)
  ├─> Refresh tokens
  └─> Session management

LAYER 4: Authorization
  ├─> Role-based access (RBAC)
  ├─> Resource ownership
  └─> Permission checks

LAYER 5: Data Security
  ├─> SQL injection prevention
  ├─> XSS protection
  ├─> Sensitive data encryption
  └─> Secure key storage

LAYER 6: Blockchain Security
  ├─> Private key management
  ├─> Transaction signing
  ├─> Smart contract audits
  └─> Multi-sig wallets
```

---

## 📊 Performance Optimization

### 1. **Caching Strategy**
```
Redis Cache:
  ├─> User sessions
  ├─> Game states
  ├─> Leaderboard data
  └─> API responses (frequently accessed)
```

### 2. **Database Optimization**
- Indexes on frequently queried columns
- Connection pooling
- Query optimization
- Pagination for large datasets

### 3. **API Optimization**
- Response compression (gzip)
- Rate limiting
- Async operations
- Efficient data serialization

### 4. **WebSocket Optimization**
- Room-based broadcasting
- Message throttling
- Efficient state updates
- Connection pooling

---

## 🔧 Scalability Strategy

### Horizontal Scaling
```
          Load Balancer
                │
      ┌─────────┼─────────┐
      ▼         ▼         ▼
   Server 1  Server 2  Server 3
      │         │         │
      └────┬────┴────┬────┘
           ▼         ▼
      PostgreSQL  Redis
      (Read Replicas) (Cluster)
```

### Vertical Scaling
- Upgrade server resources
- Optimize queries
- Add database indexes
- Implement caching

---

## 📈 Monitoring & Observability

```
Application Metrics
  ├─> Request rate
  ├─> Response time
  ├─> Error rate
  └─> CPU/Memory usage

Business Metrics
  ├─> Active users
  ├─> Active games
  ├─> Transaction volume
  └─> Revenue

Blockchain Metrics
  ├─> Transaction success rate
  ├─> Gas prices
  ├─> Confirmation times
  └─> Wallet balances

Logs
  ├─> Application logs
  ├─> Error logs
  ├─> Access logs
  └─> Audit logs
```

---

## 🚀 Deployment Architecture

### Development
```
Developer Machine
  ├─> Node.js
  ├─> PostgreSQL (local)
  ├─> Redis (Docker)
  └─> Testnet wallets
```

### Staging
```
Staging Server
  ├─> Application (PM2)
  ├─> PostgreSQL (dedicated)
  ├─> Redis (dedicated)
  ├─> Testnet integration
  └─> CI/CD pipeline
```

### Production
```
Production Environment
  ├─> Load Balancer
  ├─> App Servers (3+)
  ├─> PostgreSQL (primary + replicas)
  ├─> Redis Cluster
  ├─> CDN (static assets)
  ├─> Mainnet integration
  └─> Monitoring & Alerting
```

---

## 🧪 Testing Strategy

```
Unit Tests (70%)
  ├─> Service methods
  ├─> Utility functions
  └─> Business logic

Integration Tests (20%)
  ├─> API endpoints
  ├─> Database operations
  └─> External services (mocked)

E2E Tests (10%)
  ├─> User flows
  ├─> Game playthrough
  └─> Critical paths
```

---

This architecture provides:
- ✅ **Modularity** - Easy to maintain and extend
- ✅ **Scalability** - Can handle growing user base
- ✅ **Security** - Multiple layers of protection
- ✅ **Performance** - Optimized for speed
- ✅ **Reliability** - Fault-tolerant design
- ✅ **Maintainability** - Clean code structure

---

**Architecture designed for:**
- Team collaboration
- Future growth
- High availability
- Rapid development

