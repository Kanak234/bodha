# ==========================================
# Stage 1: Build & Compilation
# ==========================================
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run compile

# ==========================================
# Stage 2: Runtime Verification Image
# ==========================================
FROM node:20-slim AS runner

# Install native compiler toolchains for pipeline execution
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    python3 \
    default-jdk-headless \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Run as unprivileged node user (UID 1000)
RUN chown -R node:node /app

COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/out ./out
COPY --chown=node:node test/ ./test/
COPY --chown=node:node media/ ./media/

USER node

ENV NODE_ENV=production

# Verification smoke test entrypoint
CMD ["node", "test/run-tests.js"]
