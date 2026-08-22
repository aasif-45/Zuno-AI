FROM node:22-alpine

# Set working directory to /app
WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont

# Install root dependencies (required for shared modules like ioredis)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy agent package files and install agent dependencies
WORKDIR /app/services/agent
COPY services/agent/package*.json ./
RUN npm install --legacy-peer-deps

# Copy shared code and agent service source code
WORKDIR /app
COPY shared ./shared
COPY services/agent ./services/agent

# Switch to agent service directory
WORKDIR /app/services/agent

# Expose agent service port
EXPOSE 3015

# Start agent service
CMD ["npm", "start"]
