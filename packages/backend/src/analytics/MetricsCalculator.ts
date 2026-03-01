import { Pool } from 'pg';
import {
  RepositoryStore,
  PullRequestStore,
  IssueStore,
  CommitStore,
} from '../storage/index.js';
import { IssueStatus } from '../types/enums.js';

/**
 * Time period for metric calculations
 */
export interface TimePeriod {
  start: Date;
  end: Date;
}

/**
 * Metrics Calculator for computing load and activity metrics
 * Requirements: 2.1, 2.2, 2.3, 2.4, 5.1, 5.4
 */
export class MetricsCalculator {
  private repositoryStore: RepositoryStore;
  private pullRequestStore: PullRequestStore;
  private issueStore: IssueStore;
  private commitStore: CommitStore;

  constructor(pool: Pool) {
    this.repositoryStore = new RepositoryStore(pool);
    this.pullRequestStore = new PullRequestStore(pool);
    this.issueStore = new IssueStore(pool);
    this.commitStore = new CommitStore(pool);
  }

  /**
   * Calculate the number of PRs reviewed per maintainer
   * Requirements: 2.1
   */
  async calculatePRReviewsPerMaintainer(
    repoId: string,
    timePeriod: TimePeriod
  ): Promise<Record<string, number>> {
    const repo = await this.repositoryStore.findById(repoId);
    if (!repo) {
      throw new Error(`Repository ${repoId} not found`);
    }

    // Initialize all maintainers with 0 reviews
    const reviewCounts: Record<string, number> = {};
    for (const maintainer of repo.maintainers) {
      reviewCounts[maintainer.email] = 0;
    }

    // Get all PRs in the time period
    const prs = await this.pullRequestStore.findByRepoId(
      repoId,
      timePeriod.start
    );

    // Count reviews per maintainer
    for (const pr of prs) {
      // Only count PRs within the time period
      if (pr.created_at > timePeriod.end) {
        continue;
      }

      // Count each reviewer (if they are a maintainer)
      for (const reviewer of pr.reviewers) {
        if (reviewer in reviewCounts) {
          reviewCounts[reviewer]++;
        }
      }
    }

    return reviewCounts;
  }

  /**
   * Calculate the number of open issues assigned to each maintainer
   * Requirements: 2.2
   */
  async calculateOpenIssuesPerMaintainer(
    repoId: string
  ): Promise<Record<string, number>> {
    const repo = await this.repositoryStore.findById(repoId);
    if (!repo) {
      throw new Error(`Repository ${repoId} not found`);
    }

    // Initialize all maintainers with 0 issues
    const issueCounts: Record<string, number> = {};
    for (const maintainer of repo.maintainers) {
      issueCounts[maintainer.email] = 0;
    }

    // Get all open issues
    const openIssues = await this.issueStore.findByStatus(
      repoId,
      IssueStatus.OPEN
    );

    // Count issues per maintainer
    for (const issue of openIssues) {
      for (const assignee of issue.assignees) {
        if (assignee in issueCounts) {
          issueCounts[assignee]++;
        }
      }
    }

    return issueCounts;
  }

  /**
   * Calculate average review turnaround time per maintainer (in hours)
   * Requirements: 2.3
   */
  async calculateAvgReviewTurnaround(
    repoId: string,
    timePeriod: TimePeriod
  ): Promise<Record<string, number>> {
    const repo = await this.repositoryStore.findById(repoId);
    if (!repo) {
      throw new Error(`Repository ${repoId} not found`);
    }

    // Initialize all maintainers with 0 turnaround time
    const turnaroundTimes: Record<string, number[]> = {};
    for (const maintainer of repo.maintainers) {
      turnaroundTimes[maintainer.email] = [];
    }

    // Get all PRs in the time period
    const prs = await this.pullRequestStore.findByRepoId(
      repoId,
      timePeriod.start
    );

    // Calculate turnaround time for each PR review
    for (const pr of prs) {
      // Only count PRs within the time period
      if (pr.created_at > timePeriod.end) {
        continue;
      }

      // For merged or closed PRs, calculate time to first review
      // We approximate first review time as the time to merge/close
      // In a real implementation, we'd track individual review timestamps
      const reviewTime =
        pr.merged_at || pr.closed_at || new Date(timePeriod.end);

      if (reviewTime > pr.created_at) {
        const turnaroundHours =
          (reviewTime.getTime() - pr.created_at.getTime()) / (1000 * 60 * 60);

        // Assign turnaround time to all reviewers
        for (const reviewer of pr.reviewers) {
          if (reviewer in turnaroundTimes) {
            turnaroundTimes[reviewer].push(turnaroundHours);
          }
        }
      }
    }

    // Calculate averages
    const avgTurnaround: Record<string, number> = {};
    for (const [maintainer, times] of Object.entries(turnaroundTimes)) {
      if (times.length > 0) {
        avgTurnaround[maintainer] =
          times.reduce((sum, time) => sum + time, 0) / times.length;
      } else {
        avgTurnaround[maintainer] = 0;
      }
    }

    return avgTurnaround;
  }

