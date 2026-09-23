FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY .nvmrc ./

# Copy pocketbase app
COPY apps/pocketbase ./apps/pocketbase

# Install dependencies
RUN npm ci --prefix apps/pocketbase

# Ensure pocketbase binary is executable
RUN chmod +x ./apps/pocketbase/pocketbase

EXPOSE 8090

CMD ["npm", "start", "--prefix", "apps/pocketbase"]
