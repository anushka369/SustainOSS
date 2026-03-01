import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Initialize database schema
 * Reads and executes the SQL schema file
 */
export async function initDatabase(pool: Pool): Promise<void> {
  try {
    // Read schema file - use relative path from backend package root
    const schemaPath = path.join(process.cwd(), 'scripts/create-schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf-8');

    // Execute schema
    await pool.query(schema);

    console.log('✓ Database schema initialized successfully');
  } catch (error: any) {
    console.error('Failed to initialize database schema:', error.message);
    throw error;
  }
}

/**
 * Drop all tables (for testing purposes)
 */
export async function dropAllTables(pool: Pool): Promise<void> {
  const dropQuery = `
    DROP TABLE IF EXISTS repository_metrics CASCADE;
    DROP TABLE IF EXISTS burnout_alerts CASCADE;
    DROP TABLE IF EXISTS issues CASCADE;
    DROP TABLE IF EXISTS pull_requests CASCADE;
    DROP TABLE IF EXISTS commits CASCADE;
    DROP TABLE IF EXISTS repositories CASCADE;
  `;

  await pool.query(dropQuery);
  console.log('✓ All tables dropped');
}
