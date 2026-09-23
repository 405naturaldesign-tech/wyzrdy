# Docker Deployment Guide

This project includes a complete Docker Compose setup for containerized deployment of the Wyzrdy application.

## Overview

The Docker Compose configuration manages four services:

1. **PocketBase** (port 8090) - Database and authentication service
2. **API** (port 3001) - Express.js backend API
3. **Web** (port 3000) - React + Vite frontend
4. **Scheduler** - Health monitoring and periodic task runner

## Prerequisites

- Docker 24.0+
- Docker Compose 2.0+
- 2GB+ RAM available for containers

## Quick Start

### 1. Setup Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.docker.example .env.docker
```

Edit `.env.docker` and set secure values for:
- `PB_ENCRYPTION_KEY` - PocketBase encryption key (must be a secure random string)
- `SERVICE_TOKEN` - Scheduler service token for health checks
- `NODE_ENV` - Set to `production` for deployment

Also ensure `apps/api/.env` is properly configured. Copy from the example if needed:

```bash
cp apps/api/.env.example apps/api/.env
```

### 2. Build and Start Services

Build all services:

```bash
docker-compose build
```

Start all services:

```bash
docker-compose up -d
```

View logs:

```bash
docker-compose logs -f
```

### 3. Verify Services

Check service status:

```bash
docker-compose ps
```

Access the applications:
- Frontend: http://localhost:3000
- API: http://localhost:3001
- PocketBase Admin: http://localhost:8090/_/

## Service Details

### PocketBase Service

Runs the PocketBase database and authentication server.

**Environment Variables:**
- `PB_ENCRYPTION_KEY` - Encryption key for sensitive data (required in production)

**Volume:**
- `pb_data:/data` - Persistent storage for database files

**Health Check:**
- Endpoint: `GET /api/health` on port 8090
- Interval: 30 seconds

### API Service

Runs the Express.js backend API server.

**Environment Variables:**
- `NODE_ENV` - Environment mode (development/production)
- `PB_URL` - PocketBase service URL (auto-configured to `http://pocketbase:8090`)
- All variables from `apps/api/.env`

**Health Check:**
- Endpoint: `GET /health` on port 3001
- Interval: 30 seconds

**Dependencies:**
- Requires PocketBase to be healthy before starting

### Web Service

Runs the production-optimized React + Vite frontend.

**Environment Variables:**
- `NODE_ENV` - Environment mode (development/production)

**Health Check:**
- Endpoint: `GET /` on port 3000
- Interval: 30 seconds

**Dependencies:**
- Requires API to be healthy before starting

### Scheduler Service

Periodically checks the API health endpoint (every 5 minutes by default).

**Environment Variables:**
- `API_URL` - API service URL (auto-configured to `http://api:3001`)
- `SERVICE_TOKEN` - Authorization token for health checks
- `HEALTH_CHECK_INTERVAL` - Cron expression for check frequency (default: `*/5 * * * *`)

**Dependencies:**
- Requires API to be healthy before starting

## Common Commands

### Start services
```bash
docker-compose up -d
```

### Stop services
```bash
docker-compose down
```

### Rebuild services after code changes
```bash
docker-compose build --no-cache
docker-compose up -d
```

### View logs for a specific service
```bash
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs -f pocketbase
docker-compose logs -f scheduler
```

### Access a service shell
```bash
docker-compose exec api sh
docker-compose exec web sh
docker-compose exec pocketbase sh
```

### Stop and remove all containers, networks, and volumes
```bash
docker-compose down -v
```

## Development vs Production

### Development Mode

For local development, you may want to use:

```bash
NODE_ENV=development docker-compose up
```

This preserves source maps and enables hot-reload when possible.

### Production Mode

For production deployment:

1. Set strong encryption keys and tokens in `.env.docker`
2. Use `NODE_ENV=production`
3. Consider using a reverse proxy (nginx) in front of the web service
4. Set up proper logging and monitoring
5. Configure automatic backups for the `pb_data` volume

## Networking

Services communicate over the `wyzrdy-network` bridge network:

- `web` → `http://api:3001`
- `api` → `http://pocketbase:8090`
- `scheduler` → `http://api:3001`

Internal service-to-service communication does not require port exposure.

## Persistence

The PocketBase database data is stored in the `pb_data` named volume. This volume persists across container restarts.

To backup the database:

```bash
docker-compose exec pocketbase tar -czf - /data | gzip > pb_data_backup.tar.gz
```

To restore from backup:

```bash
docker-compose down -v
# Restore volume from backup...
docker-compose up -d
```

## Troubleshooting

### Services not starting

Check logs:
```bash
docker-compose logs
```

Common issues:
- Port conflicts (already in use)
- Missing `.env` files
- Insufficient disk space

### Health checks failing

Verify services are accessible:
```bash
docker-compose exec web curl http://localhost:3000
docker-compose exec api curl http://localhost:3001/health
docker-compose exec pocketbase curl http://localhost:8090/api/health
```

### Database not persisting

Ensure the `pb_data` volume exists:
```bash
docker volume ls | grep wyzrdy
```

If missing, create it:
```bash
docker volume create wyzrdy_pb_data
```

### High memory usage

Limit memory per service in `docker-compose.yml`:

```yaml
services:
  web:
    # ... other config ...
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
```

## Production Considerations

1. **Security:**
   - Use strong, randomly-generated encryption keys
   - Rotate service tokens regularly
   - Use environment-specific `.env` files
   - Never commit secrets to version control

2. **Monitoring:**
   - Monitor service health via the scheduler
   - Set up log aggregation
   - Configure alerts for failed health checks

3. **Backup Strategy:**
   - Daily backups of the `pb_data` volume
   - Test restore procedures regularly
   - Store backups off-site

4. **Scaling:**
   - For high-load scenarios, consider running multiple API instances behind a load balancer
   - Use a managed database service instead of PocketBase
   - Deploy to Kubernetes or a container orchestration platform

## Support

For issues or questions:
- Check service logs: `docker-compose logs <service>`
- Verify environment configuration
- Review the main `DEPLOYMENT.md` for additional information
