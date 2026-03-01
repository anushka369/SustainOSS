/**
 * SustainOSS - Open Source Sustainability Analytics Platform
 * Copyright (c) 2024 SustainOSS Contributors
 * Licensed under the MIT License. See LICENSE file in the project root.
 */

import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { testConnections, closeConnections, getDocumentPool } from './config/database.js';
import {
  errorHandler,
  notFoundHandler,
  configureHelmet,
  enforceHttps,
  additionalSecurityHeaders,
  CSRFProtection,
} from './api/middleware/index.js';
import { apiRouter } from './api/routes/index.js';
import { JobScheduler } from './jobs/index.js';
import { IngestionOrchestrator } from './ingestion/IngestionOrchestrator.js';
import { closeJobQueue } from './jobs/JobQueue.js';

const app = express();

// Job scheduler instance
let jobScheduler: JobScheduler | null = null;

// Security middleware
app.use(configureHelmet());
app.use(enforceHttps);
app.use(additionalSecurityHeaders);
app.use(cors({ origin: config.security.corsOrigins, credentials: true }));
app.use(express.json());

// Health check endpoint (no auth required)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// CSRF token endpoint
app.get('/api/v1/csrf-token', (req, res) => {
  const apiKey = req.header('X-API-Key');
  if (!apiKey) {
    res.status(401).json({
      error: 'Missing API key',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const token = CSRFProtection.generateToken(apiKey);
  res.json({ csrfToken: token });
});

// API routes
app.use('/api/v1', apiRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
async function start() {
  try {
    // Test database connections
    await testConnections();

    // Initialize job scheduler
    const pool = getDocumentPool();
    const ingestionOrchestrator = new IngestionOrchestrator({
      workingDirectory: process.env.WORKING_DIR || './repos',
      githubToken: process.env.GITHUB_TOKEN,
      gitlabToken: process.env.GITLAB_TOKEN,
    });

    jobScheduler = new JobScheduler(pool, ingestionOrchestrator);
    jobScheduler.start();

    app.listen(config.port, () => {
      console.log(`🚀 SustainOSS backend running on port ${config.port}`);
      console.log(`   Environment: ${config.env}`);
      console.log(`   Job scheduler: active`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (jobScheduler) {
    await jobScheduler.stop();
  }
  await closeJobQueue();
  await closeConnections();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  if (jobScheduler) {
    await jobScheduler.stop();
  }
  await closeJobQueue();
  await closeConnections();
  process.exit(0);
});

start();
