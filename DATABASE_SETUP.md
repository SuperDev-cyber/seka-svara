# Database Setup Guide

## PostgreSQL Installation

### Windows
1. Download PostgreSQL from https://www.postgresql.org/download/windows/
2. Run the installer
3. Set password for postgres user
4. Default port: 5432

### macOS
```bash
brew install postgresql@14
brew services start postgresql@14
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

---

## Database Creation

### Using psql
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE seka_svara_db;

# Create user (optional)
CREATE USER seka_user WITH PASSWORD 'your_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE seka_svara_db TO seka_user;

# Exit
\q
```

### Using pgAdmin
1. Open pgAdmin
2. Right-click on "Databases"
3. Select "Create" → "Database"
4. Enter name: `seka_svara_db`
5. Click "Save"

---

## Environment Configuration

Update your `.env` file:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=seka_svara_db
DB_SYNCHRONIZE=true  # Only for development!
DB_LOGGING=true
```

⚠️ **Warning:** Never use `DB_SYNCHRONIZE=true` in production!

---

## Running Migrations

### Create a migration
```bash
npm run migration:generate -- src/database/migrations/InitialSchema
```

### Run migrations
```bash
npm run migration:run
```

### Revert migration
```bash
npm run migration:revert
```

---

## Database Schema

### Tables

#### 1. users
- id (UUID, PK)
- username (VARCHAR, UNIQUE)
- email (VARCHAR, UNIQUE)
- password (VARCHAR)
- role (ENUM: user, admin, moderator)
- status (ENUM: active, inactive, banned)
- balance (DECIMAL)
- totalGamesPlayed (INT)
- totalGamesWon (INT)
- totalWinnings (DECIMAL)
- createdAt (TIMESTAMP)
- updatedAt (TIMESTAMP)

#### 2. wallets
- id (UUID, PK)
- userId (UUID, FK)
- balance (DECIMAL)
- availableBalance (DECIMAL)
- lockedBalance (DECIMAL)
- bep20Address (VARCHAR)
- trc20Address (VARCHAR)
- createdAt (TIMESTAMP)

#### 3. game_tables
- id (UUID, PK)
- name (VARCHAR)
- creatorId (UUID, FK)
- status (ENUM: waiting, playing, finished)
- network (ENUM: BEP20, TRC20)
- buyInAmount (DECIMAL)
- minBet (DECIMAL)
- maxBet (DECIMAL)
- currentPlayers (INT)
- maxPlayers (INT)
- createdAt (TIMESTAMP)

#### 4. games
- id (UUID, PK)
- tableId (UUID, FK)
- status (ENUM: waiting, in_progress, finished)
- pot (DECIMAL)
- winnerId (UUID, FK)
- gameState (JSON)
- createdAt (TIMESTAMP)
- finishedAt (TIMESTAMP)

#### 5. game_players
- id (UUID, PK)
- gameId (UUID, FK)
- userId (UUID, FK)
- position (INT)
- hand (JSON)
- betAmount (DECIMAL)
- status (ENUM: active, folded, all_in)
- isWinner (BOOLEAN)
- winnings (DECIMAL)

#### 6. transactions
- id (UUID, PK)
- userId (UUID, FK)
- type (ENUM: deposit, withdrawal, bet, win)
- amount (DECIMAL)
- network (ENUM: BEP20, TRC20)
- txHash (VARCHAR)
- status (ENUM: pending, completed, failed)
- createdAt (TIMESTAMP)

#### 7. nfts
- id (UUID, PK)
- name (VARCHAR)
- description (TEXT)
- imageUrl (VARCHAR)
- creatorId (UUID, FK)
- ownerId (UUID, FK)
- price (DECIMAL)
- status (ENUM: listed, sold, unlisted)
- createdAt (TIMESTAMP)

#### 8. notifications
- id (UUID, PK)
- userId (UUID, FK)
- title (VARCHAR)
- message (TEXT)
- type (VARCHAR)
- isRead (BOOLEAN)
- createdAt (TIMESTAMP)

#### 9. platform_settings
- id (INT, PK)
- platformFeePercentage (DECIMAL)
- minBetAmount (DECIMAL)
- maxBetAmount (DECIMAL)
- maintenanceMode (BOOLEAN)
- updatedAt (TIMESTAMP)

---

## Sample Data (Seeds)

Create file: `src/database/seeds/run-seeds.ts`

```typescript
import { DataSource } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import * as bcrypt from 'bcrypt';

const seedDatabase = async () => {
  const dataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'postgres',
    database: 'seka_svara_db',
    entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
  });

  await dataSource.initialize();

  // Seed admin user
  const userRepo = dataSource.getRepository(User);
  const adminExists = await userRepo.findOne({ where: { email: 'admin@sekasvara.com' } });

  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    await userRepo.save({
      username: 'admin',
      email: 'admin@sekasvara.com',
      password: hashedPassword,
      role: 'admin',
      emailVerified: true,
    });
    console.log('Admin user created');
  }

  await dataSource.destroy();
};

seedDatabase().catch(console.error);
```

Run seeds:
```bash
npm run seed
```

---

## Redis Setup (for WebSocket & Caching)

### Installation

**Windows:**
- Download from https://github.com/microsoftarchive/redis/releases
- Or use Docker: `docker run -d -p 6379:6379 redis`

**macOS:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt install redis-server
sudo systemctl start redis
```

### Configuration

Update `.env`:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### Test Connection
```bash
redis-cli ping
# Should return: PONG
```

---

## Backup & Restore

### Backup
```bash
pg_dump -U postgres seka_svara_db > backup.sql
```

### Restore
```bash
psql -U postgres -d seka_svara_db < backup.sql
```

---

## Troubleshooting

### Connection Issues
1. Check PostgreSQL is running:
   ```bash
   # Windows
   services.msc
   
   # Linux/Mac
   sudo systemctl status postgresql
   ```

2. Check pg_hba.conf for authentication settings

3. Verify port is not blocked by firewall

### Migration Errors
1. Drop all tables and rerun:
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```

2. Check entity definitions match migration files

### Performance Issues
1. Add indexes:
   ```sql
   CREATE INDEX idx_users_email ON users(email);
   CREATE INDEX idx_games_status ON games(status);
   ```

2. Enable query logging in `.env`:
   ```env
   DB_LOGGING=true
   ```

---

## Production Considerations

1. **Never use DB_SYNCHRONIZE=true**
2. Always use migrations
3. Enable SSL connections
4. Regular backups (automated)
5. Connection pooling
6. Query optimization
7. Index frequently queried columns
8. Monitor slow queries

---

## Useful Commands

```bash
# Connect to database
psql -U postgres -d seka_svara_db

# List tables
\dt

# Describe table
\d users

# Show all databases
\l

# Show current connection
\conninfo

# Exit
\q
```

---

## Next Steps

1. ✅ Install PostgreSQL
2. ✅ Create database
3. ✅ Configure .env
4. ✅ Run migrations
5. ✅ Seed initial data
6. ✅ Test connection
7. ✅ Start development!

