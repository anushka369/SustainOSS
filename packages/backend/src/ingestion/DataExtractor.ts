import {
  Commit,
  CommitRecord,
  PRRecord,
  IssueRecord,
  Maintainer,
  Repository,
} from '../types/models.js';
import { MaintainerRole } from '../types/enums.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Raw Pull Request data from Git platform APIs
 */
export interface RawPullRequest {
  id: string;
  author: string;
  reviewers: string[];
  created_at: Date;
  merged_at: Date | null;
  closed_at: Date | null;
  review_comments: number;
  files_changed: number;
  status: 'open' | 'merged' | 'closed';
}

/**
 * Raw Issue data from Git platform APIs
 */
export interface RawIssue {
  id: string;
  author: string;
  assignees: string[];
  labels: string[];
  created_at: Date;
  closed_at: Date | null;
  first_response_at: Date | null;
  comment_count: number;
  status: 'open' | 'closed';
  title: string;
  description: string;
}

/**
 * DataExtractor transforms raw Git data into structured records for storage
 * Requirements: 1.2, 1.3, 1.4
 */
export class DataExtractor {
  /**
   * Extract commit data from a Git commit object
   * Requirements: 1.2
   */
  extractCommitData(commit: Commit): CommitRecord {
    return {
      sha: commit.sha,
      author: commit.author,
      author_email: commit.authorEmail,
      timestamp: commit.timestamp,
      files_changed: commit.filesChanged,
      insertions: commit.insertions,
      deletions: commit.deletions,
      message: commit.message,
    };
  }

  /**
   * Extract PR data from raw pull request object
   * Requirements: 1.3
   */
  extractPRData(pr: RawPullRequest): PRRecord {
    return {
      id: pr.id,
      author: pr.author,
      reviewers: pr.reviewers,
      created_at: pr.created_at,
      merged_at: pr.merged_at,
      closed_at: pr.closed_at,
      review_comments: pr.review_comments,
      files_changed: pr.files_changed,
      status: pr.status as any,
    };
  }

  /**
   * Extract issue data from raw issue object
   * Requirements: 1.4
   */
  extractIssueData(issue: RawIssue): IssueRecord {
    return {
      id: issue.id,
      author: issue.author,
      assignees: issue.assignees,
      labels: issue.labels,
      created_at: issue.created_at,
      closed_at: issue.closed_at,
      first_response_at: issue.first_response_at,
      comment_count: issue.comment_count,
      status: issue.status as any,
      title: issue.title,
      description: issue.description,
    };
  }

  /**
   * Identify maintainers from repository data
   * Requirements: 1.2
   * 
   * Strategy:
   * 1. Parse CODEOWNERS file if present
   * 2. Identify users with merge commits
   * 3. Identify users who review PRs
   */
  async identifyMaintainers(
    repo: Repository,
    commits: Commit[],
    prs: PRRecord[]
  ): Promise<Maintainer[]> {
    const maintainerMap = new Map<string, Maintainer>();

    // 1. Parse CODEOWNERS file
    const codeownersPath = path.join(repo.localPath, 'CODEOWNERS');
    try {
      const codeownersContent = await fs.readFile(codeownersPath, 'utf-8');
      const owners = this.parseCodeowners(codeownersContent);
      owners.forEach((owner) => {
        maintainerMap.set(owner.email, {
          ...owner,
          role: MaintainerRole.OWNER,
        });
      });
    } catch (error) {
      // CODEOWNERS file doesn't exist, continue with other methods
    }

    // 2. Identify users with merge commits
    const mergeCommits = commits.filter((commit) =>
      commit.message.toLowerCase().includes('merge')
    );
    mergeCommits.forEach((commit) => {
      if (!maintainerMap.has(commit.authorEmail)) {
        maintainerMap.set(commit.authorEmail, {
          name: commit.author,
          email: commit.authorEmail,
          role: MaintainerRole.MAINTAINER,
        });
      }
    });

    // 3. Identify users who review PRs
    const reviewers = new Set<string>();
    prs.forEach((pr) => {
      pr.reviewers.forEach((reviewer) => reviewers.add(reviewer));
    });

    reviewers.forEach((reviewer) => {
      // Extract email from reviewer string (format: "name <email>" or just "email")
      const emailMatch = reviewer.match(/<(.+)>/) || [null, reviewer];
      const email = emailMatch[1] || reviewer;
      const name = reviewer.replace(/<.+>/, '').trim() || email;

      if (!maintainerMap.has(email)) {
        maintainerMap.set(email, {
          name,
          email,
          role: MaintainerRole.MAINTAINER,
        });
      }
    });

    // If no maintainers found, identify top contributors
    if (maintainerMap.size === 0) {
      const contributorCounts = new Map<string, number>();
      commits.forEach((commit) => {
        const count = contributorCounts.get(commit.authorEmail) || 0;
        contributorCounts.set(commit.authorEmail, count + 1);
      });

      // Get top 3 contributors
      const topContributors = Array.from(contributorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      topContributors.forEach(([email]) => {
        const commit = commits.find((c) => c.authorEmail === email);
        if (commit) {
          maintainerMap.set(email, {
            name: commit.author,
            email,
            role: MaintainerRole.CONTRIBUTOR,
          });
        }
      });
    }

    return Array.from(maintainerMap.values());
  }

  /**
   * Parse CODEOWNERS file to extract owner information
   */
  private parseCodeowners(content: string): Maintainer[] {
    const owners: Maintainer[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      // Skip comments and empty lines
      if (line.trim().startsWith('#') || line.trim() === '') {
        continue;
      }

      // CODEOWNERS format: pattern @username or pattern email
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) {
        continue;
      }

      // Extract owners (everything after the pattern)
      const ownerParts = parts.slice(1);
      ownerParts.forEach((owner) => {
        if (owner.startsWith('@')) {
          // GitHub username format
          const username = owner.substring(1);
          owners.push({
            name: username,
            email: `${username}@users.noreply.github.com`,
            role: MaintainerRole.OWNER,
          });
        } else if (owner.includes('@')) {
          // Email format
          owners.push({
            name: owner.split('@')[0],
            email: owner,
            role: MaintainerRole.OWNER,
          });
        }
      });
    }

    return owners;
  }
}
