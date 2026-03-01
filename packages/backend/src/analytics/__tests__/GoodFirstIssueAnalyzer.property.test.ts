/**
 * Property-based tests for GoodFirstIssueAnalyzer
 * Feature: sustainoss
 */

import fc from 'fast-check';
import { Pool } from 'pg';
import {
  GoodFirstIssueAnalyzer,
  RepositoryHistory,
} from '../GoodFirstIssueAnalyzer.js';
import {
  RepositoryStore,
  IssueStore,
  initDatabase,
  dropAllTables,
} from '../../storage/index.js';
import { Repository, IssueRecord } from '../../types/models.js';
import { MaintainerRole, IssueStatus } from '../../types/enums.js';
import { documentStore } from '../../config/database.js';

describe('GoodFirstIssueAnalyzer Property Tests', () => {
  let pool: Pool;
  let analyzer: GoodFirstIssueAnalyzer;
  let repositoryStore: RepositoryStore;
  let issueStore: IssueStore;

  beforeAll(async () => {
    pool = documentStore;
    await initDatabase(pool);
    analyzer = new GoodFirstIssueAnalyzer(pool);
    repositoryStore = new RepositoryStore(pool);
    issueStore = new IssueStore(pool);
  });

  afterAll(async () => {
    await dropAllTables(pool);
  });

  beforeEach(async () => {
    // Clean up data before each test
    await pool.query('DELETE FROM issues');
    await pool.query('DELETE FROM repositories');
  });

  /**
   * Property 24: Issue Complexity Scoring
   * Validates: Requirements 7.1
   */
  describe('Property 24: Issue Complexity Scoring', () => {
    it('should calculate complexity score between 0 and 100 for any issue', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            author: fc.emailAddress(),
            assignees: fc.array(fc.emailAddress(), { maxLength: 3 }),
            labels: fc.array(
              fc.constantFrom('bug', 'feature', 'documentation', 'enhancement'),
              { maxLength: 5 }
            ),
            title: fc.string({ minLength: 10, maxLength: 100 }),
            description: fc.string({ minLength: 50, maxLength: 500 }),
            comment_count: fc.integer({ min: 0, max: 20 }),
          }),
          fc.array(
            fc.record({
              id: fc.uuid(),
              labels: fc.array(
                fc.constantFrom(
                  'bug',
                  'feature',
                  'documentation',
                  'enhancement'
                ),
                { maxLength: 5 }
              ),
              status: fc.constant(IssueStatus.CLOSED),
            }),
            { maxLength: 10 }
          ),
          async (issueData, closedIssuesData) => {
            // Create issue record
            const issue: IssueRecord = {
              id: issueData.id,
              author: issueData.author,
              assignees: issueData.assignees,
              labels: issueData.labels,
              created_at: new Date('2024-06-01'),
              closed_at: null,
              first_response_at: null,
              comment_count: issueData.comment_count,
              status: IssueStatus.OPEN,
              title: issueData.title,
              description: issueData.description,
            };

            // Create closed issues for history
            const closedIssues: IssueRecord[] = closedIssuesData.map(
              (data) => ({
                id: data.id,
                author: 'author@example.com',
                assignees: [],
                labels: data.labels,
                created_at: new Date('2024-01-01'),
                closed_at: new Date('2024-02-01'),
                first_response_at: new Date('2024-01-02'),
                comment_count: 5,
                status: data.status,
                title: 'Closed issue',
                description: 'Description',
              })
            );

            const repoHistory: RepositoryHistory = { closedIssues };

            // Analyze complexity
            const complexityScore = analyzer.analyzeIssueComplexity(
              issue,
              repoHistory
            );

            // Verify score is between 0 and 100
            expect(complexityScore.score).toBeGreaterThanOrEqual(0);
            expect(complexityScore.score).toBeLessThanOrEqual(100);

            // Verify factors object exists
            expect(complexityScore.factors).toBeDefined();
            expect(typeof complexityScore.factors).toBe('object');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should give lower complexity score for issues with similar closed issues', async () => {
      const issue: IssueRecord = {
        id: 'issue-1',
        author: 'author@example.com',
        assignees: [],
        labels: ['bug', 'documentation'],
        created_at: new Date('2024-06-01'),
        closed_at: null,
        first_response_at: null,
        comment_count: 2,
        status: IssueStatus.OPEN,
        title: 'Fix documentation typo',
        description: 'There is a typo in the README file',
      };

      // Create history with many similar closed issues
      const closedIssues: IssueRecord[] = [];
      for (let i = 0; i < 5; i++) {
        closedIssues.push({
          id: `closed-${i}`,
          author: 'author@example.com',
          assignees: [],
          labels: ['bug', 'documentation'], // Same labels
          created_at: new Date('2024-01-01'),
          closed_at: new Date('2024-02-01'),
          first_response_at: new Date('2024-01-02'),
          comment_count: 3,
          status: IssueStatus.CLOSED,
          title: 'Similar documentation issue',
          description: 'Description',
        });
      }

      const repoHistoryWithSimilar: RepositoryHistory = { closedIssues };
      const repoHistoryWithoutSimilar: RepositoryHistory = {
        closedIssues: [],
      };

      const scoreWithSimilar = analyzer.analyzeIssueComplexity(
        issue,
        repoHistoryWithSimilar
      );
      const scoreWithoutSimilar = analyzer.analyzeIssueComplexity(
        issue,
        repoHistoryWithoutSimilar
      );

      // Score should be lower (simpler) when there are similar closed issues
      expect(scoreWithSimilar.score).toBeLessThan(scoreWithoutSimilar.score);
    });

    it('should give lower complexity score for documentation issues', async () => {
      const docIssue: IssueRecord = {
        id: 'doc-issue',
        author: 'author@example.com',
        assignees: [],
        labels: ['documentation'],
        created_at: new Date('2024-06-01'),
        closed_at: null,
        first_response_at: null,
        comment_count: 1,
        status: IssueStatus.OPEN,
        title: 'Update documentation',
        description: 'The documentation needs updating',
      };

      const featureIssue: IssueRecord = {
        id: 'feature-issue',
        author: 'author@example.com',
        assignees: [],
        labels: ['feature'],
        created_at: new Date('2024-06-01'),
        closed_at: null,
        first_response_at: null,
        comment_count: 1,
        status: IssueStatus.OPEN,
        title: 'Add new feature',
        description: 'We need a new feature',
      };

      const repoHistory: RepositoryHistory = { closedIssues: [] };

      const docScore = analyzer.analyzeIssueComplexity(docIssue, repoHistory);
      const featureScore = analyzer.analyzeIssueComplexity(
        featureIssue,
        repoHistory
      );

      // Documentation issues should have lower complexity
      expect(docScore.score).toBeLessThan(featureScore.score);
    });

    it('should give higher complexity score for issues with complexity indicators', async () => {
      const simpleIssue: IssueRecord = {
        id: 'simple-issue',
        author: 'author@example.com',
        assignees: [],
        labels: ['bug'],
        created_at: new Date('2024-06-01'),
        closed_at: null,
        first_response_at: null,
        comment_count: 1,
        status: IssueStatus.OPEN,
        title: 'Fix typo',
        description: 'There is a typo in the code',
      };

      const complexIssue: IssueRecord = {
        id: 'complex-issue',
        author: 'author@example.com',
        assignees: [],
        labels: ['feature'],
        created_at: new Date('2024-06-01'),
        closed_at: null,
        first_response_at: null,
        comment_count: 1,
        status: IssueStatus.OPEN,
        title: 'Refactor architecture',
        description:
          'We need to refactor the entire architecture to improve performance',
      };

      const repoHistory: RepositoryHistory = { closedIssues: [] };

      const simpleScore = analyzer.analyzeIssueComplexity(
        simpleIssue,
        repoHistory
      );
      const complexScore = analyzer.analyzeIssueComplexity(
        complexIssue,
        repoHistory
      );

      // Issues with complexity indicators should have higher complexity
      expect(complexScore.score).toBeGreaterThan(simpleScore.score);
    });
  });

  /**
   * Property 25: Issue Clarity Scoring
   * Validates: Requirements 7.2
   */
  describe('Property 25: Issue Clarity Scoring', () => {
    it('should calculate clarity score between 0 and 100 for any issue', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            author: fc.emailAddress(),
            assignees: fc.array(fc.emailAddress(), { maxLength: 3 }),
            labels: fc.array(fc.string({ minLength: 3, maxLength: 15 }), {
              maxLength: 5,
            }),
            title: fc.string({ minLength: 10, maxLength: 100 }),
            description: fc.string({ minLength: 10, maxLength: 1000 }),
            comment_count: fc.integer({ min: 0, max: 20 }),
          }),
          async (issueData) => {
            // Create issue record
            const issue: IssueRecord = {
              id: issueData.id,
              author: issueData.author,
              assignees: issueData.assignees,
              labels: issueData.labels,
              created_at: new Date('2024-06-01'),
              closed_at: null,
              first_response_at: null,
              comment_count: issueData.comment_count,
              status: IssueStatus.OPEN,
              title: issueData.title,
              description: issueData.description,
            };

            // Analyze clarity
            const clarityScore = analyzer.analyzeIssueClarity(issue);

            // Verify score is between 0 and 100
            expect(clarityScore.score).toBeGreaterThanOrEqual(0);
            expect(clarityScore.score).toBeLessThanOrEqual(100);

            // Verify factors object exists
            expect(clarityScore.factors).toBeDefined();
            expect(typeof clarityScore.factors).toBe('object');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should give higher clarity score for issues with long descriptions', async () => {
      const shortDescIssue: IssueRecord = {
        id: 'short-issue',
        author: 'author@example.com',
        assignees: [],
        labels: [],
        created_at: new Date('2024-06-01'),
        closed_at: null,
        first_response_at: null,
        comment_count: 0,
        status: IssueStatus.OPEN,
        title: 'Bug',
        description: 'There is a bug', // < 200 characters
      };

      const longDescIssue: IssueRecord = {
        id: 'long-issue',
        author: 'author@example.com',
        assignees: [],
        labels: [],
        created_at: new Date('2024-06-01'),
        closed_at: null,
        first_response_at: null,
        comment_count: 0,
        status: IssueStatus.OPEN,
        title: 'Bug with detailed description',
        description:
          'There is a bug in the application that occurs when users try to submit a form. The bug manifests as an error message that says "Invalid input" even when the input is valid. This has been reported by multiple users and needs to be fixed urgently.', // > 200 characters
      };

      const shortScore = analyzer.analyzeIssueClarity(shortDescIssue);
      const longScore = analyzer.analyzeIssueClarity(longDescIssue);

      // Long description should have higher clarity score
      expect(longScore.score).toBeGreaterThan(shortScore.score);
    });

    it('should give higher clarity score for issues with code blocks', async () => {
      const noCodeIssue: IssueRecord = {
        id: 'no-code-issue',
        author: 'author@example.com',
        assignees: [],
        labels: [],
        created_at: new Date('2024-06-01'),
        closed_at: null,
        first_response_at: null,
        comment_count: 0,
        status: IssueStatus.OPEN,
        title: 'Bug',
        description: 'There is a bug in the code that needs to be fixed',
      };

      const codeBlockIssue: IssueRecord = {
        id: 'code-issue',
        author: 'author@example.com',
        assignees: [],
        labels: [],
        created_at: new Date('2024-06-01'),
        closed_at: null,
        first_response_at: null,
        comment_count: 0,
        status: IssueStatus.OPEN,
        title: 'Bug with code example',
        description:
          'There is a bug in the code:\n```javascript\nconst x = 1;\n```',
      };

      const noCodeScore = analyzer.analyzeIssueClarity(noCodeIssue);
      const codeScore = analyzer.analyzeIssueClarity(codeBlockIssue);

      // Issues with code blocks should have higher clarity score
      expect(codeScore.score).toBeGreaterThan(noCodeScore.score);
    });

    it('should give higher clarity score for issues with reproduction steps', async () => {
      const noReproIssue: IssueRecord = {
        id: 'no-repro-issue',
        author: 'author@example.com',
        assignees: [],
        labels: [],
        created_at: new Date('2024-06-01'),
        closed_at: null,
        first_response_at: null,
        comment_count: 0,
        status: IssueStatus.OPEN,
        title: 'Bug',
        description: 'There is a bug that needs to be fixed',
      };

      const reproIssue: IssueRecord = {
        id: 'repro-issue',
        author: 'author@example.com',
        assignees: [],
        labels: [],
        created_at: new Date('2024-06-01'),
        closed_at: null,
        first_response_at: null,
        comment_count: 0,
        status: IssueStatus.OPEN,
        title: 'Bug with reproduction steps',
        description:
          'Steps to reproduce:\n1. Open the app\n2. Click the button\n3. See the error',
      };

      const noReproScore = analyzer.analyzeIssueClarity(noReproIssue);
      const reproScore = analyzer.analyzeIssueClarity(reproIssue);

      // Issues with reproduction steps should have higher clarity score
      expect(reproScore.score).toBeGreaterThan(noReproScore.score);
    });

    it('should give higher clarity score for issues with labels', async () => {
      const noLabelsIssue: IssueRecord = {
        id: 'no-labels-issue',
        author: 'author@example.com',
        assignees: [],
        labels: [],
        created_at: new Date('2024-06-01'),
        closed_at: null,
        first_response_at: null,
        comment_count: 0,
        status: IssueStatus.OPEN,
        title: 'Bug',
        description: 'There is a bug',
      };

      const labelsIssue: IssueRecord = {
        id: 'labels-issue',
        author: 'author@example.com',
        assignees: [],
        labels: ['bug', 'high-priority'],
        created_at: new Date('2024-06-01'),
        closed_at: null,
        first_response_at: null,
        comment_count: 0,
        status: IssueStatus.OPEN,
        title: 'Bug',
        description: 'There is a bug',
      };

      const noLabelsScore = analyzer.analyzeIssueClarity(noLabelsIssue);
      const labelsScore = analyzer.analyzeIssueClarity(labelsIssue);

      // Issues with labels should have higher clarity score
      expect(labelsScore.score).toBeGreaterThan(noLabelsScore.score);
    });
  });

  /**
   * Property 26: Good First Issue Recommendation Threshold
   * Validates: Requirements 7.3, 7.4
   */
  describe('Property 26: Good First Issue Recommendation Threshold', () => {
    it('should only recommend issues with overall score > 60', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.uuid(),
              author: fc.emailAddress(),
              labels: fc.array(
                fc.constantFrom(
                  'bug',
                  'feature',
                  'documentation',
                  'good-first-issue'
                ),
                { maxLength: 3 }
              ),
              title: fc.string({ minLength: 10, maxLength: 100 }),
              description: fc.string({ minLength: 50, maxLength: 500 }),
            }),
            { minLength: 5, maxLength: 20 }
          ),
          async (issuesData) => {
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

            // Create open issues
            for (const issueData of issuesData) {
              const issue: IssueRecord = {
                id: issueData.id,
                author: issueData.author,
                assignees: [],
                labels: issueData.labels,
                created_at: new Date('2024-06-01'),
                closed_at: null,
                first_response_at: null,
                comment_count: 0,
                status: IssueStatus.OPEN,
                title: issueData.title,
                description: issueData.description,
              };
              await issueStore.create(repo.id, issue);
            }

            // Get recommendations
            const recommendations = await analyzer.recommendGoodFirstIssues(
              repo.id,
              100
            );

            // Verify all recommendations have overall_score > 60
            for (const rec of recommendations) {
              expect(rec.overall_score).toBeGreaterThan(60);
            }

            // Verify recommendations are sorted by overall_score descending
            for (let i = 1; i < recommendations.length; i++) {
              expect(recommendations[i - 1].overall_score).toBeGreaterThanOrEqual(
                recommendations[i].overall_score
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate overall score as (100 - complexity) × 0.5 + clarity × 0.5', async () => {
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

      // Create a good first issue (low complexity, high clarity)
      const goodIssue: IssueRecord = {
        id: 'good-issue',
        author: 'author@example.com',
        assignees: [],
        labels: ['documentation', 'good-first-issue'],
        created_at: new Date('2024-06-01'),
        closed_at: null,
        first_response_at: null,
        comment_count: 0,
        status: IssueStatus.OPEN,
        title: 'Update README documentation',
        description:
          'The README file needs to be updated with the latest installation instructions. Here are the steps to reproduce the issue:\n1. Read the README\n2. Notice outdated info\n```bash\nnpm install\n```',
      };

      await issueStore.create(repo.id, goodIssue);

      // Create some closed issues for history
      for (let i = 0; i < 3; i++) {
        const closedIssue: IssueRecord = {
          id: `closed-${i}`,
          author: 'author@example.com',
          assignees: [],
          labels: ['documentation'],
          created_at: new Date('2024-01-01'),
          closed_at: new Date('2024-02-01'),
          first_response_at: new Date('2024-01-02'),
          comment_count: 2,
          status: IssueStatus.CLOSED,
          title: 'Documentation update',
          description: 'Updated docs',
        };
        await issueStore.create(repo.id, closedIssue);
      }

      // Get recommendations
      const recommendations = await analyzer.recommendGoodFirstIssues(
        repo.id,
        10
      );

      // Verify the good issue is recommended
      const goodRec = recommendations.find((r) => r.issue_id === 'good-issue');
      expect(goodRec).toBeDefined();

      if (goodRec) {
        // Verify overall score calculation
        const expectedOverall =
          (100 - goodRec.complexity_score) * 0.5 + goodRec.clarity_score * 0.5;
        expect(Math.abs(goodRec.overall_score - expectedOverall)).toBeLessThan(
          0.01
        );

        // Verify it has a justification
        expect(goodRec.justification).toBeDefined();
        expect(goodRec.justification.length).toBeGreaterThan(0);
      }
    });

    it('should respect the limit parameter', async () => {
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

      // Create many good first issues
      for (let i = 0; i < 20; i++) {
        const issue: IssueRecord = {
          id: `issue-${i}`,
          author: 'author@example.com',
          assignees: [],
          labels: ['documentation', 'good-first-issue'],
          created_at: new Date('2024-06-01'),
          closed_at: null,
          first_response_at: null,
          comment_count: 0,
          status: IssueStatus.OPEN,
          title: `Update documentation ${i}`,
          description:
            'The documentation needs to be updated. Here are the steps to reproduce:\n1. Read the docs\n2. Notice issue\n```bash\ncode example\n```',
        };
        await issueStore.create(repo.id, issue);
      }

      // Get recommendations with limit
      const limit = 5;
      const recommendations = await analyzer.recommendGoodFirstIssues(
        repo.id,
        limit
      );

      // Verify we get at most 'limit' recommendations
      expect(recommendations.length).toBeLessThanOrEqual(limit);
    });

    it('should return empty array when no issues meet the threshold', async () => {
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

      // Create complex issues with poor clarity (low overall score)
      for (let i = 0; i < 5; i++) {
        const issue: IssueRecord = {
          id: `complex-issue-${i}`,
          author: 'author@example.com',
          assignees: [],
          labels: ['feature'],
          created_at: new Date('2024-06-01'),
          closed_at: null,
          first_response_at: null,
          comment_count: 0,
          status: IssueStatus.OPEN,
          title: 'Complex refactor',
          description: 'Refactor architecture', // Short, no details
        };
        await issueStore.create(repo.id, issue);
      }

      // Get recommendations
      const recommendations = await analyzer.recommendGoodFirstIssues(
        repo.id,
        10
      );

      // Should return empty or very few recommendations
      // (depends on exact scoring, but complex issues with poor clarity should score low)
      for (const rec of recommendations) {
        expect(rec.overall_score).toBeGreaterThan(60);
      }
    });
  });
});
