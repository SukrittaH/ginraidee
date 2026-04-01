# Multi-stage build for smaller image size
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY auth-service/package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Build stage
FROM base AS builder
WORKDIR /app
COPY auth-service/package*.json ./
RUN npm ci
COPY auth-service/ .

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy dependencies from deps stage
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy shared utilities
COPY --chown=nodejs:nodejs shared/ ./shared/

# Copy application code
COPY --chown=nodejs:nodejs auth-service/src ./src
COPY --chown=nodejs:nodejs auth-service/package*.json ./

USER nodejs

EXPOSE 3001

CMD ["node", "src/server.js"]
