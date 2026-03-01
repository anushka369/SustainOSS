import { Pool } from 'pg';
import { config } from './env.js';

// PostgreSQL connection pool for document store
export const documentStore = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// TimescaleDB connection pool for time series data
// Using the same PostgreSQL instance with TimescaleDB extension
export const timeSeriesStore = new Pool({
  host: config.db.timeseriesHost || config.db.host,
  port: config.db.timeseriesPort || config.db.port,
  database: config.db.timeseriesDatabase || config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connections
export async function testConnections(): Promise<void> {
  try {
    const docClient = await documentStore.connect();
    console.log('✓ Document store connection successful');
    docClient.release();

    const tsClient = await timeSeriesStore.connect();
    console.log('✓ Time series store connection successful');
    tsClient.release();
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

// Get document store pool
export function getDocumentPool(): Pool {
  return documentStore;
}

// Get time series store pool
export function getTimeSeriesPool(): Pool {
  return timeSeriesStore;
}

// Graceful shutdown
export async function closeConnections(): Promise<void> {
  await documentStore.end();
  await timeSeriesStore.end();
  console.log('Database connections closed');
}
