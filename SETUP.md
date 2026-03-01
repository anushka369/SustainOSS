# SustainOSS Setup Guide

This guide will help you set up the SustainOSS development environment.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **PostgreSQL** 14.x or higher
- **TimescaleDB** extension for PostgreSQL
- **Git**

## Installation Steps

### 1. Install Dependencies

From the root directory, install all dependencies for both backend and frontend:

```bash
npm install
```

This will install dependencies for the monorepo and all packages.

### 2. Database Setup

#### Install PostgreSQL and TimescaleDB

**macOS (using Homebrew):**
```bash
brew install postgresql@14
brew install timescaledb

# Start PostgreSQL
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql-14
sudo apt-get install timescaledb-postgresql-14

# Start PostgreSQL
sudo systemctl start postgresql
```

#### Create Database

Navigate to the backend package:
```bash
cd packages/backend
```

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` and update the database credentials if needed.

Run the database setup script:
```bash
npm run setup:db
```

This script will:
- Create the `sustainoss` database
- Enable the TimescaleDB extension
- Create all required tables and indexes

### 3. Environment Configuration

The backend `.env` file should contain:

```env
NODE_ENV=development
PORT=3000
API_KEY=your-api-key-here

DB_HOST=localhost
DB_PORT=5432
DB_NAME=sustainoss
DB_USER=postgres
DB_PASSWORD=postgres

ENABLE_HTTPS=false
CORS_ORIGINS=http://localhost:5173
```

Adjust these values according to your local setup.

### 4. Verify Installation

Run the tests to ensure everything is set up correctly:

```bash
# From root directory
npm test
```

## Running the Application

### Development Mode

Run both backend and frontend in development mode:

```bash
# From root directory
npm run dev
```

Or run them separately:

```bash
# Backend (from packages/backend)
cd packages/backend
npm run dev

# Frontend (from packages/frontend, in a new terminal)
cd packages/frontend
npm run dev
```

The backend will be available at `http://localhost:3000`
The frontend will be available at `http://localhost:5173`

### Building for Production

Build all packages:

```bash
npm run build
```

## Project Structure

```
sustainoss/
├── packages/
│   ├── backend/              # Node.js + Express backend
│   │   ├── src/
│   │   │   ├── config/       # Configuration files
│   │   │   ├── __tests__/    # Test files
│   │   │   └── index.ts      # Entry point
│   │   ├── scripts/          # Database setup scripts
│   │   ├── .env.example      # Example environment variables
│   │   ├── jest.config.js    # Jest configuration
│   │   ├── tsconfig.json     # TypeScript configuration
│   │   └── package.json
│   │
│   └── frontend/             # React + Vite frontend
│       ├── src/
│       │   ├── __tests__/    # Test files
│       │   ├── main.tsx      # Entry point
│       │   └── index.css     # Global styles
│       ├── index.html
│       ├── vite.config.ts    # Vite configuration
│       ├── tailwind.config.js
│       ├── jest.config.js
│       ├── tsconfig.json
│       └── package.json
│
├── .prettierrc.json          # Prettier configuration
├── .gitignore
├── package.json              # Root package.json (monorepo)
└── README.md
```

## Testing

### Run All Tests

```bash
npm test
```

### Run Tests for Specific Package

```bash
# Backend tests
cd packages/backend
npm test

# Frontend tests
cd packages/frontend
npm test
```

### Watch Mode

```bash
# Backend
cd packages/backend
npm run test:watch

# Frontend
cd packages/frontend
npm run test:watch
```

## Linting and Formatting

### Lint Code

```bash
npm run lint
```

### Format Code

```bash
npm run format
```

## Troubleshooting

### Database Connection Issues

If you encounter database connection errors:

1. Verify PostgreSQL is running:
   ```bash
   # macOS
   brew services list
   
   # Linux
   sudo systemctl status postgresql
   ```

2. Check your `.env` file has correct credentials

3. Verify the database exists:
   ```bash
   psql -U postgres -l
   ```

### Port Already in Use

If port 3000 or 5173 is already in use, update the `PORT` in backend `.env` or the `server.port` in `packages/frontend/vite.config.ts`.

### TimescaleDB Extension Not Found

If you get an error about TimescaleDB extension:

1. Ensure TimescaleDB is installed
2. Add TimescaleDB to PostgreSQL configuration:
   ```bash
   # Find postgresql.conf location
   psql -U postgres -c "SHOW config_file;"
   
   # Add to shared_preload_libraries
   shared_preload_libraries = 'timescaledb'
   ```
3. Restart PostgreSQL

## Next Steps

After setup is complete, you can:

1. Start implementing the data models (Task 2)
2. Build the Git repository ingestion layer (Task 3)
3. Develop the analytics engine (Tasks 6-10)
4. Create the REST API (Task 12)
5. Build the web dashboard (Tasks 14-19)

Refer to `.kiro/specs/sustainoss/tasks.md` for the complete implementation plan.
