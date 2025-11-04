#!/bin/sh
# Run migrations before starting the server
echo "🔄 Running database migrations..."
npm run migration:run

# Start the server
echo "🚀 Starting NestJS server..."
exec node dist/main

