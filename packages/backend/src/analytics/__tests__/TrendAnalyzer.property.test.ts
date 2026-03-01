/**
 * Property-based tests for TrendAnalyzer
 * Feature: sustainoss
 */

import fc from 'fast-check';
import { Pool } from 'pg';
import { TrendAnalyzer } from '../TrendAnalyzer.js';
import {
  RepositoryStore,
  MetricsStore,
  initDatabase,
  dropAllTables,
} from '../../storage/index.js';
import { Repository } from '../../types/models.js';
import { MaintainerRole } from '../../types/enums.js';
import { documentStore } from '../../config/database.js';

describe('TrendAnalyzer Property Tests', () => {
  let pool: Pool;
  let analyzer: TrendAnalyzer;
  let repositoryStore: RepositoryStore;
  let metricsStore: MetricsStore;

  beforeAll(async () => {
    pool = documentStore;
    await initDatabase(pool);
    analyzer = new TrendAnalyzer(pool);
    repositoryStore = new RepositoryStore(pool);
    metricsStore = new MetricsStore(pool);
  });

  afterAll(async () => {
    await dropAllTables(pool);
  });

  beforeEach(async () => {
    // Clean up data before each test
    await pool.query('DELETE FROM repository_metrics');
    await pool.query('DELETE FROM repositories');
  });

  /**
   * Property 21: Historical Snapshot Storage
   * Validates: Requirements 6.1
   *
   * For any repository being tracked, after 7 days have passed,
   * at least one weekly snapshot of all metrics should exist in the time series database.
   */
  describe('Property 21: Historical Snapshot Storage', () => {
    it('should store snapshots and retrieve them after 7 days', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            repoId: fc.uuid(),
            metrics: fc.dictionary(
              fc.constantFrom(
                'sustainability_score',
                'pr_reviews',
                'open_issues',
                'avg_turnaround',
                'contributor_diversity'
              ),
              fc.float({ min: 0, max: 100 }),
              { minKeys: 1, maxKeys: 5 }
            ),
          }),
          async ({ repoId, metrics }) => {
            // Create repository
            const repo: Repository = {
              id: repoId,
              url: 'https://github.com/test/repo',
              name: 'test-repo',
              localPath: '/tmp/test-repo',
              lastSync: new Date(),
              createdAt: new Date(),
              maintainers: [
                {
                  name: 'test-maintainer',
                  email: 'test@example.com',
                  role: MaintainerRole.MAINTAINER,
                },
              ],
            };

            await repositoryStore.create(repo);

            // Store initial snapshot
            const initialTime = new Date('2024-01-01T00:00:00Z');
            await analyzer.store_snapshot(repoId, metrics, initialTime);

            // Store snapshot 7 days later
            const weekLaterTime = new Date('2024-01-08T00:00:00Z');
            await analyzer.store_snapshot(repoId, metrics, weekLaterTime);

            // Verify snapshots exist
            const startTime = new Date('2024-01-01T00:00:00Z');
            const endTime = new Date('2024-01-08T23:59:59Z');

            // Check each metric
            for (const metricName of Object.keys(metrics)) {
              const trend = await analyzer.get_trend(
                repoId,
                metricName,
                startTime,
                endTime
              );

              // Should have at least one snapshot (the weekly one)
              expect(trend.data_points.length).toBeGreaterThanOrEqual(1);
              expect(trend.metric_name).toBe(metricName);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should store all metrics in a snapshot', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            repoId: fc.uuid(),
            metrics: fc.dictionary(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.float({ min: 0, max: 1000 }),
              { minKeys: 1, maxKeys: 10 }
            ),
            timestamp: fc.date({
              min: new Date('2024-01-01'),
              max: new Date('2024-12-31'),
            }),
          }),
          async ({ repoId, metrics, timestamp }) => {
            // Create repository
            const repo: Repository = {
              id: repoId,
              url: 'https://github.com/test/repo',
              name: 'test-repo',
              localPath: '/tmp/test-repo',
              lastSync: new Date(),
              createdAt: new Date(),
              maintainers: [
                {
                  name: 'test-maintainer',
                  email: 'test@example.com',
                  role: MaintainerRole.MAINTAINER,
                },
              ],
            };

            await repositoryStore.create(repo);

            // Store snapshot
            await analyzer.store_snapshot(repoId, metrics, timestamp);

            // Retrieve and verify all metrics
            for (const [metricName, expectedValue] of Object.entries(metrics)) {
              const retrievedData = await metricsStore.getMetric(
                repoId,
                metricName,
                timestamp,
                timestamp
              );

              expect(retrievedData.length).toBeGreaterThan(0);
              expect(retrievedData[0].value).toBeCloseTo(expectedValue, 5);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 23: Significant Change Highlighting
   * Validates: Requirements 6.3
   *
   * For any metric with a change greater than 30% between two time periods,
   * the dashboard should visually highlight this change in the trend display.
   */
  describe('Property 23: Significant Change Highlighting', () => {
    it('should detect significant changes when change > 30%', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            repoId: fc.uuid(),
            metricName: fc.constantFrom(
              'sustainability_score',
              'pr_reviews',
              'open_issues',
              'avg_turnaround'
            ),
            previousValue: fc.float({ min: 10, max: 100 }),
            changePercentage: fc.float({ min: 31, max: 200 }), // > 30%
          }),
          async ({ repoId, metricName, previousValue, changePercentage }) => {
            // Create repository
            const repo: Repository = {
              id: repoId,
              url: 'https://github.com/test/repo',
              name: 'test-repo',
              localPath: '/tmp/test-repo',
              lastSync: new Date(),
              createdAt: new Date(),
              maintainers: [
                {
                  name: 'test-maintainer',
                  email: 'test@example.com',
                  role: MaintainerRole.MAINTAINER,
                },
              ],
            };

            await repositoryStore.create(repo);

            // Calculate current value based on change percentage
            const currentValue = previousValue * (1 + changePercentage / 100);

            // Store previous value (30 days ago)
            const previousTime = new Date('2024-01-01T00:00:00Z');
            await metricsStore.storeMetric(
              repoId,
              metricName,
              previousValue,
              previousTime
            );

            // Store current value
            const currentTime = new Date('2024-01-31T00:00:00Z');
            await metricsStore.storeMetric(
              repoId,
              metricName,
              currentValue,
              currentTime
            );

            // Detect significant changes
            const alert = await analyzer.detect_significant_changes(
              repoId,
              metricName,
              currentTime,
              30 // 30 days comparison period
            );

            // Should detect as significant
            expect(alert).not.toBeNull();
            expect(alert!.is_significant).toBe(true);
            expect(Math.abs(alert!.change_percentage)).toBeGreaterThan(30);
            expect(alert!.metric_name).toBe(metricName);
            expect(alert!.current_value).toBeCloseTo(currentValue, 5);
            expect(alert!.previous_value).toBeCloseTo(previousValue, 5);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not flag changes <= 30% as significant', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            repoId: fc.uuid(),
            metricName: fc.constantFrom(
              'sustainability_score',
              'pr_reviews',
              'open_issues'
            ),
            previousValue: fc.float({ min: 10, max: 100 }),
            changePercentage: fc.float({ min: -30, max: 30 }), // <= 30%
          }),
          async ({ repoId, metricName, previousValue, changePercentage }) => {
            // Create repository
            const repo: Repository = {
              id: repoId,
              url: 'https://github.com/test/repo',
              name: 'test-repo',
              localPath: '/tmp/test-repo',
              lastSync: new Date(),
              createdAt: new Date(),
              maintainers: [
                {
                  name: 'test-maintainer',
                  email: 'test@example.com',
                  role: MaintainerRole.MAINTAINER,
                },
              ],
            };

            await repositoryStore.create(repo);

            // Calculate current value based on change percentage
            const currentValue = previousValue * (1 + changePercentage / 100);

            // Store previous value
            const previousTime = new Date('2024-01-01T00:00:00Z');
            await metricsStore.storeMetric(
              repoId,
              metricName,
              previousValue,
              previousTime
            );

            // Store current value
            const currentTime = new Date('2024-01-31T00:00:00Z');
            await metricsStore.storeMetric(
              repoId,
              metricName,
              currentValue,
              currentTime
            );

            // Detect significant changes
            const alert = await analyzer.detect_significant_changes(
              repoId,
              metricName,
              currentTime,
              30
            );

            // Should not be flagged as significant
            expect(alert).not.toBeNull();
            expect(alert!.is_significant).toBe(false);
            expect(Math.abs(alert!.change_percentage)).toBeLessThanOrEqual(30);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify direction of change', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            repoId: fc.uuid(),
            metricName: fc.string({ minLength: 1, maxLength: 20 }),
            previousValue: fc.float({ min: 10, max: 100 }),
            isIncrease: fc.boolean(),
          }),
          async ({ repoId, metricName, previousValue, isIncrease }) => {
            // Create repository
            const repo: Repository = {
              id: repoId,
              url: 'https://github.com/test/repo',
              name: 'test-repo',
              localPath: '/tmp/test-repo',
              lastSync: new Date(),
              createdAt: new Date(),
              maintainers: [
                {
                  name: 'test-maintainer',
                  email: 'test@example.com',
                  role: MaintainerRole.MAINTAINER,
                },
              ],
            };

            await repositoryStore.create(repo);

            // Calculate current value (50% change to ensure significance)
            const currentValue = isIncrease
              ? previousValue * 1.5
              : previousValue * 0.5;

            // Store previous value
            const previousTime = new Date('2024-01-01T00:00:00Z');
            await metricsStore.storeMetric(
              repoId,
              metricName,
              previousValue,
              previousTime
            );

            // Store current value
            const currentTime = new Date('2024-01-31T00:00:00Z');
            await metricsStore.storeMetric(
              repoId,
              metricName,
              currentValue,
              currentTime
            );

            // Detect significant changes
            const alert = await analyzer.detect_significant_changes(
              repoId,
              metricName,
              currentTime,
              30
            );

            // Should correctly identify direction
            expect(alert).not.toBeNull();
            expect(alert!.direction).toBe(isIncrease ? 'increase' : 'decrease');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
