FROM node:22-alpine

# Set working directory to /app
WORKDIR /app

# Install root dependencies (required for shared modules like ioredis)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy billing package files and install billing dependencies
WORKDIR /app/services/Billing
COPY services/Billing/package*.json ./
RUN npm install --legacy-peer-deps

# Copy shared code and billing service source code
WORKDIR /app
COPY shared ./shared
COPY services/Billing ./services/Billing

# Switch to billing service directory
WORKDIR /app/services/Billing

# Expose billing service port
EXPOSE 3020

# Start billing service
CMD ["npm", "start"]
