# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Configure npm to handle integrity issues
RUN npm config set fetch-retries 10 && \
    npm config set fetch-retry-factor 2 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm config set fetch-retry-maxtimeout 600000

COPY package*.json ./
# Install ALL dependencies (including devDependencies for build tools like @nestjs/cli)
RUN npm cache clean --force && \
    npm install --no-audit --no-fund

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
    npm config set fetch-retry-maxtimeout 600000

COPY package*.json ./
# Use npm install with cache clean for production
RUN npm cache clean --force && \
    npm install --only=production --no-audit --no-fund

COPY --from=builder /app/dist ./dist

EXPOSE 8000

CMD ["node", "dist/main"]

