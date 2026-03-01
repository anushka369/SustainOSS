# SustainOSS Deployment Guide

This guide covers deploying SustainOSS using Docker for production environments.

## Prerequisites

- Docker Engine 20.10 or later
- Docker Compose 2.0 or later
- At least 2GB RAM available
- At least 10GB disk space

## Quick Start with Docker Compose

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd sustainoss
   ```

2. **Set environment variables**:
   ```bash
   cp packages/backend/.env.example .env
   ```
   
   Edit `.env` and set secure values for:
   - `API_KEY` - Used for API authentication
   - `ENCRYPTION_KEY` - Used for encrypting repository credentials (32+ characters recommended)

3. **Start all services**:
   ```bash
   docker-compose up -d
   ```

4. **Access the application**:
   - Frontend Dashboard: http://localhost:8080
   - Backend API: http://localhost:3000
   - PostgreSQL: localhost:5432
   - Redis: localhost:6379

5. **View logs**:
   ```bash
   docker-compose logs -f
   ```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `API_KEY` | API authentication key | `your-secure-api-key-here` |
| `ENCRYPTION_KEY` | Key for encrypting credentials | `your-32-char-encryption-key-here` |

### Database Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | `postgres` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `sustainoss` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | `postgres` |
| `TIMESERIES_DB_HOST` | TimescaleDB host | `postgres` |
| `TIMESERIES_DB_PORT` | TimescaleDB port | `5432` |
| `TIMESERIES_DB_NAME` | TimescaleDB database | `sustainoss` |

### Redis Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis host | `redis` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | `` |

### Application Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Backend server port | `3000` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:8080` |
| `ENABLE_HTTPS` | Enable HTTPS | `false` |

## Database Setup

The database is automatically initialized when the PostgreSQL container starts. The initialization script:

1. Creates the `sustainoss` database
2. Enables the TimescaleDB extension
3. Creates all required tables
4. Sets up hypertables for time-series data

### Manual Database Initialization

If you need to manually initialize the database:

```bash
docker-compose exec postgres psql -U postgres -d sustainoss -f /docker-entrypoint-initdb.d/init-db.sql
```

### Database Backup

To backup the database:

```bash
docker-compose exec postgres pg_dump -U postgres sustainoss > backup.sql
```

To restore from backup:

```bash
docker-compose exec -T postgres psql -U postgres sustainoss < backup.sql
```

## Production Deployment

### Security Considerations

1. **Change default passwords**: Update all default passwords in production
2. **Use strong encryption keys**: Generate secure random keys for `API_KEY` and `ENCRYPTION_KEY`
3. **Enable HTTPS**: Set `ENABLE_HTTPS=true` and configure SSL certificates
4. **Restrict CORS origins**: Set `CORS_ORIGINS` to your frontend domain only
5. **Use secrets management**: Consider using Docker secrets or environment variable injection from a secrets manager

### Generating Secure Keys

```bash
# Generate API key
openssl rand -hex 32

# Generate encryption key
openssl rand -hex 32
```

### HTTPS Configuration

To enable HTTPS:

1. Obtain SSL certificates (e.g., from Let's Encrypt)
2. Mount certificates in the backend container
3. Set `ENABLE_HTTPS=true`
4. Update nginx configuration for the frontend to use SSL

### Resource Requirements

Minimum recommended resources for production:

- **CPU**: 2 cores
- **RAM**: 4GB
- **Disk**: 50GB (depends on repository size and retention)
- **Network**: Stable internet connection for Git operations

### Scaling Considerations

- **Horizontal scaling**: Run multiple backend instances behind a load balancer
- **Database**: Use managed PostgreSQL/TimescaleDB for better performance
- **Redis**: Use Redis Cluster for high availability
- **Storage**: Use persistent volumes for database data

## Monitoring and Maintenance

### Health Checks

Check service health:

```bash
# Check all services
docker-compose ps

# Check backend health
curl http://localhost:3000/health

# Check database connection
docker-compose exec postgres pg_isready -U postgres
```

### Logs

View logs for specific services:

```bash
# Backend logs
docker-compose logs -f backend

# Frontend logs
docker-compose logs -f frontend

# Database logs
docker-compose logs -f postgres

# All logs
docker-compose logs -f
```

### Updating

To update to a new version:

```bash
# Pull latest changes
git pull

# Rebuild and restart services
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Cleanup

Remove all containers and volumes:

```bash
docker-compose down -v
```

Remove only containers (keep data):

```bash
docker-compose down
```

## Troubleshooting

### Backend won't start

**Symptom**: Backend container exits immediately

**Solutions**:
1. Check logs: `docker-compose logs backend`
2. Verify database is running: `docker-compose ps postgres`
3. Check environment variables are set correctly
4. Ensure database initialization completed: `docker-compose logs postgres`

### Database connection errors

**Symptom**: Backend logs show "ECONNREFUSED" or "connection refused"

**Solutions**:
1. Wait for database to be ready (check health status)
2. Verify `DB_HOST` is set to `postgres` (not `localhost`)
3. Check database credentials match
4. Restart services: `docker-compose restart`

### Frontend shows blank page

**Symptom**: Frontend loads but shows nothing

**Solutions**:
1. Check browser console for errors
2. Verify backend is accessible: `curl http://localhost:3000/health`
3. Check CORS configuration in backend
4. Clear browser cache and reload

### Out of disk space

**Symptom**: Services fail with disk space errors

**Solutions**:
1. Check disk usage: `df -h`
2. Clean up Docker: `docker system prune -a`
3. Remove old volumes: `docker volume prune`
4. Increase disk allocation

### High memory usage

**Symptom**: System becomes slow, OOM errors

**Solutions**:
1. Check container memory: `docker stats`
2. Reduce concurrent repository syncs
3. Increase available RAM
4. Optimize database queries

### Repository sync fails

**Symptom**: Repository sync jobs fail or timeout

**Solutions**:
1. Check network connectivity
2. Verify Git credentials are correct
3. Check repository URL is accessible
4. Review backend logs for specific errors
5. Increase timeout values if needed

### Redis connection errors

**Symptom**: Job queue not working

**Solutions**:
1. Verify Redis is running: `docker-compose ps redis`
2. Check Redis logs: `docker-compose logs redis`
3. Verify `REDIS_HOST` is set to `redis`
4. Restart Redis: `docker-compose restart redis`

## Support

For additional help:
- Check the [GitHub Issues](https://github.com/your-org/sustainoss/issues)
- Review the [README.md](README.md) for general information
- See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup

## License

SustainOSS is open-source software. See [LICENSE](LICENSE) for details.
