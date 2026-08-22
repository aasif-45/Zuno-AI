FROM node:22-alpine

# Set working directory to /app
WORKDIR /app

# Install root dependencies (required for shared modules like ioredis)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy auth package files and install auth dependencies
WORKDIR /app/services/auth
COPY services/auth/package*.json ./
RUN npm install --legacy-peer-deps

# Copy shared code and auth service source code
WORKDIR /app
COPY shared ./shared
COPY services/auth ./services/auth

# Switch to auth service directory
WORKDIR /app/services/auth

# Expose auth service port
EXPOSE 3005

# Start auth service
CMD ["npm", "start"]
