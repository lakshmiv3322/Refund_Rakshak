# Production Multi-Stage Dockerfile for RefundRakshak
# Target: node:22-slim (Debian-based)
# Stage 1: Build Frontend and Server
FROM node:22-slim AS builder
WORKDIR /app

# Install native compilation dependencies for better-sqlite3 build
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Stage 2: Production Runner
FROM node:22-slim AS runner
WORKDIR /app

# Install runtime dependencies and curl for HEALTHCHECK
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated non-root user and group
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/sh appuser

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data

RUN mkdir -p /app/data && chown -R appuser:nodejs /app

USER appuser

ENV NODE_ENV=production \
    PORT=8000 \
    DATA_DIR=/app/data \
    RULES_PATH=/app/data/verified_rules.json \
    ENABLE_SIM_TIME=true \
    SEED_DEMO=true

VOLUME ["/app/data"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["node", "dist/server.js"]
