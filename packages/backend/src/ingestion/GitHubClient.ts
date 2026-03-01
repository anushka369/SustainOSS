import { Octokit } from '@octokit/rest';
import { PRRecord, IssueRecord } from '../types/models.js';
import { PRStatus, IssueStatus } from '../types/enums.js';
import { NetworkMonitor } from '../security/index.js';

export interface GitHubClientConfig {
  token?: string;
  baseUrl?: string;
}

export interface RateLimitInfo {
  remaining: number;
  reset: Date;
  limit: number;
}

export class GitHubClient {
  private octokit: Octokit;
  private maxRetries: number = 3;
  private baseDelay: number = 1000; // 1 second
  private baseUrl: string;

  constructor(config: GitHubClientConfig = {}) {
    this.baseUrl = config.baseUrl || 'https://api.github.com';
    
    // Log network request for monitoring
    NetworkMonitor.logRequest(this.baseUrl, 'INIT');
    
    this.octokit = new Octokit({
      auth: config.token,
      baseUrl: this.baseUrl,
    });
  }

  /**
   * Get pull requests from a GitHub repository
   * @param owner Repository owner
   * @param repo Repository name
   * @param since Optional date to filter PRs created after this date
   * @returns Array of PR records
   */
  async getPullRequests(
    owner: string,
    repo: string,
    since?: Date
  ): Promise<PRRecord[]> {
    // Log network request
    NetworkMonitor.logRequest(`${this.baseUrl}/repos/${owner}/${repo}/pulls`, 'GET');
    
    return this.withRateLimitHandling(async () => {
      const prs: PRRecord[] = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        const response = await this.octokit.pulls.list({
          owner,
          repo,
          state: 'all',
          sort: 'created',
          direction: 'desc',
          per_page: perPage,
          page,
        });

        if (response.data.length === 0) {
          break;
        }

        for (const pr of response.data) {
          const createdAt = new Date(pr.created_at);

          // Stop if we've reached PRs older than 'since'
          if (since && createdAt < since) {
            return prs;
          }

          // Get review comments count
          const reviews = await this.octokit.pulls.listReviews({
            owner,
            repo,
            pull_number: pr.number,
          });

          // Get reviewers from reviews
          const reviewers = Array.from(
            new Set(
              reviews.data
                .map((review) => review.user?.login)
                .filter((login): login is string => !!login)
            )
          );

          // Determine status
          let status: PRStatus;
          if (pr.merged_at) {
            status = PRStatus.MERGED;
          } else if (pr.closed_at) {
            status = PRStatus.CLOSED;
          } else {
            status = PRStatus.OPEN;
          }

          prs.push({
            id: `github-${owner}-${repo}-${pr.number}`,
            author: pr.user?.login || 'unknown',
            reviewers,
            created_at: createdAt,
            merged_at: pr.merged_at ? new Date(pr.merged_at) : null,
            closed_at: pr.closed_at ? new Date(pr.closed_at) : null,
            review_comments: reviews.data.length,
            files_changed: (pr as any).changed_files || 0,
            status,
          });
        }

        // Check if there are more pages
        if (response.data.length < perPage) {
          break;
        }

        page++;
      }

      return prs;
    });
  }

  /**
   * Get issues from a GitHub repository
   * @param owner Repository owner
   * @param repo Repository name
   * @param since Optional date to filter issues created after this date
   * @returns Array of issue records
   */
  async getIssues(
    owner: string,
    repo: string,
    since?: Date
  ): Promise<IssueRecord[]> {
    // Log network request
    NetworkMonitor.logRequest(`${this.baseUrl}/repos/${owner}/${repo}/issues`, 'GET');
    
    return this.withRateLimitHandling(async () => {
      const issues: IssueRecord[] = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        const response = await this.octokit.issues.listForRepo({
          owner,
          repo,
          state: 'all',
          sort: 'created',
          direction: 'desc',
          per_page: perPage,
          page,
        });

        if (response.data.length === 0) {
          break;
        }

        for (const issue of response.data) {
          // Skip pull requests (GitHub API returns PRs as issues)
          if (issue.pull_request) {
            continue;
          }

          const createdAt = new Date(issue.created_at);

          // Stop if we've reached issues older than 'since'
          if (since && createdAt < since) {
            return issues;
          }

          // Get comments to find first response
          let firstResponseAt: Date | null = null;
          if (issue.comments > 0) {
            const comments = await this.octokit.issues.listComments({
              owner,
              repo,
              issue_number: issue.number,
              per_page: 1,
              page: 1,
            });

            if (comments.data.length > 0) {
              firstResponseAt = new Date(comments.data[0].created_at);
            }
          }

          issues.push({
            id: `github-${owner}-${repo}-${issue.number}`,
            author: issue.user?.login || 'unknown',
            assignees: issue.assignees?.map((a) => a.login) || [],
            labels: issue.labels.map((l) => (typeof l === 'string' ? l : l.name || '')),
            created_at: createdAt,
            closed_at: issue.closed_at ? new Date(issue.closed_at) : null,
            first_response_at: firstResponseAt,
            comment_count: issue.comments,
            status: issue.state === 'open' ? IssueStatus.OPEN : IssueStatus.CLOSED,
            title: issue.title,
            description: issue.body || '',
          });
        }

        // Check if there are more pages
        if (response.data.length < perPage) {
          break;
        }

        page++;
      }

      return issues;
    });
  }

  /**
   * Get current rate limit information
   */
  async getRateLimit(): Promise<RateLimitInfo> {
    const response = await this.octokit.rateLimit.get();
    const core = response.data.resources.core;

    return {
      remaining: core.remaining,
      reset: new Date(core.reset * 1000),
      limit: core.limit,
    };
  }

  /**
   * Parse GitHub repository URL to extract owner and repo name
   */
  static parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    // Match patterns like:
    // https://github.com/owner/repo
    // https://github.com/owner/repo.git
    // git@github.com:owner/repo.git
    const httpsMatch = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
    if (httpsMatch) {
      return {
        owner: httpsMatch[1],
        repo: httpsMatch[2],
      };
    }

    const sshMatch = url.match(/github\.com:([^\/]+)\/([^\/\.]+)/);
    if (sshMatch) {
      return {
        owner: sshMatch[1],
        repo: sshMatch[2],
      };
    }

    return null;
  }

  /**
   * Wrapper to handle rate limiting with exponential backoff
   */
  private async withRateLimitHandling<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Check if it's a rate limit error
        if (error.status === 403 && error.response?.headers['x-ratelimit-remaining'] === '0') {
          const resetTime = error.response?.headers['x-ratelimit-reset'];
          if (resetTime) {
            const resetDate = new Date(parseInt(resetTime) * 1000);
            const waitTime = resetDate.getTime() - Date.now();

            if (waitTime > 0 && waitTime < 3600000) {
              // Wait up to 1 hour
              console.warn(`Rate limit exceeded. Waiting ${waitTime}ms until reset...`);
              await this.sleep(waitTime);
              continue;
            }
          }
        }

        // Check if it's a retryable error (5xx, network errors)
        if (
          error.status >= 500 ||
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT'
        ) {
          const delay = this.baseDelay * Math.pow(2, attempt);
          console.warn(`Request failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${this.maxRetries})`);
          await this.sleep(delay);
          continue;
        }

        // Non-retryable error, throw immediately
        throw error;
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
