# Deployment Guide

## Production Deployment Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Code reviewed and merged
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Smart contracts deployed
- [ ] SSL certificates obtained
- [ ] Domain DNS configured
- [ ] Monitoring setup
- [ ] Backup strategy in place

---

## Environment Variables

Create `.env.production`:

```env
# Application
NODE_ENV=production
PORT=3000
API_PREFIX=api/v1

# Database
DB_HOST=your-db-host
DB_PORT=5432
DB_USERNAME=your-db-user
DB_PASSWORD=your-secure-password
DB_NAME=seka_svara_production
DB_SYNCHRONIZE=false
DB_LOGGING=false

# Redis
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# JWT
JWT_SECRET=your-very-secure-secret-key-min-32-chars
JWT_EXPIRATION=7d
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRATION=30d

# Blockchain
BSC_RPC_URL=https://bsc-dataseed.binance.org/
BSC_USDT_CONTRACT=0x55d398326f99059fF775485246999027B3197955
BSC_PRIVATE_KEY=your-bsc-private-key
ESCROW_CONTRACT_BSC=your-deployed-escrow-address

TRON_FULL_NODE=https://api.trongrid.io
TRON_USDT_CONTRACT=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
TRON_PRIVATE_KEY=your-tron-private-key
TRON_API_KEY=your-trongrid-api-key
ESCROW_CONTRACT_TRON=your-deployed-escrow-address

# Security
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
CORS_ORIGINS=https://your-domain.com

# Platform
PLATFORM_FEE_PERCENTAGE=5
MIN_BET_AMOUNT=10
MAX_BET_AMOUNT=10000
```

---

## Docker Deployment

### Build Image
```bash
docker build -t seka-svara-backend .
```

### Run with Docker Compose
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Check Logs
```bash
docker-compose logs -f backend
```

### Stop Services
```bash
docker-compose down
```

---

## VPS Deployment (Ubuntu/Debian)

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install Redis
sudo apt install redis-server -y

# Install Nginx
sudo apt install nginx -y

# Install PM2
sudo npm install -g pm2
```

### 2. Database Setup

```bash
# Create database
sudo -u postgres psql
CREATE DATABASE seka_svara_production;
CREATE USER seka_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE seka_svara_production TO seka_user;
\q
```

### 3. Deploy Application

```bash
# Clone repository
git clone https://github.com/your-repo/seka-svara-backend.git
cd seka-svara-backend/backend

# Install dependencies
npm ci --only=production

# Build application
npm run build

# Run migrations
npm run migration:run

# Start with PM2
pm2 start dist/main.js --name seka-backend
pm2 save
pm2 startup
```

### 4. Nginx Configuration

```nginx
# /etc/nginx/sites-available/seka-svara
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket support
    location /game {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/seka-svara /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d api.your-domain.com
```

---

## AWS Deployment

### 1. RDS (PostgreSQL)

1. Create RDS instance
2. Select PostgreSQL 14
3. Set master password
4. Configure security group
5. Note endpoint

### 2. ElastiCache (Redis)

1. Create Redis cluster
2. Configure security group
3. Note endpoint

### 3. EC2 Instance

1. Launch Ubuntu 22.04 instance
2. Configure security group (ports 22, 80, 443, 3000)
3. Follow VPS deployment steps above

### 4. Load Balancer (Optional)

1. Create Application Load Balancer
2. Configure target group
3. Add SSL certificate
4. Route traffic to EC2

---

## Heroku Deployment

### 1. Setup

```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create seka-svara-backend

# Add PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Add Redis
heroku addons:create heroku-redis:hobby-dev
```

### 2. Configure

```bash
# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secret
# ... set all other env vars

# Deploy
git push heroku main

# Run migrations
heroku run npm run migration:run
```

---

## Monitoring & Logging

### PM2 Monitoring

```bash
# View logs
pm2 logs seka-backend

# Monitor
pm2 monit

# Status
pm2 status
```

### Application Logs

Logs stored in:
- `/var/log/seka-svara/error.log`
- `/var/log/seka-svara/combined.log`

### Setup Log Rotation

```bash
# /etc/logrotate.d/seka-svara
/var/log/seka-svara/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reload seka-backend
    endscript
}
```

---

## Backup Strategy

### Database Backup

```bash
# Create backup script
#!/bin/bash
BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump -U seka_user seka_svara_production > $BACKUP_DIR/backup_$TIMESTAMP.sql
# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
```

```bash
# Add to crontab (daily at 2 AM)
0 2 * * * /path/to/backup-script.sh
```

### Upload to S3 (Optional)

```bash
aws s3 cp /backups/postgres/backup_$TIMESTAMP.sql s3://your-bucket/backups/
```

---

## Health Checks

### Endpoint

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected",
  "uptime": 123456
}
```

### Monitoring Services

- **Uptime Robot**: https://uptimerobot.com
- **Pingdom**: https://pingdom.com
- **New Relic**: https://newrelic.com
- **Datadog**: https://datadoghq.com

---

## Security Hardening

### 1. Firewall

```bash
# UFW
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. Fail2Ban

```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. SSH Keys Only

```bash
# /etc/ssh/sshd_config
PasswordAuthentication no
PermitRootLogin no
```

### 4. Regular Updates

```bash
sudo apt update && sudo apt upgrade -y
```

---

## Performance Optimization

### 1. Enable Compression

Already configured in `main.ts` with `compression` middleware.

### 2. Database Connection Pooling

Configure in `database.config.ts`:

```typescript
extra: {
  max: 20,
  min: 5,
  acquire: 30000,
  idle: 10000
}
```

### 3. Redis Caching

Implement caching for:
- User sessions
- Game states
- Leaderboard data

### 4. CDN

Use CDN for:
- Static assets
- NFT images
- Frontend files

---

## Rollback Plan

### Quick Rollback

```bash
# PM2
pm2 stop seka-backend
git checkout previous-tag
npm run build
npm run migration:revert
pm2 start seka-backend
```

### Database Rollback

```bash
# Restore from backup
psql -U seka_user seka_svara_production < backup_file.sql
```

---

## Scaling Strategies

### Horizontal Scaling

1. Deploy multiple instances
2. Use load balancer
3. Share Redis for sessions
4. Use read replicas for database

### Vertical Scaling

1. Upgrade server resources
2. Optimize database queries
3. Add indexes
4. Implement caching

---

## Troubleshooting

### Application Won't Start

1. Check logs: `pm2 logs`
2. Verify env variables
3. Check database connection
4. Verify ports are open

### Database Connection Issues

1. Check PostgreSQL is running
2. Verify credentials
3. Check firewall rules
4. Test connection: `psql -h host -U user -d database`

### High CPU Usage

1. Check slow queries
2. Add database indexes
3. Optimize game logic
4. Implement caching

---

## Post-Deployment

- [ ] Test all endpoints
- [ ] Verify WebSocket connections
- [ ] Test deposit/withdrawal
- [ ] Check monitoring alerts
- [ ] Verify backups working
- [ ] Load testing
- [ ] Security scan
- [ ] Update documentation

---

## Support Contacts

- DevOps Lead: devops@your-domain.com
- Database Admin: dba@your-domain.com
- Security Team: security@your-domain.com

---

**Deployment Checklist Complete! 🚀**

