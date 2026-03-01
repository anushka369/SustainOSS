# Database Setup for SustainOSS

This guide explains how to set up the PostgreSQL database with TimescaleDB extension for SustainOSS.

## Option 1: Using Docker Compose (Recommended)

### Prerequisites
- Docker and Docker Compose installed

### Steps

1. Start the database:
```bash
docker-compose up -d
```

2. Verify the database is running:
```bash
docker-compose ps
```

3. The database will be automatically initialized with the schema from `packages/backend/scripts/init-db.sql`

4. Run tests:
```bash
cd packages/backend
npm test
```

5. Stop the database:
```bash
docker-compose down
```

6. To remove all data:
```bash
docker-compose down -v
```

## Option 2: Manual PostgreSQL Installation

### Prerequisites
- PostgreSQL 15+ installed
- TimescaleDB extension installed

### Steps

1. Install PostgreSQL:
   - **macOS**: `brew install postgresql@15`
   - **Ubuntu**: `sudo apt-get install postgresql-15`
   - **Windows**: Download from https://www.postgresql.org/download/

2. Install TimescaleDB:
   - Follow instructions at https://docs.timescale.com/install/latest/

3. Start PostgreSQL service:
   - **macOS**: `brew services start postgresql@15`
   - **Ubuntu**: `sudo systemctl start postgresql`
   - **Windows**: Start from Services

4. Create database and run initialization:
```bash
cd packages/backend
bash scripts/setup-db.sh
```

5. Verify the setup:
```bash
psql -U postgres -d sustainoss -c "SELECT * FROM repositories LIMIT 1;"
```

## Database Configuration

The database connection is configured in `packages/backend/.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sustainoss
DB_USER=postgres
DB_PASSWORD=postgres
```

Update these values if you're using different credentials.

## Running Tests

Once the database is set up, run the tests:

```bash
cd packages/backend
npm test
```

To run specific test suites:

```bash
# Run TrendAnalyzer tests
npm test -- TrendAnalyzer.property.test.ts

# Run all property tests
npm test -- property.test.ts
```

## Troubleshooting

### Connection refused error
- Ensure PostgreSQL is running: `docker-compose ps` or `pg_isready`
- Check the port is not in use: `lsof -i :5432`
- Verify credentials in `.env` file

### Schema initialization failed
- Check the init script: `packages/backend/scripts/init-db.sql`
- Manually run the script: `psql -U postgres -d sustainoss -f packages/backend/scripts/init-db.sql`

### TimescaleDB extension not found
- Ensure TimescaleDB is installed
- For Docker: Use the `timescale/timescaledb` image (already configured in docker-compose.yml)
- For manual install: Follow https://docs.timescale.com/install/latest/

## Database Schema

The database includes the following tables:

- `repositories` - Repository metadata
- `commits` - Commit records
- `pull_requests` - Pull request records
- `issues` - Issue records
- `burnout_alerts` - Burnout risk alerts
- `repository_metrics` - Time series metrics (TimescaleDB hypertable)

See `packages/backend/scripts/create-schema.sql` for the complete schema definition.
