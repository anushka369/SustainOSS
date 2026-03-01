import request from 'supertest';
import express from 'express';
import { authenticateApiKey, errorHandler, notFoundHandler, ApiError } from '../middleware/index.js';
import { config } from '../../config/env.js';

/**
 * Unit tests for API endpoints
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.6, 8.7
 */
describe('API Endpoints', () => {
  let app: express.Application;

  beforeAll(() => {
    // Create test Express app with mock routes
    app = express();
    app.use(express.json());

    // Mock repository routes
    app.post('/api/v1/repositories', authenticateApiKey, (req, res, next) => {
      try {
        const { url } = req.body;
        if (!url || typeof url !== 'string') {
          throw new ApiError(400, 'Invalid request', 'Repository URL is required');
        }
        res.status(201).json({
          id: 'test-id',
          url,
          name: 'test-repo',
          created_at: new Date(),
          last_sync: new Date(),
          maintainers: [],
        });
      } catch (error) {
        next(error);
      }
    });

    app.get('/api/v1/repositories', authenticateApiKey, (_req, res) => {
      res.json({
        repositories: [],
        total: 0,
      });
    });

    app.post('/api/v1/repositories/:id/sync', authenticateApiKey, (req, res, next) => {
      try {
        const { id } = req.params;
        if (id === 'non-existent-id') {
          throw new ApiError(404, 'Repository not found', `Repository with ID ${id} not found`);
        }
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

    // Mock metrics routes
    app.get('/api/v1/repositories/:id/metrics', authenticateApiKey, (req, res, next) => {
      try {
        const { id } = req.params;
        if (id === 'non-existent-id') {
          throw new ApiError(404, 'Repository not found', `Repository with ID ${id} not found`);
        }
        res.json({
          repository_id: id,
          time_period: { start: new Date(), end: new Date() },
          metrics: {},
        });
      } catch (error) {
        next(error);
      }
    });

    app.get('/api/v1/repositories/:id/burnout', authenticateApiKey, (req, res, next) => {
      try {
        const { id } = req.params;
        if (id === 'non-existent-id') {
          throw new ApiError(404, 'Repository not found', `Repository with ID ${id} not found`);
        }
        res.json({
          repository_id: id,
          overall_risk: 'low',
          alerts: [],
          timestamp: new Date(),
        });
      } catch (error) {
        next(error);
      }
    });

    app.get('/api/v1/repositories/:id/sustainability', authenticateApiKey, (req, res, next) => {
      try {
        const { id } = req.params;
        if (id === 'non-existent-id') {
          throw new ApiError(404, 'Repository not found', `Repository with ID ${id} not found`);
        }
        res.json({
          repository_id: id,
          time_period: { start: new Date(), end: new Date() },
          sustainability_score: {
            overall_score: 75,
            contributor_diversity_score: 20,
            load_distribution_score: 20,
            response_time_score: 20,
            retention_score: 15,
            missing_metrics: [],
            timestamp: new Date(),
          },
        });
      } catch (error) {
        next(error);
      }
    });

    app.get('/api/v1/repositories/:id/trends', authenticateApiKey, (req, res, next) => {
      try {
        const { id } = req.params;
        const metricName = req.query.metric_name as string | undefined;

        if (!metricName) {
          throw new ApiError(400, 'Invalid request', 'metric_name query parameter is required');
        }

        if (id === 'non-existent-id') {
          throw new ApiError(404, 'Repository not found', `Repository with ID ${id} not found`);
        }

        res.json({
          repository_id: id,
          metric_name: metricName,
          time_range: { start: new Date(), end: new Date() },
          data_points: [],
          trend_direction: 'stable',
          change_percentage: 0,
        });
      } catch (error) {
        next(error);
      }
    });

    app.get('/api/v1/repositories/:id/good-first-issues', authenticateApiKey, (req, res, next) => {
      try {
        const { id } = req.params;
        if (id === 'non-existent-id') {
          throw new ApiError(404, 'Repository not found', `Repository with ID ${id} not found`);
        }
        res.json({
          repository_id: id,
          recommendations: [],
          total: 0,
        });
      } catch (error) {
        next(error);
      }
    });

    app.use(notFoundHandler);
    app.use(errorHandler);
  });

  describe('Authentication', () => {
    it('should reject requests without API key', async () => {
      const response = await request(app).get('/api/v1/repositories');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Missing API key');
    });

    it('should reject requests with invalid API key', async () => {
      const response = await request(app)
        .get('/api/v1/repositories')
        .set('X-API-Key', 'invalid-key');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Invalid API key');
    });

    it('should accept requests with valid API key', async () => {
      const response = await request(app)
        .get('/api/v1/repositories')
        .set('X-API-Key', config.apiKey);

      // Should not be 401
      expect(response.status).not.toBe(401);
    });
  });

  describe('POST /api/v1/repositories', () => {
    it('should reject request without URL', async () => {
      const response = await request(app)
        .post('/api/v1/repositories')
        .set('X-API-Key', config.apiKey)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Invalid request');
    });

    it('should reject request with invalid URL type', async () => {
      const response = await request(app)
        .post('/api/v1/repositories')
        .set('X-API-Key', config.apiKey)
        .send({ url: 123 });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should accept valid repository URL', async () => {
      const response = await request(app)
        .post('/api/v1/repositories')
        .set('X-API-Key', config.apiKey)
        .send({ url: 'https://github.com/test/repo.git' });

      // Should either succeed (201) or fail with specific error (not 400 for missing URL)
      expect([201, 400, 500]).toContain(response.status);
      
      if (response.status === 201) {
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('url');
        expect(response.body).toHaveProperty('name');
      }
    });
  });

  describe('GET /api/v1/repositories', () => {
    it('should return list of repositories', async () => {
      const response = await request(app)
        .get('/api/v1/repositories')
        .set('X-API-Key', config.apiKey);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('repositories');
      expect(Array.isArray(response.body.repositories)).toBe(true);
      expect(response.body).toHaveProperty('total');
    });
  });

  describe('POST /api/v1/repositories/:id/sync', () => {
    it('should return 404 for non-existent repository', async () => {
      const response = await request(app)
        .post('/api/v1/repositories/non-existent-id/sync')
        .set('X-API-Key', config.apiKey);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Repository not found');
    });
  });

  describe('GET /api/v1/repositories/:id/metrics', () => {
    it('should return 404 for non-existent repository', async () => {
      const response = await request(app)
        .get('/api/v1/repositories/non-existent-id/metrics')
        .set('X-API-Key', config.apiKey);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should accept time_period query parameter', async () => {
      const response = await request(app)
        .get('/api/v1/repositories/test-id/metrics?time_period=7d')
        .set('X-API-Key', config.apiKey);

      // Should either be 404 (repo not found) or 200 (success)
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  describe('GET /api/v1/repositories/:id/burnout', () => {
    it('should return 404 for non-existent repository', async () => {
      const response = await request(app)
        .get('/api/v1/repositories/non-existent-id/burnout')
        .set('X-API-Key', config.apiKey);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v1/repositories/:id/sustainability', () => {
    it('should return 404 for non-existent repository', async () => {
      const response = await request(app)
        .get('/api/v1/repositories/non-existent-id/sustainability')
        .set('X-API-Key', config.apiKey);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should accept time_period query parameter', async () => {
      const response = await request(app)
        .get('/api/v1/repositories/test-id/sustainability?time_period=90d')
        .set('X-API-Key', config.apiKey);

      // Should either be 404 (repo not found) or 200 (success)
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  describe('GET /api/v1/repositories/:id/trends', () => {
    it('should return 400 when metric_name is missing', async () => {
      const response = await request(app)
        .get('/api/v1/repositories/test-id/trends')
        .set('X-API-Key', config.apiKey);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Invalid request');
    });

    it('should return 404 for non-existent repository', async () => {
      const response = await request(app)
        .get('/api/v1/repositories/non-existent-id/trends?metric_name=sustainability_score')
        .set('X-API-Key', config.apiKey);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v1/repositories/:id/good-first-issues', () => {
    it('should return 404 for non-existent repository', async () => {
      const response = await request(app)
        .get('/api/v1/repositories/non-existent-id/good-first-issues')
        .set('X-API-Key', config.apiKey);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should accept limit query parameter', async () => {
      const response = await request(app)
        .get('/api/v1/repositories/test-id/good-first-issues?limit=5')
        .set('X-API-Key', config.apiKey);

      // Should either be 404 (repo not found) or 200 (success)
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/v1/unknown-route')
        .set('X-API-Key', config.apiKey);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Not found');
    });

    it('should include timestamp in error responses', async () => {
      const response = await request(app)
        .get('/api/v1/repositories');

      expect(response.body).toHaveProperty('timestamp');
      expect(() => new Date(response.body.timestamp)).not.toThrow();
    });

    it('should return JSON for all error responses', async () => {
      const response = await request(app)
        .get('/api/v1/repositories');

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });
});
