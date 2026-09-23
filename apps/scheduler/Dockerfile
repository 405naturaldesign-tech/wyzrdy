FROM node:20-alpine

WORKDIR /app

# Create a simple health check scheduler
COPY apps/scheduler/scheduler.js ./scheduler.js
COPY apps/scheduler/package.json ./package.json

# Install minimal dependencies
RUN npm ci

EXPOSE 3002

CMD ["node", "scheduler.js"]
