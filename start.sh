#!/bin/sh
set -e

# Run migrations before starting the server
echo "🔄 Running database migrations..."
if [ -f "dist/config/typeorm.config.js" ]; then
  echo "📋 TypeORM config found at dist/config/typeorm.config.js"
  echo "📦 Running migrations..."
  if npx typeorm migration:run -d dist/config/typeorm.config.js; then
    echo "✅ Migrations completed successfully!"
  else
    echo "❌ Migration failed with exit code $?"
    echo "⚠️ Continuing anyway, but database may be out of sync..."
  fi
else
  echo "⚠️ TypeORM config not found at dist/config/typeorm.config.js, skipping migrations..."
  echo "📂 Current directory: $(pwd)"
  echo "📂 Listing dist/config:"
  ls -la dist/config/ 2>&1 || echo "dist/config directory not found"
fi

# Start the server
echo "🚀 Starting NestJS server..."
exec node dist/main

