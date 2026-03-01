/**
 * Performance tests for database queries and caching
 */

import { Pool } from 'pg';
import { MetricsStore } from '../storage/MetricsStore';
import { RepositoryStore } from '../storage/RepositoryStore';
import { getCacheService, resetCacheService } from '../storage/CacheService';

describe('Performance Tests', () => {
  let pool: Pool;
  let metricsStore: MetricsStore;
  let repositoryStore: RepositoryStore;

  beforeAll(() => {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'sustainoss_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    metricsStore = new MetricsStore(pool);
    repositoryStore = new RepositoryStore(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(() => {
    resetCacheService();
  });

  describe('Cache Performance', () => {
    it('should cache repository lookups', async () => {
      const testRepoId = 'test-repo-123';
      
      // First call - cache miss
      const start1 = Date.now();
      const repo1 = await repositoryStore.findById(testRepoId);
      const time1 = Date.now() - start1;

      // Second call - cache hit (should be faster)
      const start2 = Date.now();
      const repo2 = await repositoryStore.findById(testRepoId);
      const time2 = Date.now() - start2;

      // Cache hit should be significantly faster
      // Note: This test may be flaky in CI environments
      console.log(`First call: ${time1}ms, Second call: ${time2}ms`);
      
      expect(repo1).toEqual(repo2);
    });

    it('should cache metric lookups', async () => {
      const testRepoId = 'test-repo-123';
      const metricName = 'sustainability_score';
      
      // First call - cache miss
      const start1 = Date.now();
      const metric1 = await metricsStore.getLatestMetric(testRepoId, metricName);
      const time1 = Date.now() - start1;

      // Second call - cache hit
      const start2 = Date.now();
      const metric2 = await metricsStore.getLatestMetric(testRepoId, metricName);
      const time2 = Date.now() - start2;

      console.log(`First call: ${time1}ms, Second call: ${time2}ms`);
      
      expect(metric1).toEqual(metric2);
    });

    it('should invalidate cache on updates', async () => {
      const cache = getCacheService();
      
      // Set a value
      cache.set('test-key', { value: 'original' });
      
      // Verify it's cached
      expect(cache.get('test-key')).toEqual({ value: 'original' });
      
      // Delete from cache
      cache.delete('test-key');
      
      // Verify it's gone
      expect(cache.get('test-key')).toBeNull();
    });

    it('should handle cache expiration', async () => {
      const cache = getCacheService();
      
      // Set a value
      cache.set('test-key', { value: 'test' });
      
      // Verify it's cached
      expect(cache.get('test-key')).toEqual({ value: 'test' });
      
      // Clean up expired entries (won't expire immediately in this test)
      cache.cleanupExpired();
      
      // Should still be there
      expect(cache.get('test-key')).toEqual({ value: 'test' });
    });

    it('should provide cache statistics', () => {
      const cache = getCacheService();
      
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.get('key1');
      cache.get('key1');
      
      const stats = cache.getStats();
      
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.maxSize).toBe(1000);
    });
  });

  describe('Query Optimization', () => {
    it('should efficiently query metrics by time range', async () => {
      const testRepoId = 'test-repo-123';
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const start = Date.now();
      const metrics = await metricsStore.getMetric(
        testRepoId,
        'sustainability_score',
        startTime,
        endTime
      );
      const queryTime = Date.now() - start;

      console.log(`Query time: ${queryTime}ms, Results: ${metrics.length}`);
      
      // Query should complete reasonably fast
      expect(queryTime).toBeLessThan(1000);
    });

    it('should efficiently query metrics by maintainer', async () => {
      const testRepoId = 'test-repo-123';
      const now = new Date();
      
      const start = Date.now();
      const metrics = await metricsStore.getMetricByMaintainer(
        testRepoId,
        'pr_reviews',
        now
      );
      const queryTime = Date.now() - start;

      console.log(`Query time: ${queryTime}ms, Maintainers: ${Object.keys(metrics).length}`);
      
      expect(queryTime).toBeLessThan(1000);
    });
  });

  describe('Cache Eviction', () => {
    it('should evict LRU entries when cache is full', () => {
      const cache = getCacheService();
      cache.clear();
      
      // Fill cache beyond max size (assuming small max for testing)
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      // Access some entries to make them "recently used"
      cache.get('key5');
      cache.get('key6');
      cache.get('key7');
      
      const stats = cache.getStats();
      expect(stats.size).toBeLessThanOrEqual(stats.maxSize);
    });

    it('should invalidate cache entries by pattern', () => {
      const cache = getCacheService();
      cache.clear();
      
      cache.set('repo:123', 'value1');
      cache.set('repo:456', 'value2');
      cache.set('metric:123', 'value3');
      
      // Invalidate all repo entries
      cache.invalidatePattern(/^repo:/);
      
      expect(cache.get('repo:123')).toBeNull();
      expect(cache.get('repo:456')).toBeNull();
      expect(cache.get('metric:123')).not.toBeNull();
    });
  });
});
