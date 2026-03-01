# SustainOSS Project Structure

## Overview

This document describes the project structure and key files in the SustainOSS monorepo.

## Root Level

```
sustainoss/
├── packages/              # Monorepo packages
├── .kiro/                 # Kiro specs and configuration
├── package.json           # Root package.json (workspace configuration)
├── .prettierrc.json       # Prettier code formatting configuration
├── .prettierignore        # Files to ignore for Prettier
├── .gitignore             # Git ignore patterns
├── README.md              # Project overview and quick start
├── SETUP.md               # Detailed setup instructions
└── PROJECT_STRUCTURE.md   # This file
```

## Backend Package (`packages/backend/`)

### Directory Structure

```
packages/backend/
├── src/
│   ├── config/
│   │   ├── __tests__/
│   │   │   └── env.test.ts          # Environment config tests
│   │   ├── database.ts               # Database connection pools
│   │   └── env.ts                    # Environment variable configuration
│   ├── __tests__/
│   │   └── setup.test.ts             # Setup verification tests
│   └── index.ts                      # Application entry point
├── scripts/
│   ├── init-db.sql                   # Database initialization SQL
│   └── setup-db.sh                   # Database setup script
├── .env.example                      # Example environment variables
├── .eslintrc.json                    # ESLint configuration
├── jest.config.js                    # Jest testing configuration
├── tsconfig.json                     # TypeScript configuration
└── package.json                      # Backend dependencies and scripts
```

### Key Files

- **src/index.ts**: Express server setup with security middleware (helmet, cors)
- **src/config/database.ts**: PostgreSQL and TimescaleDB connection pools
- **src/config/env.ts**: Environment variable loading and validation
- **scripts/init-db.sql**: Creates all database tables and indexes
- **scripts/setup-db.sh**: Automated database setup script

### Available Scripts

- `npm run dev`: Start development server with hot reload
- `npm run build`: Compile TypeScript to JavaScript
- `npm test`: Run Jest tests
- `npm run lint`: Run ESLint
- `npm run setup:db`: Initialize database

## Frontend Package (`packages/frontend/`)

### Directory Structure

```
packages/frontend/
├── src/
│   ├── __tests__/
│   │   └── setup.test.tsx            # Setup verification tests
│   ├── main.tsx                      # React application entry point
│   ├── index.css                     # Global styles with Tailwind
│   └── vite-env.d.ts                 # Vite type definitions
├── index.html                        # HTML template
├── vite.config.ts                    # Vite configuration
├── tailwind.config.js                # Tailwind CSS configuration
├── postcss.config.js                 # PostCSS configuration
├── .eslintrc.json                    # ESLint configuration
├── jest.config.js                    # Jest testing configuration
├── tsconfig.json                     # TypeScript configuration
├── tsconfig.node.json                # TypeScript config for Vite
└── package.json                      # Frontend dependencies and scripts
```

### Key Files

- **src/main.tsx**: React application root with basic UI
- **src/index.css**: Tailwind CSS imports and global styles
- **vite.config.ts**: Vite dev server and build configuration
- **tailwind.config.js**: Tailwind CSS customization
- **index.html**: HTML entry point

### Available Scripts

- `npm run dev`: Start Vite development server
- `npm run build`: Build for production
- `npm run preview`: Preview production build
- `npm test`: Run Jest tests
- `npm run lint`: Run ESLint

## Configuration Files

### TypeScript Configuration

Both packages use strict TypeScript configuration with:
- Strict type checking enabled
- ES2020+ target
- ESM modules
- Source maps for debugging
- Declaration files for type definitions

### Testing Configuration

- **Framework**: Jest with ts-jest preset
- **Property-Based Testing**: fast-check library
- **Coverage Threshold**: 80% for branches, functions, lines, statements
- **Test Pattern**: `**/*.test.ts` and `**/*.test.tsx`

### Linting Configuration

- **ESLint**: TypeScript-aware linting
- **Rules**: Recommended TypeScript and React rules
- **Prettier**: Consistent code formatting

## Database Schema

The database schema is defined in `packages/backend/scripts/init-db.sql`:

### Tables

1. **repositories**: Tracked Git repositories
2. **commits**: Commit history
3. **pull_requests**: Pull request data
4. **issues**: Issue tracking data
5. **burnout_alerts**: Burnout risk alerts
6. **repository_metrics**: Time series metrics (TimescaleDB hypertable)

### Indexes

Optimized indexes for:
- Repository and timestamp queries
- Author lookups
- Status filtering
- Metric time series queries

## Environment Variables

### Backend Environment Variables

Required:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: Database connection
- `API_KEY`: API authentication key

Optional:
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 3000)
- `TIMESERIES_DB_*`: Separate TimescaleDB instance
- `ENABLE_HTTPS`: Enable HTTPS
- `CORS_ORIGINS`: Allowed CORS origins

## Dependencies

### Backend Dependencies

**Core**:
- express: Web framework
- pg: PostgreSQL client
- helmet: Security middleware
- cors: CORS middleware
- dotenv: Environment variables
- simple-git: Git operations

**Development**:
- typescript: Type system
- tsx: TypeScript execution
- jest: Testing framework
- fast-check: Property-based testing
- eslint: Linting

### Frontend Dependencies

**Core**:
- react: UI library
- react-dom: React DOM rendering
- react-router-dom: Routing
- chart.js: Data visualization
- react-chartjs-2: React Chart.js wrapper

**Development**:
- vite: Build tool
- typescript: Type system
- tailwindcss: Utility-first CSS
- jest: Testing framework
- fast-check: Property-based testing
- eslint: Linting

## Next Steps

After completing Task 1 (project setup), the next tasks are:

1. **Task 2**: Implement core data models and types
2. **Task 3**: Implement Git repository ingestion layer
3. **Task 4**: Implement DataExtractor and storage layer
4. **Task 6**: Implement MetricsCalculator
5. **Task 7**: Implement BurnoutDetector

Refer to `.kiro/specs/sustainoss/tasks.md` for the complete implementation plan.
