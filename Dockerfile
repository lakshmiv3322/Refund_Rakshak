# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Install native compilation dependencies for better-sqlite3 build
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Stage 2: Production Runner
FROM node:22-alpine AS runner
WORKDIR /app

# Install runtime dependencies and curl for healthcheck
RUN apk add --no-cache curl python3 make g++

# Create non-root user and group
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data

RUN mkdir -p /app/data && chown -R appuser:nodejs /app

USER appuser

ENV NODE_ENV=production \
    PORT=8000 \
    DATA_DIR=/app/data \
    RULES_PATH=/app/data/verified_rules.json

VOLUME ["/app/data"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["node", "dist/server.js"]
