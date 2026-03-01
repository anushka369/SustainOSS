import { describe, it, expect } from '@jest/globals';
import { DataExtractor } from '../DataExtractor.js';
import { Commit, Repository } from '../../types/models.js';
import { PRStatus } from '../../types/enums.js';
import type { RawPullRequest, RawIssue } from '../DataExtractor.js';

describe('DataExtractor - Unit Tests', () => {
  let extractor: DataExtractor;

  beforeEach(() => {
    extractor = new DataExtractor();
  });

  describe('extractCommitData', () => {
    it('should extract all required commit fields', () => {
      const commit: Commit = {
        sha: 'abc123def456',
        author: 'John Doe',
        authorEmail: 'john.doe@example.com',
        timestamp: new Date('2024-01-15T10:00:00Z'),
        filesChanged: 5,
        insertions: 100,
        deletions: 50,
        message: 'feat: add new feature',
      };

      const record = extractor.extractCommitData(commit);

      expect(record.sha).toBe('abc123def456');
      expect(record.author).toBe('John Doe');
      expect(record.author_email).toBe('john.doe@example.com');
      expect(record.timestamp).toEqual(new Date('2024-01-15T10:00:00Z'));
      expect(record.files_changed).toBe(5);
      expect(record.insertions).toBe(100);
      expect(record.deletions).toBe(50);
      expect(record.message).toBe('feat: add new feature');
    });

    it('should handle commits with zero changes', () => {
      const commit: Commit = {
        sha: 'initial',
        author: 'Initial Commit',
        authorEmail: 'init@example.com',
        timestamp: new Date('2024-01-01T00:00:00Z'),
        filesChanged: 0,
        insertions: 0,
        deletions: 0,
        message: 'Initial commit',
      };

      const record = extractor.extractCommitData(commit);

      expect(record.files_changed).toBe(0);
      expect(record.insertions).toBe(0);
      expect(record.deletions).toBe(0);
    });
  });

  describe('extractPRData', () => {
    it('should extract all required PR fields', () => {
      const pr: RawPullRequest = {
        id: 'pr-123',
        author: 'Jane Doe',
        reviewers: ['reviewer1@example.com', 'reviewer2@example.com'],
        created_at: new Date('2024-01-10T10:00:00Z'),
        merged_at: new Date('2024-01-15T10:00:00Z'),
        closed_at: new Date('2024-01-15T10:00:00Z'),
        review_comments: 5,
        files_changed: 10,
        status: 'merged',
      };

      const record = extractor.extractPRData(pr);

      expect(record.id).toBe('pr-123');
      expect(record.author).toBe('Jane Doe');
      expect(record.reviewers).toEqual([
        'reviewer1@example.com',
        'reviewer2@example.com',
      ]);
      expect(record.created_at).toEqual(new Date('2024-01-10T10:00:00Z'));
      expect(record.merged_at).toEqual(new Date('2024-01-15T10:00:00Z'));
      expect(record.closed_at).toEqual(new Date('2024-01-15T10:00:00Z'));
      expect(record.review_comments).toBe(5);
      expect(record.files_changed).toBe(10);
      expect(record.status).toBe('merged');
    });

    it('should handle open PRs with null dates', () => {
      const pr: RawPullRequest = {
        id: 'pr-456',
        author: 'Bob Smith',
        reviewers: [],
        created_at: new Date('2024-01-20T10:00:00Z'),
        merged_at: null,
        closed_at: null,
        review_comments: 0,
        files_changed: 3,
        status: 'open',
      };

      const record = extractor.extractPRData(pr);

      expect(record.status).toBe('open');
      expect(record.merged_at).toBeNull();
      expect(record.closed_at).toBeNull();
      expect(record.reviewers).toEqual([]);
    });
  });

  describe('extractIssueData', () => {
    it('should extract all required issue fields', () => {
      const issue: RawIssue = {
        id: 'issue-789',
        author: 'Alice Johnson',
        assignees: ['maintainer@example.com'],
        labels: ['bug', 'high-priority', 'needs-triage'],
        created_at: new Date('2024-01-12T10:00:00Z'),
        closed_at: null,
        first_response_at: new Date('2024-01-13T10:00:00Z'),
        comment_count: 7,
        status: 'open',
        title: 'Critical bug in authentication',
        description: 'Users cannot log in with OAuth',
      };

      const record = extractor.extractIssueData(issue);

      expect(record.id).toBe('issue-789');
      expect(record.author).toBe('Alice Johnson');
      expect(record.assignees).toEqual(['maintainer@example.com']);
      expect(record.labels).toEqual(['bug', 'high-priority', 'needs-triage']);
      expect(record.created_at).toEqual(new Date('2024-01-12T10:00:00Z'));
      expect(record.first_response_at).toEqual(new Date('2024-01-13T10:00:00Z'));
      expect(record.comment_count).toBe(7);
      expect(record.status).toBe('open');
      expect(record.title).toBe('Critical bug in authentication');
      expect(record.description).toBe('Users cannot log in with OAuth');
    });

    it('should handle closed issues', () => {
      const issue: RawIssue = {
        id: 'issue-101',
        author: 'Charlie Brown',
        assignees: [],
        labels: ['enhancement'],
        created_at: new Date('2024-01-05T10:00:00Z'),
        closed_at: new Date('2024-01-10T10:00:00Z'),
        first_response_at: new Date('2024-01-06T10:00:00Z'),
        comment_count: 3,
        status: 'closed',
        title: 'Add dark mode',
        description: 'Please add dark mode support',
      };

      const record = extractor.extractIssueData(issue);

      expect(record.status).toBe('closed');
      expect(record.closed_at).toEqual(new Date('2024-01-10T10:00:00Z'));
    });
  });

  describe('identifyMaintainers', () => {
    it('should identify maintainers from merge commits', async () => {
      const repo: Repository = {
        id: 'repo-1',
        url: 'https://github.com/test/repo',
        name: 'test-repo',
        localPath: '/tmp/test-repo',
        lastSync: new Date(),
        createdAt: new Date(),
        maintainers: [],
      };

      const commits: Commit[] = [
        {
          sha: 'abc123',
          author: 'Alice Maintainer',
          authorEmail: 'alice@example.com',
          timestamp: new Date(),
          filesChanged: 1,
          insertions: 10,
          deletions: 5,
          message: 'Merge pull request #42 from feature-branch',
        },
        {
          sha: 'def456',
          author: 'Bob Contributor',
          authorEmail: 'bob@example.com',
          timestamp: new Date(),
          filesChanged: 2,
          insertions: 20,
          deletions: 10,
          message: 'Add new feature',
        },
      ];

      const prs: any[] = [];

      const maintainers = await extractor.identifyMaintainers(
        repo,
        commits,
        prs
      );

      expect(maintainers.length).toBeGreaterThan(0);
      const alice = maintainers.find((m) => m.email === 'alice@example.com');
      expect(alice).toBeDefined();
      expect(alice?.name).toBe('Alice Maintainer');
    });

    it('should identify maintainers from PR reviewers', async () => {
      const repo: Repository = {
        id: 'repo-2',
        url: 'https://github.com/test/repo2',
        name: 'test-repo2',
        localPath: '/tmp/test-repo2',
        lastSync: new Date(),
        createdAt: new Date(),
        maintainers: [],
      };

      const commits: Commit[] = [];

      const prs: any[] = [
        {
          id: 'pr-1',
          author: 'contributor@example.com',
          reviewers: ['reviewer1@example.com', 'reviewer2@example.com'],
          created_at: new Date(),
          merged_at: new Date(),
          closed_at: new Date(),
          review_comments: 5,
          files_changed: 3,
          status: PRStatus.MERGED,
        },
      ];

      const maintainers = await extractor.identifyMaintainers(
        repo,
        commits,
        prs
      );

      expect(maintainers.length).toBe(2);
      const reviewer1 = maintainers.find(
        (m) => m.email === 'reviewer1@example.com'
      );
      const reviewer2 = maintainers.find(
        (m) => m.email === 'reviewer2@example.com'
      );
      expect(reviewer1).toBeDefined();
      expect(reviewer2).toBeDefined();
    });

    it('should identify top contributors when no maintainers found', async () => {
      const repo: Repository = {
        id: 'repo-3',
        url: 'https://github.com/test/repo3',
        name: 'test-repo3',
        localPath: '/tmp/test-repo3',
        lastSync: new Date(),
        createdAt: new Date(),
        maintainers: [],
      };

      const commits: Commit[] = [
        {
          sha: '1',
          author: 'Top Contributor',
          authorEmail: 'top@example.com',
          timestamp: new Date(),
          filesChanged: 1,
          insertions: 10,
          deletions: 5,
          message: 'Commit 1',
        },
        {
          sha: '2',
          author: 'Top Contributor',
          authorEmail: 'top@example.com',
          timestamp: new Date(),
          filesChanged: 1,
          insertions: 10,
          deletions: 5,
          message: 'Commit 2',
        },
        {
          sha: '3',
          author: 'Top Contributor',
          authorEmail: 'top@example.com',
          timestamp: new Date(),
          filesChanged: 1,
          insertions: 10,
          deletions: 5,
          message: 'Commit 3',
        },
      ];

      const prs: any[] = [];

      const maintainers = await extractor.identifyMaintainers(
        repo,
        commits,
        prs
      );

      expect(maintainers.length).toBeGreaterThan(0);
      const topContributor = maintainers.find(
        (m) => m.email === 'top@example.com'
      );
      expect(topContributor).toBeDefined();
    });
  });
});

