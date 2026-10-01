# Production Dockerfile for RefundRakshak
FROM node:22-slim

WORKDIR /app

# Install native dependencies and curl for healthcheck & better-sqlite3 compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests and install all dependencies (including devDependencies for tsx)
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

# Build Vite frontend and server bundles
RUN npm run build

# Environment defaults
ENV NODE_ENV=production \
    PORT=8000 \
    DATA_DIR=/app/data \
    RULES_PATH=/app/data/verified_rules.json \
    ENABLE_SIM_TIME=false

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["npm", "start"]
