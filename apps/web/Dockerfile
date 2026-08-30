FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY .nvmrc ./

# Copy apps
COPY apps/web ./apps/web
COPY apps/api ./apps/api
COPY apps/pocketbase ./apps/pocketbase

# Install dependencies
RUN npm ci

# Build web app
RUN npm run build --prefix apps/web

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install a simple HTTP server
RUN npm install -g serve

# Copy built assets from builder
COPY --from=builder /app/dist/apps/web ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
