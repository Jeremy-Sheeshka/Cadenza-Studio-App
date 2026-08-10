FROM node:20-slim

WORKDIR /app

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

# Create startup script that runs tsx directly
RUN printf '#!/bin/sh\ncd /app\n./node_modules/.bin/tsx server/seed.ts\n./node_modules/.bin/tsx server/index.ts\n' > /app/start.sh && chmod +x /app/start.sh

# Start the server
CMD ["/app/start.sh"]
