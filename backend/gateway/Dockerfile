FROM node:22-alpine

# Set working directory to /app
WORKDIR /app

# Install root dependencies (required for shared modules like ioredis)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy gateway package files and install gateway dependencies
WORKDIR /app/gateway
COPY gateway/package*.json ./
RUN npm install --legacy-peer-deps

# Copy shared code and gateway source code
WORKDIR /app
COPY shared ./shared
COPY gateway ./gateway

# Switch to gateway directory
WORKDIR /app/gateway

# Expose gateway port
EXPOSE 3000

# Start gateway service
CMD ["npm", "start"]
