/**
 * Property-based tests for BurnoutDetector
 * Feature: sustainoss
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import fc from 'fast-check';
import { Pool } from 'pg';
import { BurnoutDetector } from '../BurnoutDetector.js';
import { TimePeriod } from '../MetricsCalculator.js';
import {
  RepositoryStore,
  IssueStore,
  PullRequestStore,
  initDatabase,
  dropAllTables,
} from '../../storage/index.js';
import { Repository, IssueRecord, PRRecord, BurnoutAlert } from '../../types/models.js';
import {
  MaintainerRole,
  IssueStatus,
  PRStatus,
  AlertSeverity,
  BurnoutAlertType,
  RiskLevel,
} from '../../types/enums.js';
import { documentStore } from '../../config/database.js';

describe('BurnoutDetector Property Tests', () => {
  let pool: Pool;
  let detector: BurnoutDetector;
  let repositoryStore: RepositoryStore;
  let issueStore: IssueStore;
  let prStore: PullRequestStore;

  beforeAll(async () => {
    pool = documentStore;
    await initDatabase(pool);
  });

  afterAll(async () => {
    await dropAllTables(pool);
  });

  beforeEach(async () => {
    detector = new BurnoutDetector(pool);
    repositoryStore = new RepositoryStore(pool);
    issueStore = new IssueStore(pool);
    prStore = new PullRequestStore(pool);

    // Clean up tables before each test
    await pool.query('DELETE FROM burnout_alerts');
    await pool.query('DELETE FROM issues');
    await pool.query('DELETE FROM pull_requests');
    await pool.query('DELETE FROM commits');
    await pool.query('DELETE FROM repositories');
  });

  /**
   * Property 8: High Load Concentration Detection
   * Validates: Requirements 3.1
   */
  describe('Property 8: High Load Concentration Detection', () => {
    it('should flag maintainers handling > 60% of PR reviews', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 100 }), // total PRs
          fc.integer({ min: 61, max: 100 }), // percentage for one maintainer
          async (totalPRs, highLoadPercentage) => {
            // Create test repository
            const repoId = `test-repo-${Date.now()}-${Math.random()}`;
            const repo: Repository = {
              id: repoId,
              url: 'https://github.com/test/repo',
              name: 'test-repo',
              localPath: '/tmp/test-repo',
              lastSync: new Date(),
              createdAt: new Date(),
              maintainers: [
                {
                  name: 'Alice',
                  email: 'alice@example.com',
                  role: MaintainerRole.MAINTAINER,
                },
                {
                  name: 'Bob',
                  email: 'bob@example.com',
                  role: MaintainerRole.MAINTAINER,
                },
              ],
            };
            await repositoryStore.create(repo);

            // Calculate PR distribution
            const aliceReviews = Math.floor((totalPRs * highLoadPercentage) / 100);
            const bobReviews = totalPRs - aliceReviews;

            // Create PRs with reviews
            const now = new Date();
            const timePeriod: TimePeriod = {
              start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
              end: now,
            };

            for (let i = 0; i < aliceReviews; i++) {
              const pr: PRRecord = {
                id: `pr-alice-${i}`,
                author: 'contributor@example.com',
                reviewers: ['alice@example.com'],
                created_at: new Date(
                  timePeriod.start.getTime() + i * 1000 * 60
                ),
                merged_at: new Date(
                  timePeriod.start.getTime() + i * 1000 * 60 + 3600000
                ),
                closed_at: null,
                review_comments: 1,
                files_changed: 1,
                status: PRStatus.MERGED,
              };
              await prStore.create(repoId, pr);
            }

            for (let i = 0; i < bobReviews; i++) {
              const pr: PRRecord = {
                id: `pr-bob-${i}`,
                author: 'contributor@example.com',
                reviewers: ['bob@example.com'],
                created_at: new Date(
                  timePeriod.start.getTime() + i * 1000 * 60
                ),
                merged_at: new Date(
                  timePeriod.start.getTime() + i * 1000 * 60 + 3600000
                ),
                closed_at: null,
                review_comments: 1,
                files_changed: 1,
                status: PRStatus.MERGED,
              };
              await prStore.create(repoId, pr);
            }

            // Detect high load concentration
            const alerts = await detector.detectHighLoadConcentration(
              repoId,
              timePeriod
            );

            // Should have at least one alert for Alice
            expect(alerts.length).toBeGreaterThan(0);
            const aliceAlert = alerts.find((a) =>
              a.affected_maintainers.includes('alice@example.com')
            );
            expect(aliceAlert).toBeDefined();
            expect(aliceAlert!.type).toBe(BurnoutAlertType.HIGH_LOAD);
            expect(aliceAlert!.metric_value).toBeGreaterThan(60);
            expect(aliceAlert!.threshold).toBe(60);

            // Severity should be HIGH if > 75%, MEDIUM if > 60%
            if (highLoadPercentage > 75) {
              expect(aliceAlert!.severity).toBe(AlertSeverity.HIGH);
            } else {
              expect(aliceAlert!.severity).toBe(AlertSeverity.MEDIUM);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 9: Backlog Increase Detection
   * Validates: Requirements 3.2
   */
  describe('Property 9: Backlog Increase Detection', () => {
    it('should flag backlog increases > 50% over 30 days', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 50 }), // initial open issues
          fc.integer({ min: 51, max: 200 }), // increase percentage
          async (initialIssues, increasePercentage) => {
            // Create test repository
            const repoId = `test-repo-${Date.now()}-${Math.random()}`;
            const repo: Repository = {
              id: repoId,
              url: 'https://github.com/test/repo',
              name: 'test-repo',
              localPath: '/tmp/test-repo',
              lastSync: new Date(),
              createdAt: new Date(),
              maintainers: [
                {
                  name: 'Alice',
                  email: 'alice@example.com',
                  role: MaintainerRole.MAINTAINER,
                },
              ],
            };
            await repositoryStore.create(repo);

            const now = new Date();
            const thirtyDaysAgo = new Date(
              now.getTime() - 30 * 24 * 60 * 60 * 1000
            );
            const fortyDaysAgo = new Date(
              now.getTime() - 40 * 24 * 60 * 60 * 1000
            );

            // Create initial issues (open 30 days ago and still open)
            for (let i = 0; i < initialIssues; i++) {
              const issue: IssueRecord = {
                id: `issue-old-${i}`,
                author: 'user@example.com',
                assignees: ['alice@example.com'],
                labels: [],
                created_at: fortyDaysAgo,
                closed_at: null,
                first_response_at: fortyDaysAgo,
                comment_count: 1,
                status: IssueStatus.OPEN,
                title: `Old issue ${i}`,
                description: 'Description',
              };
              await issueStore.create(repoId, issue);
            }

            // Calculate new issues to create
            const currentIssues = Math.floor(
              initialIssues * (1 + increasePercentage / 100)
            );
            const newIssues = currentIssues - initialIssues;

            // Create new issues (created in last 30 days)
            for (let i = 0; i < newIssues; i++) {
              const issue: IssueRecord = {
                id: `issue-new-${i}`,
                author: 'user@example.com',
                assignees: ['alice@example.com'],
                labels: [],
                created_at: new Date(
                  thirtyDaysAgo.getTime() + i * 1000 * 60
                ),
                closed_at: null,
                first_response_at: null,
                comment_count: 0,
                status: IssueStatus.OPEN,
                title: `New issue ${i}`,
                description: 'Description',
              };
              await issueStore.create(repoId, issue);
            }

            // Detect increasing backlog
            const alert = await detector.detectIncreasingBacklog(repoId);

            // Should have an alert
            expect(alert).not.toBeNull();
            expect(alert!.type).toBe(BurnoutAlertType.INCREASING_BACKLOG);
            expect(alert!.metric_value).toBeGreaterThan(50);
            expect(alert!.threshold).toBe(50);

            // Severity should be HIGH if > 100%, MEDIUM if > 50%
            if (increasePercentage > 100) {
              expect(alert!.severity).toBe(AlertSeverity.HIGH);
            } else {
              expect(alert!.severity).toBe(AlertSeverity.MEDIUM);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 10: Responsiveness Decline Detection
   * Validates: Requirements 3.3
   */
  describe('Property 10: Responsiveness Decline Detection', () => {
    it('should flag response time increases > 40% vs baseline', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 24 }), // baseline hours
          fc.integer({ min: 41, max: 200 }), // increase percentage
          async (baselineHours, increasePercentage) => {
            // Create test repository
            const repoId = `test-repo-${Date.now()}-${Math.random()}`;
            const repo: Repository = {
              id: repoId,
              url: 'https://github.com/test/repo',
              name: 'test-repo',
              localPath: '/tmp/test-repo',
              lastSync: new Date(),
              createdAt: new Date(),
              maintainers: [
                {
                  name: 'Alice',
                  email: 'alice@example.com',
                  role: MaintainerRole.MAINTAINER,
                },
              ],
            };
            await repositoryStore.create(repo);

            const now = new Date();

            // Create baseline PRs (90-60 days ago)
            const baselineStart = new Date(
              now.getTime() - 90 * 24 * 60 * 60 * 1000
            );
            const baselineEnd = new Date(
              now.getTime() - 60 * 24 * 60 * 60 * 1000
            );

            for (let i = 0; i < 10; i++) {
              const createdAt = new Date(
                baselineStart.getTime() +
                  (i * (baselineEnd.getTime() - baselineStart.getTime())) / 10
              );
              const mergedAt = new Date(
                createdAt.getTime() + baselineHours * 60 * 60 * 1000
              );

              const pr: PRRecord = {
                id: `pr-baseline-${i}`,
                author: 'contributor@example.com',
                reviewers: ['alice@example.com'],
                created_at: createdAt,
                merged_at: mergedAt,
                closed_at: null,
                review_comments: 1,
                files_changed: 1,
                status: PRStatus.MERGED,
              };
              await prStore.create(repoId, pr);
            }

            // Create current PRs (last 30 days) with increased response time
            const currentStart = new Date(
              now.getTime() - 30 * 24 * 60 * 60 * 1000
            );
            const currentHours = baselineHours * (1 + increasePercentage / 100);

            for (let i = 0; i < 10; i++) {
              const createdAt = new Date(
                currentStart.getTime() +
                  (i * (now.getTime() - currentStart.getTime())) / 10
              );
              const mergedAt = new Date(
                createdAt.getTime() + currentHours * 60 * 60 * 1000
              );

              const pr: PRRecord = {
                id: `pr-current-${i}`,
                author: 'contributor@example.com',
                reviewers: ['alice@example.com'],
                created_at: createdAt,
                merged_at: mergedAt,
                closed_at: null,
                review_comments: 1,
                files_changed: 1,
                status: PRStatus.MERGED,
              };
              await prStore.create(repoId, pr);
            }

            // Detect declining responsiveness
            const alerts = await detector.detectDecliningResponsiveness(repoId);

            // Should have at least one alert for Alice
            expect(alerts.length).toBeGreaterThan(0);
            const aliceAlert = alerts.find((a) =>
              a.affected_maintainers.includes('alice@example.com')
            );
            expect(aliceAlert).toBeDefined();
            expect(aliceAlert!.type).toBe(
              BurnoutAlertType.DECLINING_RESPONSIVENESS
            );
            expect(aliceAlert!.metric_value).toBeGreaterThan(40);
            expect(aliceAlert!.threshold).toBe(40);

            // Severity should be HIGH if > 100%, MEDIUM if > 40%
            if (increasePercentage > 100) {
              expect(aliceAlert!.severity).toBe(AlertSeverity.HIGH);
            } else {
              expect(aliceAlert!.severity).toBe(AlertSeverity.MEDIUM);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 11: Untriaged Issue Detection
   * Validates: Requirements 3.4
   */
  describe('Property 11: Untriaged Issue Detection', () => {
    it('should flag issues untriaged for > 14 days', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 15, max: 60 }), // days untriaged
          fc.integer({ min: 1, max: 10 }), // number of untriaged issues
          async (daysUntriaged, numIssues) => {
            // Create test repository
            const repoId = `test-repo-${Date.now()}-${Math.random()}`;
            const repo: Repository = {
              id: repoId,
              url: 'https://github.com/test/repo',
              name: 'test-repo',
              localPath: '/tmp/test-repo',
              lastSync: new Date(),
              createdAt: new Date(),
              maintainers: [
                {
                  name: 'Alice',
                  email: 'alice@example.com',
                  role: MaintainerRole.MAINTAINER,
                },
              ],
            };
            await repositoryStore.create(repo);

            const now = new Date();
            const createdAt = new Date(
              now.getTime() - daysUntriaged * 24 * 60 * 60 * 1000
            );

            // Create untriaged issues (no assignees, no comments)
            for (let i = 0; i < numIssues; i++) {
              const issue: IssueRecord = {
                id: `issue-untriaged-${i}`,
                author: 'user@example.com',
                assignees: [],
                labels: [],
                created_at: createdAt,
                closed_at: null,
                first_response_at: null,
                comment_count: 0,
                status: IssueStatus.OPEN,
                title: `Untriaged issue ${i}`,
                description: 'Description',
              };
              await issueStore.create(repoId, issue);
            }

            // Detect untriaged issues
            const alert = await detector.detectUntriagedIssues(repoId);

            // Should have an alert
            expect(alert).not.toBeNull();
            expect(alert!.type).toBe(BurnoutAlertType.UNTRIAGED_ISSUES);
            expect(alert!.metric_value).toBeGreaterThanOrEqual(14);
            expect(alert!.threshold).toBe(14);

            // Severity should be HIGH if > 30 days, MEDIUM if > 14 days
            if (daysUntriaged > 30) {
              expect(alert!.severity).toBe(AlertSeverity.HIGH);
            } else {
              expect(alert!.severity).toBe(AlertSeverity.MEDIUM);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 12: Burnout Risk Aggregation
   * Validates: Requirements 3.5
   */
  describe('Property 12: Burnout Risk Aggregation', () => {
    it('should correctly calculate overall risk level from alerts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 5 }), // number of high alerts
          fc.integer({ min: 0, max: 5 }), // number of medium alerts
          async (highAlerts, mediumAlerts) => {
            // Create alerts with specified severities
            const alerts: BurnoutAlert[] = [];

            for (let i = 0; i < highAlerts; i++) {
              alerts.push({
                type: BurnoutAlertType.HIGH_LOAD,
                severity: AlertSeverity.HIGH,
                affected_maintainers: ['alice@example.com'],
                metric_value: 80,
                threshold: 60,
                message: `High alert ${i}`,
                timestamp: new Date(),
              });
            }

            for (let i = 0; i < mediumAlerts; i++) {
              alerts.push({
                type: BurnoutAlertType.INCREASING_BACKLOG,
                severity: AlertSeverity.MEDIUM,
                affected_maintainers: [],
                metric_value: 60,
                threshold: 50,
                message: `Medium alert ${i}`,
                timestamp: new Date(),
              });
            }

            // Calculate overall risk
            const overallRisk = detector.calculateOverallRisk(alerts);

            // Verify risk level according to rules:
            // High: 2+ high alerts
            // Medium: 2+ medium alerts OR 1 high alert
            // Low: 0-1 medium alerts, 0 high alerts

            if (highAlerts >= 2) {
              expect(overallRisk).toBe(RiskLevel.HIGH);
            } else if (mediumAlerts >= 2 || highAlerts >= 1) {
              expect(overallRisk).toBe(RiskLevel.MEDIUM);
            } else {
              expect(overallRisk).toBe(RiskLevel.LOW);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should store alerts in database when detecting all alerts', async () => {
      // Create test repository with high load scenario
      const repoId = `test-repo-${Date.now()}-${Math.random()}`;
      const repo: Repository = {
        id: repoId,
        url: 'https://github.com/test/repo',
        name: 'test-repo',
        localPath: '/tmp/test-repo',
        lastSync: new Date(),
        createdAt: new Date(),
        maintainers: [
          {
            name: 'Alice',
            email: 'alice@example.com',
            role: MaintainerRole.MAINTAINER,
          },
          {
            name: 'Bob',
            email: 'bob@example.com',
            role: MaintainerRole.MAINTAINER,
          },
        ],
      };
      await repositoryStore.create(repo);

      const now = new Date();
      const timePeriod: TimePeriod = {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: now,
      };

      // Create PRs with Alice handling 80% of reviews
      for (let i = 0; i < 80; i++) {
        const pr: PRRecord = {
          id: `pr-alice-${i}`,
          author: 'contributor@example.com',
          reviewers: ['alice@example.com'],
          created_at: new Date(timePeriod.start.getTime() + i * 1000 * 60),
          merged_at: new Date(
            timePeriod.start.getTime() + i * 1000 * 60 + 3600000
          ),
          closed_at: null,
          review_comments: 1,
          files_changed: 1,
          status: PRStatus.MERGED,
        };
        await prStore.create(repoId, pr);
      }

      for (let i = 0; i < 20; i++) {
        const pr: PRRecord = {
          id: `pr-bob-${i}`,
          author: 'contributor@example.com',
          reviewers: ['bob@example.com'],
          created_at: new Date(timePeriod.start.getTime() + i * 1000 * 60),
          merged_at: new Date(
            timePeriod.start.getTime() + i * 1000 * 60 + 3600000
          ),
          closed_at: null,
          review_comments: 1,
          files_changed: 1,
          status: PRStatus.MERGED,
        };
        await prStore.create(repoId, pr);
      }

      // Detect and store all alerts
      const result = await detector.detectAndStoreAllAlerts(
        repoId,
        timePeriod
      );

      // Should have detected high load alert
      expect(result.alerts.length).toBeGreaterThan(0);
      expect(result.overallRisk).toBeDefined();

      // Verify alerts were stored in database
      const storedAlerts = await detector.getActiveAlerts(repoId);
      expect(storedAlerts.length).toBe(result.alerts.length);
    });
  });
});
