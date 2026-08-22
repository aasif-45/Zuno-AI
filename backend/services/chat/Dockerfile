FROM node:22-alpine

# Set working directory to /app
WORKDIR /app

# Install root dependencies (required for shared modules like ioredis)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy chat package files and install chat dependencies
WORKDIR /app/services/chat
COPY services/chat/package*.json ./
RUN npm install --legacy-peer-deps

# Copy shared code and chat service source code
WORKDIR /app
COPY shared ./shared
COPY services/chat ./services/chat

# Switch to chat service directory
WORKDIR /app/services/chat

# Expose chat service port
EXPOSE 3010

# Start chat service
CMD ["npm", "start"]
