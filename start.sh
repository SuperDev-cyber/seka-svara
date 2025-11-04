#!/bin/sh
set -e

# Run migrations before starting the server
echo "🔄 Running database migrations..."
if [ -f "dist/config/typeorm.config.js" ]; then
  npx typeorm migration:run -d dist/config/typeorm.config.js || echo "⚠️ Migration failed, continuing anyway..."
else
  echo "⚠️ TypeORM config not found, skipping migrations..."
fi

# Start the server
echo "🚀 Starting NestJS server..."
exec node dist/main

