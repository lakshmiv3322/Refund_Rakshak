# Stage 1: Build
FROM node:20-slim AS builder
WORKDIR /app

# Install build dependencies
COPY package.json ./
RUN npm install --legacy-peer-deps

# Copy application source
COPY . .

# Build client and server bundles
RUN npm run build

# Stage 2: Production Runner
FROM node:20-slim AS runner
WORKDIR /app

# Install security updates
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

# Create non-root user and group
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/sh -m appuser

# Copy package config and install production dependencies only
COPY package.json ./
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy built assets and data templates
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data

# Setup writable data directory for non-root user
RUN mkdir -p /app/data && chown -R appuser:nodejs /app

USER appuser

ENV NODE_ENV=production \
    PORT=8000 \
    DATA_DIR=/app/data \
    RULES_PATH=/app/data/verified_rules.json

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:8000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
