FROM node:22-slim

WORKDIR /app

# Install build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the React frontend
RUN npm run build

# Expose port
EXPOSE 3001

# Seed on first deploy, then start server
CMD ["sh", "-c", "RUN_SEED=true ./node_modules/.bin/tsx server/index.ts"]
