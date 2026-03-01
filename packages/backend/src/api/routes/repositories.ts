import { Router, Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { RepositoryStore } from '../../storage/index.js';
import { IngestionOrchestrator } from '../../ingestion/index.js';
import { Repository, Credentials } from '../../types/models.js';
import { ApiError } from '../middleware/index.js';
import { documentStore } from '../../config/database.js';

const router = Router();

// Initialize stores and orchestrator
const repositoryStore = new RepositoryStore(documentStore);
const orchestrator = new IngestionOrchestrator({
  workingDirectory: './data/repositories',
  githubToken: process.env.GITHUB_TOKEN,
  gitlabToken: process.env.GITLAB_TOKEN,
});

/**
 * POST /api/v1/repositories
 * Add a new repository to track
 * Requirements: 8.1
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, credentials } = req.body;

    // Validate input
    if (!url || typeof url !== 'string') {
      throw new ApiError(400, 'Invalid request', 'Repository URL is required');
    }

    // Check if repository already exists
    const existing = await repositoryStore.findByUrl(url);
    if (existing) {
      throw new ApiError(400, 'Repository already exists', `Repository with URL ${url} is already tracked`);
    }

    // Extract repository name from URL
    const name = extractRepoName(url);
    const id = randomBytes(16).toString('hex');

    // Create repository record
    const repository: Repository = {
      id,
      url,
      name,
      localPath: `./data/repositories/${id}`,
      lastSync: new Date(0), // Epoch time for initial sync
      createdAt: new Date(),
      maintainers: [],
    };

    // Save to database
    const savedRepo = await repositoryStore.create(repository);

    // Trigger initial sync in background (don't wait)
    orchestrator.addRepository(url, credentials as Credentials).catch((err) => {
      console.error(`Failed to sync repository ${id}:`, err);
    });

    res.status(201).json({
      id: savedRepo.id,
      url: savedRepo.url,
      name: savedRepo.name,
      created_at: savedRepo.createdAt,
      last_sync: savedRepo.lastSync,
      maintainers: savedRepo.maintainers,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/repositories
 * List all tracked repositories
 * Requirements: 8.1
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const repositories = await repositoryStore.findAll();

    res.json({
      repositories: repositories.map((repo) => ({
        id: repo.id,
        url: repo.url,
        name: repo.name,
        created_at: repo.createdAt,
        last_sync: repo.lastSync,
        maintainers: repo.maintainers,
      })),
      total: repositories.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/repositories/:id/sync
 * Trigger repository data sync
 * Requirements: 8.1
 */
router.post('/:id/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Check if repository exists
    const repository = await repositoryStore.findById(id);
    if (!repository) {
      throw new ApiError(404, 'Repository not found', `Repository with ID ${id} not found`);
    }

    // Trigger sync (don't wait for completion)
    orchestrator.syncRepository(id).catch((err) => {
      console.error(`Failed to sync repository ${id}:`, err);
    });

    res.json({
      status: 'sync_started',
      repository_id: id,
      message: 'Repository sync has been triggered',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Helper function to extract repository name from URL
 */
function extractRepoName(url: string): string {
  // Remove .git suffix if present
  const cleanUrl = url.replace(/\.git$/, '');
  
  // Extract last part of path
  const parts = cleanUrl.split('/');
  return parts[parts.length - 1] || 'unknown';
}

export { router as repositoriesRouter };
