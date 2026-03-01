/**
 * Property-based tests for MetricsCalculator - Diversity and Retention
 * Feature: sustainoss
 */

import fc from 'fast-check';
import { Pool } from 'pg';
import { MetricsCalculator, TimePeriod } from '../MetricsCalculator.js';
import {
  RepositoryStore,
  CommitStore,
  initDatabase,
  dropAllTables,
} from '../../storage/index.js';
import { Repository, CommitRecord } from '../../types/models.js';
import { MaintainerRole } from '../../types/enums.js';
import { documentStore } from '../../config/database.js';

describe('MetricsCalculator Diversity and Retention Property Tests', () => {
  let pool: Pool;
  let calculator: MetricsCalculator;
  let repositoryStore: RepositoryStore;
  let commitStore: CommitStore;

  beforeAll(async () => {
    pool = documentStore;
    await initDatabase(pool);
    calculator = new MetricsCalculator(pool);
    repositoryStore = new RepositoryStore(pool);
    commitStore = new CommitStore(pool);
  });

  afterAll(async () => {
    await dropAllTables(pool);
  });

  beforeEach(async () => {
    // Clean up data before each test
    await pool.query('DELETE FROM commits');
    await pool.query('DELETE FROM repositories');
  });

  /**
   * Property 15: Contributor Diversity Calculation
   * Validates: Requirements 5.1
   */
  describe('Property 15: Contributor Diversity Calculation', () => {
    it('should count unique contributors by email', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.emailAddress(), { minLength: 1, maxLength: 10 }),
          fc.array(
            fc.record({
              sha: fc.uuid(),
              author_email: fc.emailAddress(),
              timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          async (maintainerEmails, commitData) => {
            // Create repository
            const repo: Repository = {
              id: fc.sample(fc.uuid(), 1)[0],
              url: 'https://github.com/test/repo',
              name: 'test-repo',
              localPath: '/tmp/test-repo',
              lastSync: new Date(),
              createdAt: new Date(),
              maintainers: maintainerEmails.map((email) => ({
                name: email.split('@')[0],
                email,
                role: MaintainerRole.MAINTAINER,
              })),
            };

            await repositoryStore.create(repo);

            // Create commits
            for (const commit of commitData) {
              const commitRecord: CommitRecord = {
                sha: commit.sha,
                author: commit.author_email.split('@')[0],
                author_email: commit.author_email,
                timestamp: commit.timestamp,
                files_changed: 1,
                insertions: 10,
                deletions: 5,
                message: 'Test commit',
              };
              await commitStore.create(repo.id, commitRecord);
            }

            // Calculate diversity
            const timePeriod: TimePeriod = {
              start: new Date('2024-01-01'),
              end: new Date('2024-12-31'),
            };
            const diversity = await calculator.calculateContributorDiversity(
              repo.id,
              timePeriod
            );

            // Manual computation - count unique emails in time period
            const uniqueEmails = new Set<string>();
            for (const commit of commitData) {
              if (commit.timestamp >= timePeriod.start && commit.timestamp <= timePeriod.end) {
                uniqueEmails.add(commit.author_email);
              }
            }

            // Verify diversity matches manual count
            expect(diversity).toBe(uniqueEmails.size);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 18: Retention Ratio Calculation
   * Validates: Requirements 5.4
   */
  describe('Property 18: Retention Ratio Calculation', () => {
    it('should calculate retention ratio as percentage of contributors with 2+ contributions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.emailAddress(), { minLength: 1, maxLength: 10 }),
          fc.array(
            fc.record({
              sha: fc.uuid(),
              author_email: fc.emailAddress(),
              timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          async (maintainerEmails, commitData) => {
            // Create repository
            const repo: Repository = {
              id: fc.sample(fc.uuid(), 1)[0],
              url: 'https://github.com/test/repo',
              name: 'test-repo',
              localPath: '/tmp/test-repo',
              lastSync: new Date(),
              createdAt: new Date(),
              maintainers: maintainerEmails.map((email) => ({
                name: email.split('@')[0],
                email,
                role: MaintainerRole.MAINTAINER,
              })),
            };

            await repositoryStore.create(repo);

            // Create commits
            for (const commit of commitData) {
              const commitRecord: CommitRecord = {
                sha: commit.sha,
                author: commit.author_email.split('@')[0],
                author_email: commit.author_email,
                timestamp: commit.timestamp,
                files_changed: 1,
                insertions: 10,
                deletions: 5,
                message: 'Test commit',
              };
              await commitStore.create(repo.id, commitRecord);
            }

            // Calculate retention ratio
            const timePeriod: TimePeriod = {
              start: new Date('2024-01-01'),
              end: new Date('2024-12-31'),
            };
            const retention = await calculator.calculateRetentionRatio(
              repo.id,
              timePeriod
            );

            // Manual computation
            const contributionCounts: Record<string, number> = {};
            for (const commit of commitData) {
              if (commit.timestamp >= timePeriod.start && commit.timestamp <= timePeriod.end) {
                const author = commit.author_email;
                contributionCounts[author] = (contributionCounts[author] || 0) + 1;
              }
            }

            const totalContributors = Object.keys(contributionCounts).length;
            if (totalContributors === 0) {
              expect(retention).toBe(0);
            } else {
              const returningContributors = Object.values(contributionCounts).filter(
                (count) => count >= 2
              ).length;
              const expectedRetention = (returningContributors / totalContributors) * 100;

              // Verify retention matches manual computation
              expect(Math.abs(retention - expectedRetention)).toBeLessThan(0.01);
            }

            // Verify retention is between 0 and 100
            expect(retention).toBeGreaterThanOrEqual(0);
            expect(retention).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
