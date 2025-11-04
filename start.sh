#!/bin/sh
# Run migrations before starting the server
echo "🔄 Running database migrations..."
typeorm migration:run -d dist/config/typeorm.config.js || echo "⚠️ Migration failed, continuing anyway..."

# Start the server
echo "🚀 Starting NestJS server..."
exec node dist/main

