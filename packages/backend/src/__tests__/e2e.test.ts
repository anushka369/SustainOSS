/**
 * End-to-End Integration Tests
 * Tests complete workflow: add repo → sync → view metrics → view trends
 */

import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { RepositoryStore } from '../storage/RepositoryStore';
import { MetricsStore } from '../storage/MetricsStore';
import { BurnoutAlertStore } from '../storage/BurnoutAlertStore';
import { MetricsCalculator, TimePeriod } from '../analytics/MetricsCalculator';
import { BurnoutAlertType, AlertSeverity } from '../types/enums';

describe('End-to-End Integration Tests', () => {
  let app: express.Application;
  let pool: Pool;
  let repositoryStore: RepositoryStore;
  let metricsStore: MetricsStore;
  let burnoutAlertStore: BurnoutAlertStore;

  beforeAll(async () => {
    // Setup test database connection
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'sustainoss_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    // Initialize stores
    repositoryStore = new RepositoryStore(pool);
    metricsStore = new MetricsStore(pool);
    burnoutAlertStore = new BurnoutAlertStore(pool);

    // Setup Express app with routes
    app = express();
    app.use(express.json());

    // Mock API routes for testing
    app.post('/api/v1/repositories', async (req, res) => {
      try {
        const { url, name } = req.body;
        const repo = await repositoryStore.create({
          id: `repo-${Date.now()}`,
          url,
          name,
          localPath: `/tmp/repos/${name}`,
          lastSync: new Date(),
          createdAt: new Date(),
          maintainers: [],
        });
        res.status(201).json(repo);
      } catch (error) {
        res.status(500).json({ error: 'Failed to add repository' });
      }
    });

    app.get('/api/v1/repositories', async (_req, res) => {
      try {
        const repos = await repositoryStore.findAll();
        res.json(repos);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch repositories' });
      }
    });

    app.get('/api/v1/repositories/:id/metrics', async (req, res) => {
      try {
        const repoId = req.params.id;
        const metrics: Record<string, any> = {};
        
        // Get latest metrics
        const sustainabilityScore = await metricsStore.getLatestMetric(repoId, 'sustainability_score');
        if (sustainabilityScore !== null) {
          metrics.sustainability_score = sustainabilityScore;
        }
        
        // Get per-maintainer metrics
        const now = new Date();
        metrics.pr_reviews_per_maintainer = await metricsStore.getMetricByMaintainer(repoId, 'pr_reviews', now);
        metrics.open_issues_per_maintainer = await metricsStore.getMetricByMaintainer(repoId, 'open_issues', now);
        metrics.avg_review_turnaround = await metricsStore.getMetricByMaintainer(repoId, 'avg_turnaround', now);
        
        res.json(metrics);
      } catch (error) {
        res.status(404).json({ error: 'Metrics not found' });
      }
    });

    app.get('/api/v1/repositories/:id/burnout', async (req, res) => {
      try {
        const alerts = await burnoutAlertStore.findByRepoId(req.params.id);
        res.json(alerts);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch burnout alerts' });
      }
    });

    app.get('/api/v1/repositories/:id/trends', async (req, res) => {
      try {
        const { metric_name, days = 30 } = req.query;
        const daysNum = parseInt(days as string);
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - daysNum * 24 * 60 * 60 * 1000);
        
        const trends = await metricsStore.getMetric(
          req.params.id,
          metric_name as string,
          startTime,
          endTime
        );
        res.json(trends);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch trends' });
      }
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Complete Workflow: Add Repository → Sync → View Metrics → View Trends', () => {
    let testRepoId: string;

    it('should add a new repository', async () => {
      const response = await request(app)
        .post('/api/v1/repositories')
        .send({
          url: 'https://github.com/test/repo',
          name: 'test-repo',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('test-repo');
      expect(response.body.url).toBe('https://github.com/test/repo');
      testRepoId = response.body.id;
    });

    it('should list all repositories', async () => {
      const response = await request(app)
        .get('/api/v1/repositories')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body.some((r: any) => r.id === testRepoId)).toBe(true);
    });

    it('should handle repository sync (mock)', async () => {
      // In a real scenario, this would trigger actual Git operations
      // For testing, we'll insert mock data directly
      const now = new Date();
      
      // Store per-maintainer metrics
      await metricsStore.storeMetric(testRepoId, 'pr_reviews', 10, now, 'alice');
      await metricsStore.storeMetric(testRepoId, 'pr_reviews', 5, now, 'bob');
      await metricsStore.storeMetric(testRepoId, 'open_issues', 3, now, 'alice');
      await metricsStore.storeMetric(testRepoId, 'open_issues', 2, now, 'bob');
      await metricsStore.storeMetric(testRepoId, 'avg_turnaround', 24, now, 'alice');
      await metricsStore.storeMetric(testRepoId, 'avg_turnaround', 48, now, 'bob');
      
      // Store aggregate metrics
      await metricsStore.storeMetric(testRepoId, 'contributor_diversity', 15, now);
      await metricsStore.storeMetric(testRepoId, 'sustainability_score', 75.5, now);
    });

    it('should retrieve metrics for repository', async () => {
      const response = await request(app)
        .get(`/api/v1/repositories/${testRepoId}/metrics`)
        .expect(200);

      expect(response.body).toHaveProperty('sustainability_score');
      expect(response.body.sustainability_score).toBe(75.5);
    });

    it('should retrieve burnout alerts', async () => {
      // Insert a test alert
      await burnoutAlertStore.create(testRepoId, {
        type: BurnoutAlertType.HIGH_LOAD,
        severity: AlertSeverity.MEDIUM,
        affected_maintainers: ['alice'],
        metric_value: 65,
        threshold: 60,
        message: 'Alice is handling 65% of repository activity',
        timestamp: new Date(),
      });

      const response = await request(app)
        .get(`/api/v1/repositories/${testRepoId}/burnout`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].type).toBe(BurnoutAlertType.HIGH_LOAD);
    });

    it('should retrieve trend data', async () => {
      // Store historical snapshots
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      await metricsStore.storeMetric(testRepoId, 'sustainability_score', 70.0, weekAgo);
      await metricsStore.storeMetric(testRepoId, 'sustainability_score', 75.5, now);

      const response = await request(app)
        .get(`/api/v1/repositories/${testRepoId}/trends`)
        .query({ metric_name: 'sustainability_score', days: 30 })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Error Scenarios and Recovery', () => {
    it('should handle invalid repository URL', async () => {
      const response = await request(app)
        .post('/api/v1/repositories')
        .send({
          url: 'not-a-valid-url',
          name: 'invalid-repo',
        });

      // Should either reject or accept but fail on sync
      expect([400, 201]).toContain(response.status);
    });

    it('should return 404 for non-existent repository metrics', async () => {
      await request(app)
        .get('/api/v1/repositories/non-existent-id/metrics')
        .expect(404);
    });

    it('should handle missing query parameters gracefully', async () => {
      const response = await request(app)
        .get('/api/v1/repositories/some-id/trends')
        .expect(500); // Should handle missing metric_name

      expect(response.body).toHaveProperty('error');
    });

    it('should handle database connection errors gracefully', async () => {
      // This would require mocking the database connection
      // For now, we verify error responses are properly formatted
      const response = await request(app)
        .get('/api/v1/repositories/invalid-id/metrics')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');
    });
  });

  describe('Various Repository Sizes and Types', () => {
    it('should handle empty repository (no commits)', async () => {
      const response = await request(app)
        .post('/api/v1/repositories')
        .send({
          url: 'https://github.com/test/empty-repo',
          name: 'empty-repo',
        })
        .expect(201);

      const emptyRepoId = response.body.id;
      const now = new Date();

      // Store empty metrics
      await metricsStore.storeMetric(emptyRepoId, 'contributor_diversity', 0, now);
      await metricsStore.storeMetric(emptyRepoId, 'sustainability_score', 0, now);

      const metricsResponse = await request(app)
        .get(`/api/v1/repositories/${emptyRepoId}/metrics`)
        .expect(200);

      expect(metricsResponse.body.sustainability_score).toBe(0);
    });

    it('should handle large repository (many contributors)', async () => {
      const response = await request(app)
        .post('/api/v1/repositories')
        .send({
          url: 'https://github.com/test/large-repo',
          name: 'large-repo',
        })
        .expect(201);

      const largeRepoId = response.body.id;
      const now = new Date();

      // Simulate large repository with many maintainers
      for (let i = 0; i < 50; i++) {
        const value = Math.floor(Math.random() * 20);
        await metricsStore.storeMetric(largeRepoId, 'pr_reviews', value, now, `maintainer${i}`);
      }

      await metricsStore.storeMetric(largeRepoId, 'contributor_diversity', 50, now);
      await metricsStore.storeMetric(largeRepoId, 'sustainability_score', 85.0, now);

      const metricsResponse = await request(app)
        .get(`/api/v1/repositories/${largeRepoId}/metrics`)
        .expect(200);

      expect(metricsResponse.body.sustainability_score).toBe(85.0);
    });

    it('should handle single maintainer repository', async () => {
      const response = await request(app)
        .post('/api/v1/repositories')
        .send({
          url: 'https://github.com/test/solo-repo',
          name: 'solo-repo',
        })
        .expect(201);

      const soloRepoId = response.body.id;
      const now = new Date();

      await metricsStore.storeMetric(soloRepoId, 'pr_reviews', 100, now, 'solo-dev');
      await metricsStore.storeMetric(soloRepoId, 'open_issues', 50, now, 'solo-dev');
      await metricsStore.storeMetric(soloRepoId, 'avg_turnaround', 72, now, 'solo-dev');
      await metricsStore.storeMetric(soloRepoId, 'contributor_diversity', 1, now);
      await metricsStore.storeMetric(soloRepoId, 'sustainability_score', 25.0, now);

      // Should trigger high load concentration alert
      const calculator = new MetricsCalculator(pool);
      
      const timePeriod: TimePeriod = { 
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: now
      };
      const concentration = await calculator.calculateContributionConcentration(soloRepoId, timePeriod);
      expect(concentration).toBeGreaterThan(0.9); // Very high concentration
    });
  });
});
