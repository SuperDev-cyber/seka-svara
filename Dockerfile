# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Configure npm to handle integrity issues and network problems
RUN npm config set fetch-retries 10 && \
    npm config set fetch-retry-factor 2 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm config set fetch-retry-maxtimeout 600000 && \
    npm config set audit false && \
    npm config set fund false && \
    npm config set registry https://registry.npmjs.org/

COPY package*.json ./
# Install ALL dependencies (including devDependencies for build tools like @nestjs/cli)
# Using --legacy-peer-deps to avoid peer dependency conflicts and --prefer-online to ensure fresh downloads
RUN npm cache clean --force && \
    npm install --no-audit --no-fund --legacy-peer-deps --prefer-online || \
    (npm cache clean --force && npm install --no-audit --no-fund --legacy-peer-deps --ignore-scripts)

COPY . .
# Build the application (nest CLI is now available from node_modules/.bin)
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Configure npm for production stage
RUN npm config set fetch-retries 10 && \
    npm config set fetch-retry-factor 2 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm config set fetch-retry-maxtimeout 600000 && \
    npm config set audit false && \
    npm config set fund false && \
    npm config set registry https://registry.npmjs.org/

COPY package*.json ./
# Install production deps (typeorm is in dependencies, so it will be available)
RUN npm cache clean --force && \
    npm install --only=production --no-audit --no-fund --legacy-peer-deps --prefer-online || \
    (npm cache clean --force && npm install --only=production --no-audit --no-fund --legacy-peer-deps --ignore-scripts)

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/start.sh ./start.sh

# Make startup script executable
RUN chmod +x start.sh

EXPOSE 8000

# Run migrations then start server
CMD ["./start.sh"]

