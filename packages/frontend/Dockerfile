# Frontend Dockerfile for SustainOSS
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/frontend/package*.json ./packages/frontend/

# Install dependencies
RUN npm ci --workspace=@sustainoss/frontend

# Copy source code
COPY packages/frontend ./packages/frontend
COPY tsconfig.json ./

# Build frontend
RUN npm run build --workspace=@sustainoss/frontend

# Production stage - serve with nginx
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html

# Copy nginx configuration
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
