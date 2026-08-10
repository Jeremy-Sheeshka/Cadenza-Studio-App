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

# Seed the database and start the server
CMD ["sh", "-c", "npx tsx server/seed.ts && npx tsx server/index.ts"]