  /**
   * Calculate contribution concentration using Gini coefficient
   * Requirements: 2.4
   */
  async calculateContributionConcentration(
    repoId: string,
    timePeriod: TimePeriod
  ): Promise<number> {
    // Get all commits in the time period
    const commits = await this.commitStore.findByRepoId(
      repoId,
      timePeriod.start
    );

    // Filter commits within the time period
    const filteredCommits = commits.filter(
      (commit) =>
        commit.timestamp >= timePeriod.start &&
        commit.timestamp <= timePeriod.end
    );

    // Count commits per author
    const commitCounts: Record<string, number> = {};
    for (const commit of filteredCommits) {
      const author = commit.author_email;
      commitCounts[author] = (commitCounts[author] || 0) + 1;
    }

    // Get activity values
    const activities = Object.values(commitCounts);

    // Calculate Gini coefficient
    return this.calculateGiniCoefficient(activities);
  }

  /**
   * Calculate Gini coefficient for a distribution
   * Returns a value between 0 (perfect equality) and 1 (perfect inequality)
   */
  private calculateGiniCoefficient(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    if (values.length === 1) {
      return 0;
    }

    // Sort values in ascending order
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    if (sum === 0) {
      return 0;
    }

    // Calculate Gini coefficient using the formula:
    // G = (2 * sum(i * x_i)) / (n * sum(x_i)) - (n + 1) / n
    let numerator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (i + 1) * sorted[i];
    }

    const gini = (2 * numerator) / (n * sum) - (n + 1) / n;

    // Ensure result is between 0 and 1
    return Math.max(0, Math.min(1, gini));
  }

  /**
   * Calculate contributor diversity (unique contributors in time period)
   * Requirements: 5.1
   */
  async calculateContributorDiversity(
    repoId: string,
    timePeriod: TimePeriod
  ): Promise<number> {
    // Get all commits in the time period
    const commits = await this.commitStore.findByRepoId(
      repoId,
      timePeriod.start
    );

    // Filter commits within the time period
    const filteredCommits = commits.filter(
      (commit) =>
        commit.timestamp >= timePeriod.start &&
        commit.timestamp <= timePeriod.end
    );

    // Count unique contributors by email
    const uniqueContributors = new Set<string>();
    for (const commit of filteredCommits) {
      uniqueContributors.add(commit.author_email);
    }

    return uniqueContributors.size;
  }

  /**
   * Calculate retention ratio (percentage of contributors who return)
   * Requirements: 5.4
   */
  async calculateRetentionRatio(
    repoId: string,
    timePeriod: TimePeriod
  ): Promise<number> {
    // Get all commits in the time period
    const commits = await this.commitStore.findByRepoId(
      repoId,
      timePeriod.start
    );

    // Filter commits within the time period
    const filteredCommits = commits.filter(
      (commit) =>
        commit.timestamp >= timePeriod.start &&
        commit.timestamp <= timePeriod.end
    );

    // Count contributions per contributor
    const contributionCounts: Record<string, number> = {};
    for (const commit of filteredCommits) {
      const author = commit.author_email;
      contributionCounts[author] = (contributionCounts[author] || 0) + 1;
    }

    // Count total contributors and those with 2+ contributions
    const totalContributors = Object.keys(contributionCounts).length;
    if (totalContributors === 0) {
      return 0;
    }

    const returningContributors = Object.values(contributionCounts).filter(
      (count) => count >= 2
    ).length;

    // Return percentage
    return (returningContributors / totalContributors) * 100;
  }
}
