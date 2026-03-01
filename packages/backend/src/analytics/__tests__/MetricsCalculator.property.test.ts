/**
 * Property-based tests for MetricsCalculator
 * Feature: sustainoss
 */

import fc from 'fast-check';
import { Pool } from 'pg';
import { MetricsCalculator, TimePeriod } from '../MetricsCalculator.js';
import {
  RepositoryStore,
  PullRequestStore,
  IssueStore,
  CommitStore,
  initDatabase,
  dropAllTables,
} from '../../storage/index.js';
import { Repository, PRRecord, IssueRecord, CommitRecord } from '../../types/models.js';
import { PRStatus, IssueStatus, MaintainerRole } from '../../types/enums.js';
import { documentStore } from '../../config/database.js';

describe('MetricsCalculator Property Tests', () => {
  let pool: Pool;
  let calculator: MetricsCalculator;
  let repositoryStore: RepositoryStore;
  let pullRequestStore: PullRequestStore;
  let issueStore: IssueStore;

  beforeAll(async () => {
    pool = documentStore;
    await initDatabase(pool);
    calculator = new MetricsCalculator(pool);
    repositoryStore = new RepositoryStore(pool);
    pullRequestStore = new PullRequestStore(pool);
    issueStore = new IssueStore(pool);
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
   * Property 5: Metric Calculation Correctness
   * Validates: Requirements 2.1, 2.2, 2.3
   */
  describe('Property 5: Metric Calculation Correctness', () => {
    it('should calculate PR reviews per maintainer matching manual computation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.emailAddress(), { minLength: 1, maxLength: 5 }),
          fc.array(
            fc.record({
              id: fc.uuid(),
              author: fc.emailAddress(),
              reviewers: fc.array(fc.emailAddress(), { maxLength: 3 }),
              created_at: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
            }),
            { maxLength: 20 }
          ),
          async (maintainerEmails, prData) => {
            // Create repository with maintainers
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

            // Create PRs
            for (const pr of prData) {
              const prRecord: PRRecord = {
                id: pr.id,
                author: pr.author,
                reviewers: pr.reviewers,
                created_at: pr.created_at,
                merged_at: null,
                closed_at: null,
                review_comments: 0,
                files_changed: 1,
                status: PRStatus.OPEN,
              };
              await pullRequestStore.create(repo.id, prRecord);
            }

            // Calculate metrics
            const timePeriod: TimePeriod = {
              start: new Date('2024-01-01'),
              end: new Date('2024-12-31'),
            };
            const result = await calculator.calculatePRReviewsPerMaintainer(
              repo.id,
              timePeriod
            );

            // Manual computation
            const expected: Record<string, number> = {};
            for (const email of maintainerEmails) {
              expected[email] = 0;
            }

            for (const pr of prData) {
              if (pr.created_at >= timePeriod.start && pr.created_at <= timePeriod.end) {
                for (const reviewer of pr.reviewers) {
                  if (reviewer in expected) {
                    expected[reviewer]++;
                  }
                }
              }
            }

            // Verify results match manual computation
            expect(result).toEqual(expected);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate open issues per maintainer matching manual computation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.emailAddress(), { minLength: 1, maxLength: 5 }),
          fc.array(
            fc.record({
              id: fc.uuid(),
              author: fc.emailAddress(),
              assignees: fc.array(fc.emailAddress(), { maxLength: 2 }),
              status: fc.constantFrom(IssueStatus.OPEN, IssueStatus.CLOSED),
            }),
            { maxLength: 20 }
          ),
          async (maintainerEmails, issueData) => {
            // Create repository with maintainers
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

            // Create issues
            for (const issue of issueData) {
              const issueRecord: IssueRecord = {
                id: issue.id,
                author: issue.author,
                assignees: issue.assignees,
                labels: [],
                created_at: new Date(),
                closed_at: issue.status === IssueStatus.CLOSED ? new Date() : null,
                first_response_at: null,
                comment_count: 0,
                status: issue.status,
                title: 'Test issue',
                description: 'Test description',
              };
              await issueStore.create(repo.id, issueRecord);
            }

            // Calculate metrics
            const result = await calculator.calculateOpenIssuesPerMaintainer(repo.id);

            // Manual computation
            const expected: Record<string, number> = {};
            for (const email of maintainerEmails) {
              expected[email] = 0;
            }

            for (const issue of issueData) {
              if (issue.status === IssueStatus.OPEN) {
                for (const assignee of issue.assignees) {
                  if (assignee in expected) {
                    expected[assignee]++;
                  }
                }
              }
            }

            // Verify results match manual computation
            expect(result).toEqual(expected);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate average review turnaround matching manual computation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.emailAddress(), { minLength: 1, maxLength: 5 }),
          fc.array(
            fc.record({
              id: fc.uuid(),
              author: fc.emailAddress(),
              reviewers: fc.array(fc.emailAddress(), { minLength: 1, maxLength: 2 }),
              created_at: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-06-01') }),
              merged_at: fc.date({ min: new Date('2024-06-01'), max: new Date('2024-12-31') }),
            }),
            { minLength: 1, maxLength: 15 }
          ),
          async (maintainerEmails, prData) => {
            // Create repository with maintainers
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

            // Create PRs
            for (const pr of prData) {
              const prRecord: PRRecord = {
                id: pr.id,
                author: pr.author,
                reviewers: pr.reviewers,
                created_at: pr.created_at,
                merged_at: pr.merged_at,
                closed_at: null,
                review_comments: 1,
                files_changed: 1,
                status: PRStatus.MERGED,
              };
              await pullRequestStore.create(repo.id, prRecord);
            }

            // Calculate metrics
            const timePeriod: TimePeriod = {
              start: new Date('2024-01-01'),
              end: new Date('2024-12-31'),
            };
            const result = await calculator.calculateAvgReviewTurnaround(
              repo.id,
              timePeriod
            );

            // Manual computation
            const turnaroundTimes: Record<string, number[]> = {};
            for (const email of maintainerEmails) {
              turnaroundTimes[email] = [];
            }

            for (const pr of prData) {
              if (pr.created_at >= timePeriod.start && pr.created_at <= timePeriod.end) {
                const reviewTime = pr.merged_at;
                if (reviewTime > pr.created_at) {
                  const turnaroundHours =
                    (reviewTime.getTime() - pr.created_at.getTime()) / (1000 * 60 * 60);

                  for (const reviewer of pr.reviewers) {
                    if (reviewer in turnaroundTimes) {
                      turnaroundTimes[reviewer].push(turnaroundHours);
                    }
                  }
                }
              }
            }

            const expected: Record<string, number> = {};
            for (const [maintainer, times] of Object.entries(turnaroundTimes)) {
              if (times.length > 0) {
                expected[maintainer] =
                  times.reduce((sum, time) => sum + time, 0) / times.length;
              } else {
                expected[maintainer] = 0;
              }
            }

            // Verify results match manual computation (with small tolerance for floating point)
            for (const email of maintainerEmails) {
              expect(Math.abs(result[email] - expected[email])).toBeLessThan(0.01);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 7: Inactive Maintainer Inclusion
   * Validates: Requirements 2.6
   */
  describe('Property 7: Inactive Maintainer Inclusion', () => {
    it('should include maintainers with zero activity in metrics reports', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.emailAddress(), { minLength: 2, maxLength: 5 }),
          fc.array(
            fc.record({
              id: fc.uuid(),
              author: fc.emailAddress(),
              reviewers: fc.array(fc.emailAddress(), { minLength: 1, maxLength: 2 }),
              created_at: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
            }),
            { maxLength: 10 }
          ),
          async (maintainerEmails, prData) => {
            // Ensure we have at least one inactive maintainer
            // by filtering PRs to only include some maintainers as reviewers
            const activeMaintainers = maintainerEmails.slice(0, Math.max(1, maintainerEmails.length - 1));
            const inactiveMaintainers = maintainerEmails.slice(activeMaintainers.length);

            // Create repository with all maintainers
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

            // Create PRs with only active maintainers as reviewers
            for (const pr of prData) {
              const prRecord: PRRecord = {
                id: pr.id,
                author: pr.author,
                reviewers: pr.reviewers.filter((r) => activeMaintainers.includes(r)),
                created_at: pr.created_at,
                merged_at: null,
                closed_at: null,
                review_comments: 0,
                files_changed: 1,
                status: PRStatus.OPEN,
              };
              await pullRequestStore.create(repo.id, prRecord);
            }

            // Calculate metrics
            const timePeriod: TimePeriod = {
              start: new Date('2024-01-01'),
              end: new Date('2024-12-31'),
            };
            const result = await calculator.calculatePRReviewsPerMaintainer(
              repo.id,
              timePeriod
            );

            // Verify all maintainers are included in the result
            for (const email of maintainerEmails) {
              expect(result).toHaveProperty(email);
            }

            // Verify inactive maintainers have zero values
            for (const email of inactiveMaintainers) {
              expect(result[email]).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include maintainers with zero open issues in metrics reports', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.emailAddress(), { minLength: 2, maxLength: 5 }),
          fc.array(
            fc.record({
              id: fc.uuid(),
              author: fc.emailAddress(),
              assignees: fc.array(fc.emailAddress(), { minLength: 1, maxLength: 2 }),
            }),
            { maxLength: 10 }
          ),
          async (maintainerEmails, issueData) => {
            // Ensure we have at least one inactive maintainer
            const activeMaintainers = maintainerEmails.slice(0, Math.max(1, maintainerEmails.length - 1));
            const inactiveMaintainers = maintainerEmails.slice(activeMaintainers.length);

            // Create repository with all maintainers
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

            // Create issues with only active maintainers as assignees
            for (const issue of issueData) {
              const issueRecord: IssueRecord = {
                id: issue.id,
                author: issue.author,
                assignees: issue.assignees.filter((a) => activeMaintainers.includes(a)),
                labels: [],
                created_at: new Date(),
                closed_at: null,
                first_response_at: null,
                comment_count: 0,
                status: IssueStatus.OPEN,
                title: 'Test issue',
                description: 'Test description',
              };
              await issueStore.create(repo.id, issueRecord);
            }

            // Calculate metrics
            const result = await calculator.calculateOpenIssuesPerMaintainer(repo.id);

            // Verify all maintainers are included in the result
            for (const email of maintainerEmails) {
              expect(result).toHaveProperty(email);
            }

            // Verify inactive maintainers have zero values
            for (const email of inactiveMaintainers) {
              expect(result[email]).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: Gini Coefficient Bounds
   * Validates: Requirements 2.4
   */
  describe('Property 6: Gini Coefficient Bounds', () => {
    it('should calculate Gini coefficient between 0 and 1 for any activity distribution', async () => {
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
            const commitStore = new CommitStore(pool);
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

            // Calculate contribution concentration
            const timePeriod: TimePeriod = {
              start: new Date('2024-01-01'),
              end: new Date('2024-12-31'),
            };
            const gini = await calculator.calculateContributionConcentration(
              repo.id,
              timePeriod
            );

            // Verify Gini coefficient is between 0 and 1
            expect(gini).toBeGreaterThanOrEqual(0);
            expect(gini).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 0 for perfectly equal distribution', async () => {
      // Create repository
      const repo: Repository = {
        id: fc.sample(fc.uuid(), 1)[0],
        url: 'https://github.com/test/repo',
        name: 'test-repo',
        localPath: '/tmp/test-repo',
        lastSync: new Date(),
        createdAt: new Date(),
        maintainers: [
          { name: 'alice', email: 'alice@example.com', role: MaintainerRole.MAINTAINER },
          { name: 'bob', email: 'bob@example.com', role: MaintainerRole.MAINTAINER },
          { name: 'charlie', email: 'charlie@example.com', role: MaintainerRole.MAINTAINER },
        ],
      };

      await repositoryStore.create(repo);

      // Create equal number of commits for each maintainer
      const commitStore = new CommitStore(pool);
      const maintainers = ['alice@example.com', 'bob@example.com', 'charlie@example.com'];
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

      // Calculate contribution concentration
      const timePeriod: TimePeriod = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31'),
      };
      const gini = await calculator.calculateContributionConcentration(
        repo.id,
        timePeriod
      );

      // For perfectly equal distribution, Gini should be close to 0
      expect(gini).toBeLessThan(0.01);
    });
  });
});