# Production Dockerfile for RefundRakshak
FROM node:22-slim
WORKDIR /app

# Install native dependencies and curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

ENV NODE_ENV=production \
    PORT=8000 \
    DATA_DIR=/app/data \
    RULES_PATH=/app/data/verified_rules.json \
    ENABLE_SIM_TIME=false

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["npx", "tsx", "server.ts"]
