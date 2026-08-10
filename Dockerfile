FROM node:20

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

# Create startup script
RUN printf '#!/bin/sh\ncd /app\n./node_modules/.bin/tsx server/seed.ts\n./node_modules/.bin/tsx server/index.ts\n' > /app/start.sh && chmod +x /app/start.sh

# Start the server
CMD ["/app/start.sh"]
