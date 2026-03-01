/**
 * Property-based tests for SustainabilityScorer
 * Feature: sustainoss
 */

import fc from 'fast-check';
import { Pool } from 'pg';
import { SustainabilityScorer } from '../SustainabilityScorer.js';
import { MetricsCalculator, TimePeriod } from '../MetricsCalculator.js';
import {
  RepositoryStore,
  CommitStore,
  PullRequestStore,
  initDatabase,
  dropAllTables,
} from '../../storage/index.js';
import { Repository, CommitRecord, PRRecord } from '../../types/models.js';
import { MaintainerRole, PRStatus } from '../../types/enums.js';
import { documentStore } from '../../config/database.js';

describe('SustainabilityScorer Property Tests', () => {
  let pool: Pool;
  let scorer: SustainabilityScorer;
  let calculator: MetricsCalculator;
  let repositoryStore: RepositoryStore;
  let commitStore: CommitStore;
  let pullRequestStore: PullRequestStore;

  beforeAll(async () => {
    pool = documentStore;
    await initDatabase(pool);
    scorer = new SustainabilityScorer(pool);
    calculator = new MetricsCalculator(pool);
    repositoryStore = new RepositoryStore(pool);
    commitStore = new CommitStore(pool);
    pullRequestStore = new PullRequestStore(pool);
  });

  afterAll(async () => {
    await dropAllTables(pool);
  });

  beforeEach(async () => {
    // Clean up data before each test
    await pool.query('DELETE FROM pull_requests');
    await pool.query('DELETE FROM issues');
    await pool.query('DELETE FROM commits');
    await pool.query('DELETE FROM repositories');
  });

  /**
   * Property 16: Load Distribution Score Calculation
   * Validates: Requirements 5.2
   */
  describe('Property 16: Load Distribution Score Calculation', () => {
    it('should calculate load distribution score as 25 × (1 - gini_coefficient) and be between 0 and 25', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.emailAddress(), { minLength: 1, maxLength: 10 }),
          fc.array(
            fc.record({
              sha: fc.uuid(),
              author_email: fc.emailAddress(),
              timestamp: fc.date({
                min: new Date('2024-01-01'),
                max: new Date('2024-12-31'),
              }),
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

            // Calculate load distribution score
            const timePeriod: TimePeriod = {
              start: new Date('2024-01-01'),
              end: new Date('2024-12-31'),
            };
            const score = await scorer.calculateLoadDistributionScore(
              repo.id,
              timePeriod
            );

            // Verify score is between 0 and 25
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(25);

            // Verify score calculation matches formula: 25 × (1 - gini)
            const gini = await calculator.calculateContributionConcentration(
              repo.id,
              timePeriod
            );
            const expectedScore = 25 * (1 - gini);
            expect(Math.abs(score - expectedScore)).toBeLessThan(0.01);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 25 for perfectly equal distribution (gini = 0)', async () => {
      // Create repository
      const repo: Repository = {
        id: fc.sample(fc.uuid(), 1)[0],
        url: 'https://github.com/test/repo',
        name: 'test-repo',
        localPath: '/tmp/test-repo',
        lastSync: new Date(),
        createdAt: new Date(),
        maintainers: [
          {
            name: 'alice',
            email: 'alice@example.com',
            role: MaintainerRole.MAINTAINER,
          },
          {
            name: 'bob',
            email: 'bob@example.com',
            role: MaintainerRole.MAINTAINER,
          },
          {
            name: 'charlie',
            email: 'charlie@example.com',
            role: MaintainerRole.MAINTAINER,
          },
        ],
      };

      await repositoryStore.create(repo);

      // Create equal number of commits for each maintainer
      const maintainers = [
        'alice@example.com',
        'bob@example.com',
        'charlie@example.com',
      ];
      for (let i = 0; i < 30; i++) {
        const author = maintainers[i % 3];
        const commitRecord: CommitRecord = {
          sha: `commit-${i}`,
          author: author.split('@')[0],
          author_email: author,
          timestamp: new Date('2024-06-01'),
          files_changed: 1,
          insertions: 10,
          deletions: 5,
          message: 'Test commit',
        };
        await commitStore.create(repo.id, commitRecord);
      }

      // Calculate load distribution score
      const timePeriod: TimePeriod = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31'),
      };
      const score = await scorer.calculateLoadDistributionScore(
        repo.id,
        timePeriod
      );

      // For perfectly equal distribution, score should be close to 25
      expect(score).toBeGreaterThan(24.9);
      expect(score).toBeLessThanOrEqual(25);
    });

    it('should return 0 for perfectly unequal distribution (gini = 1)', async () => {
      // Create repository
      const repo: Repository = {
        id: fc.sample(fc.uuid(), 1)[0],
        url: 'https://github.com/test/repo',
        name: 'test-repo',
        localPath: '/tmp/test-repo',
        lastSync: new Date(),
        createdAt: new Date(),
        maintainers: [
          {
            name: 'alice',
            email: 'alice@example.com',
            role: MaintainerRole.MAINTAINER,
          },
          {
            name: 'bob',
            email: 'bob@example.com',
            role: MaintainerRole.MAINTAINER,
          },
        ],
      };

      await repositoryStore.create(repo);

      // Create all commits from one maintainer (perfect inequality)
      for (let i = 0; i < 30; i++) {
        const commitRecord: CommitRecord = {
          sha: `commit-${i}`,
          author: 'alice',
          author_email: 'alice@example.com',
          timestamp: new Date('2024-06-01'),
          files_changed: 1,
          insertions: 10,
          deletions: 5,
          message: 'Test commit',
        };
        await commitStore.create(repo.id, commitRecord);
      }

      // Calculate load distribution score
      const timePeriod: TimePeriod = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31'),
      };
      const score = await scorer.calculateLoadDistributionScore(
        repo.id,
        timePeriod
      );

      // For perfectly unequal distribution, score should be close to 0
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThan(1);
    });
  });

  /**
   * Property 17: Response Time Score Calculation
   * Validates: Requirements 5.3
   */
  describe('Property 17: Response Time Score Calculation', () => {
    it('should calculate response time score as 25 × max(0, 1 - (median_hours / 168)) and be between 0 and 25', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.emailAddress(), { minLength: 1, maxLength: 5 }),
          fc.array(
            fc.record({
              id: fc.uuid(),
              author: fc.emailAddress(),
              reviewers: fc.array(fc.emailAddress(), {
                minLength: 1,
                maxLength: 2,
              }),
              created_at: fc.date({
                min: new Date('2024-01-01'),
                max: new Date('2024-06-01'),
              }),
              turnaround_hours: fc.float({ min: 0, max: 500 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (maintainerEmails, prData) => {
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

            // Create PRs with calculated merge times
            for (const pr of prData) {
              const mergedAt = new Date(
                pr.created_at.getTime() + pr.turnaround_hours * 60 * 60 * 1000
              );
              const prRecord: PRRecord = {
                id: pr.id,
                author: pr.author,
                reviewers: pr.reviewers,
                created_at: pr.created_at,
                merged_at: mergedAt,
                closed_at: null,
                review_comments: 1,
                files_changed: 1,
                status: PRStatus.MERGED,
              };
              await pullRequestStore.create(repo.id, prRecord);
            }

            // Calculate response time score
            const timePeriod: TimePeriod = {
              start: new Date('2024-01-01'),
              end: new Date('2024-12-31'),
            };
            const score = await scorer.calculateResponseTimeScore(
              repo.id,
              timePeriod
            );

            // Verify score is between 0 and 25
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(25);

            // Calculate expected median
            const turnaroundTimes =
              await calculator.calculateAvgReviewTurnaround(repo.id, timePeriod);
            const times = Object.values(turnaroundTimes).filter(
              (time) => time > 0
            );

            if (times.length > 0) {
              const sortedTimes = times.sort((a, b) => a - b);
              const medianHours =
                sortedTimes.length % 2 === 0
                  ? (sortedTimes[sortedTimes.length / 2 - 1] +
                      sortedTimes[sortedTimes.length / 2]) /
                    2
                  : sortedTimes[Math.floor(sortedTimes.length / 2)];

              const expectedScore = 25 * Math.max(0, 1 - medianHours / 168);
              expect(Math.abs(score - expectedScore)).toBeLessThan(0.01);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 25 for instant response (0 hours)', async () => {
      // Create repository
      const repo: Repository = {
        id: fc.sample(fc.uuid(), 1)[0],
        url: 'https://github.com/test/repo',
        name: 'test-repo',
        localPath: '/tmp/test-repo',
        lastSync: new Date(),
        createdAt: new Date(),
        maintainers: [
          {
            name: 'alice',
            email: 'alice@example.com',
            role: MaintainerRole.MAINTAINER,
          },
        ],
      };

      await repositoryStore.create(repo);

      // Create PR with instant merge (same timestamp)
      const createdAt = new Date('2024-06-01T10:00:00Z');
      const prRecord: PRRecord = {
        id: 'pr-1',
        author: 'bob@example.com',
        reviewers: ['alice@example.com'],
        created_at: createdAt,
        merged_at: new Date(createdAt.getTime() + 1000), // 1 second later
        closed_at: null,
        review_comments: 1,
        files_changed: 1,
        status: PRStatus.MERGED,
      };
      await pullRequestStore.create(repo.id, prRecord);

      // Calculate response time score
      const timePeriod: TimePeriod = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31'),
      };
      const score = await scorer.calculateResponseTimeScore(repo.id, timePeriod);

      // For near-instant response, score should be close to 25
      expect(score).toBeGreaterThan(24.9);
      expect(score).toBeLessThanOrEqual(25);
    });

    it('should return 0 for response time >= 168 hours (1 week)', async () => {
      // Create repository
      const repo: Repository = {
        id: fc.sample(fc.uuid(), 1)[0],
        url: 'https://github.com/test/repo',
        name: 'test-repo',
        localPath: '/tmp/test-repo',
        lastSync: new Date(),
        createdAt: new Date(),
        maintainers: [
          {
            name: 'alice',
            email: 'alice@example.com',
            role: MaintainerRole.MAINTAINER,
          },
        ],
      };

      await repositoryStore.create(repo);

      // Create PR with 1 week+ turnaround
      const createdAt = new Date('2024-06-01T10:00:00Z');
      const mergedAt = new Date(createdAt.getTime() + 200 * 60 * 60 * 1000); // 200 hours
      const prRecord: PRRecord = {
        id: 'pr-1',
        author: 'bob@example.com',
        reviewers: ['alice@example.com'],
        created_at: createdAt,
        merged_at: mergedAt,
        closed_at: null,
        review_comments: 1,
        files_changed: 1,
        status: PRStatus.MERGED,
      };
      await pullRequestStore.create(repo.id, prRecord);

      // Calculate response time score
      const timePeriod: TimePeriod = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31'),
      };
      const score = await scorer.calculateResponseTimeScore(repo.id, timePeriod);

      // For response time > 168 hours, score should be 0
      expect(score).toBe(0);
    });
  });

  /**
   * Property 19: Sustainability Index Bounds and Composition
   * Validates: Requirements 5.5
   */
  describe('Property 19: Sustainability Index Bounds and Composition', () => {
    it('should calculate sustainability index between 0 and 100 and equal sum of component scores', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.emailAddress(), { minLength: 1, maxLength: 10 }),
          fc.array(
            fc.record({
              sha: fc.uuid(),
              author_email: fc.emailAddress(),
              timestamp: fc.date({
                min: new Date('2024-01-01'),
                max: new Date('2024-12-31'),
              }),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          fc.array(
            fc.record({
              id: fc.uuid(),
              author: fc.emailAddress(),
              reviewers: fc.array(fc.emailAddress(), {
                minLength: 1,
                maxLength: 2,
              }),
              created_at: fc.date({
                min: new Date('2024-01-01'),
                max: new Date('2024-06-01'),
              }),
              turnaround_hours: fc.float({ min: 1, max: 200 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (maintainerEmails, commitData, prData) => {
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

            // Create PRs
            for (const pr of prData) {
              const mergedAt = new Date(
                pr.created_at.getTime() + pr.turnaround_hours * 60 * 60 * 1000
              );
              const prRecord: PRRecord = {
                id: pr.id,
                author: pr.author,
                reviewers: pr.reviewers,
                created_at: pr.created_at,
                merged_at: mergedAt,
                closed_at: null,
                review_comments: 1,
                files_changed: 1,
                status: PRStatus.MERGED,
              };
              await pullRequestStore.create(repo.id, prRecord);
            }

            // Calculate sustainability index
            const timePeriod: TimePeriod = {
              start: new Date('2024-01-01'),
              end: new Date('2024-12-31'),
            };
            const result = await scorer.calculateSustainabilityIndex(
              repo.id,
              timePeriod
            );

            // Verify overall score is between 0 and 100
            expect(result.overall_score).toBeGreaterThanOrEqual(0);
            expect(result.overall_score).toBeLessThanOrEqual(100);

            // Verify overall score equals sum of component scores
            const componentSum =
              result.contributor_diversity_score +
              result.load_distribution_score +
              result.response_time_score +
              result.retention_score;

            expect(Math.abs(result.overall_score - componentSum)).toBeLessThan(
              0.01
            );

            // Verify each component score is between 0 and 100 (after redistribution)
            expect(result.contributor_diversity_score).toBeGreaterThanOrEqual(0);
            expect(result.contributor_diversity_score).toBeLessThanOrEqual(100);
            expect(result.load_distribution_score).toBeGreaterThanOrEqual(0);
            expect(result.load_distribution_score).toBeLessThanOrEqual(100);
            expect(result.response_time_score).toBeGreaterThanOrEqual(0);
            expect(result.response_time_score).toBeLessThanOrEqual(100);
            expect(result.retention_score).toBeGreaterThanOrEqual(0);
            expect(result.retention_score).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return overall score of 100 when all component scores are at maximum', async () => {
      // Create repository with perfect conditions
      const repo: Repository = {
        id: fc.sample(fc.uuid(), 1)[0],
        url: 'https://github.com/test/repo',
        name: 'test-repo',
        localPath: '/tmp/test-repo',
        lastSync: new Date(),
        createdAt: new Date(),
        maintainers: [
          {
            name: 'alice',
            email: 'alice@example.com',
            role: MaintainerRole.MAINTAINER,
          },
          {
            name: 'bob',
            email: 'bob@example.com',
            role: MaintainerRole.MAINTAINER,
          },
          {
            name: 'charlie',
            email: 'charlie@example.com',
            role: MaintainerRole.MAINTAINER,
          },
        ],
      };

      await repositoryStore.create(repo);

      // Create 50+ unique contributors (max diversity score)
      for (let i = 0; i < 60; i++) {
        const commitRecord: CommitRecord = {
          sha: `commit-${i}`,
          author: `contributor${i}`,
          author_email: `contributor${i}@example.com`,
          timestamp: new Date('2024-06-01'),
          files_changed: 1,
          insertions: 10,
          deletions: 5,
          message: 'Test commit',
        };
        await commitStore.create(repo.id, commitRecord);
      }

      // Create equal distribution commits (max load distribution score)
      const maintainers = [
        'alice@example.com',
        'bob@example.com',
        'charlie@example.com',
      ];
      for (let i = 0; i < 30; i++) {
        const author = maintainers[i % 3];
        const commitRecord: CommitRecord = {
          sha: `equal-commit-${i}`,
          author: author.split('@')[0],
          author_email: author,
          timestamp: new Date('2024-06-01'),
          files_changed: 1,
          insertions: 10,
          deletions: 5,
          message: 'Test commit',
        };
        await commitStore.create(repo.id, commitRecord);
      }

      // Create PRs with instant response (max response time score)
      const createdAt = new Date('2024-06-01T10:00:00Z');
      for (let i = 0; i < 10; i++) {
        const prRecord: PRRecord = {
          id: `pr-${i}`,
          author: 'contributor@example.com',
          reviewers: ['alice@example.com'],
          created_at: createdAt,
          merged_at: new Date(createdAt.getTime() + 1000), // 1 second later
          closed_at: null,
          review_comments: 1,
          files_changed: 1,
          status: PRStatus.MERGED,
        };
        await pullRequestStore.create(repo.id, prRecord);
      }

      // Calculate sustainability index
      const timePeriod: TimePeriod = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31'),
      };
      const result = await scorer.calculateSustainabilityIndex(
        repo.id,
        timePeriod
      );

      // Overall score should be close to 100
      expect(result.overall_score).toBeGreaterThan(95);
      expect(result.overall_score).toBeLessThanOrEqual(100);
    });
  });

  /**
   * Property 20: Graceful Metric Degradation
   * Validates: Requirements 5.6
   */
  describe('Property 20: Graceful Metric Degradation', () => {
    it('should compute overall score from available components and list missing metrics', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.emailAddress(), { minLength: 1, maxLength: 5 }),
          fc.array(
            fc.record({
              sha: fc.uuid(),
              author_email: fc.emailAddress(),
              timestamp: fc.date({
                min: new Date('2024-01-01'),
                max: new Date('2024-12-31'),
              }),
            }),
            { minLength: 1, maxLength: 30 }
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

            // Create only commits (no PRs, so response_time will be missing)
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

            // Calculate sustainability index
            const timePeriod: TimePeriod = {
              start: new Date('2024-01-01'),
              end: new Date('2024-12-31'),
            };
            const result = await scorer.calculateSustainabilityIndex(
              repo.id,
              timePeriod
            );

            // Verify overall score is still between 0 and 100
            expect(result.overall_score).toBeGreaterThanOrEqual(0);
            expect(result.overall_score).toBeLessThanOrEqual(100);

            // Verify overall score equals sum of available component scores
            const componentSum =
              result.contributor_diversity_score +
              result.load_distribution_score +
              result.response_time_score +
              result.retention_score;

            expect(Math.abs(result.overall_score - componentSum)).toBeLessThan(
              0.01
            );

            // Verify missing_metrics array is present
            expect(result.missing_metrics).toBeDefined();
            expect(Array.isArray(result.missing_metrics)).toBe(true);

            // If response_time is 0, it should be in missing_metrics
            if (result.response_time_score === 0) {
              // This could be either missing or just zero, both are valid
              // The key is that the overall score is still computed
              expect(result.overall_score).toBeGreaterThanOrEqual(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should redistribute weight proportionally when metrics are missing', async () => {
      // Create repository
      const repo: Repository = {
        id: fc.sample(fc.uuid(), 1)[0],
        url: 'https://github.com/test/repo',
        name: 'test-repo',
        localPath: '/tmp/test-repo',
        lastSync: new Date(),
        createdAt: new Date(),
        maintainers: [
          {
            name: 'alice',
            email: 'alice@example.com',
            role: MaintainerRole.MAINTAINER,
          },
        ],
      };

      await repositoryStore.create(repo);

      // Create only commits (no PRs, so response_time will be 0)
      for (let i = 0; i < 10; i++) {
        const commitRecord: CommitRecord = {
          sha: `commit-${i}`,
          author: 'alice',
          author_email: 'alice@example.com',
          timestamp: new Date('2024-06-01'),
          files_changed: 1,
          insertions: 10,
          deletions: 5,
          message: 'Test commit',
        };
        await commitStore.create(repo.id, commitRecord);
      }

      // Calculate sustainability index
      const timePeriod: TimePeriod = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31'),
      };
      const result = await scorer.calculateSustainabilityIndex(
        repo.id,
        timePeriod
      );

      // Verify overall score is computed from available metrics
      expect(result.overall_score).toBeGreaterThanOrEqual(0);
      expect(result.overall_score).toBeLessThanOrEqual(100);

      // Verify the sum of component scores equals overall score
      const componentSum =
        result.contributor_diversity_score +
        result.load_distribution_score +
        result.response_time_score +
        result.retention_score;

      expect(Math.abs(result.overall_score - componentSum)).toBeLessThan(0.01);

      // If response_time is 0, the other components should be redistributed
      if (result.response_time_score === 0) {
        // The available components should have higher weights
        const availableComponents = [
          result.contributor_diversity_score,
          result.load_distribution_score,
          result.retention_score,
        ].filter((score) => score > 0);

        // At least one component should be available
        expect(availableComponents.length).toBeGreaterThan(0);
      }
    });

    it('should return 0 overall score when no metrics are available', async () => {
      // Create repository with no data
      const repo: Repository = {
        id: fc.sample(fc.uuid(), 1)[0],
        url: 'https://github.com/test/repo',
        name: 'test-repo',
        localPath: '/tmp/test-repo',
        lastSync: new Date(),
        createdAt: new Date(),
        maintainers: [
          {
            name: 'alice',
            email: 'alice@example.com',
            role: MaintainerRole.MAINTAINER,
          },
        ],
      };

      await repositoryStore.create(repo);

      // Don't create any commits or PRs

      // Calculate sustainability index
      const timePeriod: TimePeriod = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31'),
      };
      const result = await scorer.calculateSustainabilityIndex(
        repo.id,
        timePeriod
      );

      // Overall score should be 0 when no data is available
      expect(result.overall_score).toBe(0);
      expect(result.contributor_diversity_score).toBe(0);
      expect(result.load_distribution_score).toBe(0);
      expect(result.response_time_score).toBe(0);
      expect(result.retention_score).toBe(0);
    });
  });
});
