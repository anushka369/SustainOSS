import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file
dotenv.config({ path: resolve(process.cwd(), '.env') });

interface Config {
  env: string;
  port: number;
  apiKey: string;
  encryptionKey: string;
  db: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    timeseriesHost?: string;
    timeseriesPort?: number;
    timeseriesDatabase?: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  security: {
    enableHttps: boolean;
    corsOrigins: string[];
  };
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvVarOptional(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}

export const config: Config = {
  env: getEnvVar('NODE_ENV', 'development'),
  port: parseInt(getEnvVar('PORT', '3000'), 10),
  apiKey: getEnvVar('API_KEY', 'dev-api-key'),
  encryptionKey: getEnvVar('ENCRYPTION_KEY', 'dev-encryption-key-change-in-production'),
  db: {
    host: getEnvVar('DB_HOST', 'localhost'),
    port: parseInt(getEnvVar('DB_PORT', '5432'), 10),
    database: getEnvVar('DB_NAME', 'sustainoss'),
    user: getEnvVar('DB_USER', 'postgres'),
    password: getEnvVar('DB_PASSWORD', 'postgres'),
    timeseriesHost: getEnvVarOptional('TIMESERIES_DB_HOST'),
    timeseriesPort: process.env.TIMESERIES_DB_PORT
      ? parseInt(process.env.TIMESERIES_DB_PORT, 10)
      : undefined,
    timeseriesDatabase: getEnvVarOptional('TIMESERIES_DB_NAME'),
  },
  redis: {
    host: getEnvVar('REDIS_HOST', 'localhost'),
    port: parseInt(getEnvVar('REDIS_PORT', '6379'), 10),
    password: getEnvVarOptional('REDIS_PASSWORD'),
  },
  security: {
    enableHttps: getEnvVar('ENABLE_HTTPS', 'false') === 'true',
    corsOrigins: getEnvVar('CORS_ORIGINS', 'http://localhost:5173').split(','),
  },
};
