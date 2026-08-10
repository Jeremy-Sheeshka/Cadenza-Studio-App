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

# Start the Express server and seed the database
CMD ["sh", "-c", "node --import tsx server/seed.ts && node --import tsx server/index.ts"]
