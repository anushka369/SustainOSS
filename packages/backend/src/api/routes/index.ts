import { Router } from 'express';
import { authenticateApiKey } from '../middleware/index.js';
import { repositoriesRouter } from './repositories.js';
import { metricsRouter } from './metrics.js';

const router = Router();

// Apply authentication to all API routes
router.use(authenticateApiKey);

// Mount route handlers
router.use('/repositories', repositoriesRouter);
router.use('/repositories', metricsRouter);

export { router as apiRouter };
