FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY .nvmrc ./

# Copy apps
COPY apps/api ./apps/api
COPY apps/pocketbase ./apps/pocketbase

# Install dependencies
RUN npm ci --prefix apps/api

EXPOSE 3001

CMD ["npm", "start", "--prefix", "apps/api"]
