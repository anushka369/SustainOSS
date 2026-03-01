# Backend Dockerfile for SustainOSS
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/

# Install dependencies
RUN npm ci --workspace=@sustainoss/backend

# Copy source code
COPY packages/backend ./packages/backend
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build --workspace=@sustainoss/backend

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/

# Install production dependencies only
RUN npm ci --workspace=@sustainoss/backend --omit=dev

# Copy built files from builder
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY packages/backend/scripts ./packages/backend/scripts

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

CMD ["node", "packages/backend/dist/index.js"]
