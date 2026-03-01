import { Gitlab } from '@gitbeaker/rest';
import { PRRecord, IssueRecord } from '../types/models.js';
import { PRStatus, IssueStatus } from '../types/enums.js';
import { NetworkMonitor } from '../security/index.js';

export interface GitLabClientConfig {
  token?: string;
  host?: string;
}

export interface RateLimitInfo {
  remaining: number;
  reset: Date;
  limit: number;
}

export class GitLabClient {
  private gitlab: InstanceType<typeof Gitlab>;
  private maxRetries: number = 3;
  private baseDelay: number = 1000; // 1 second
  private host: string;

  constructor(config: GitLabClientConfig = {}) {
    this.host = config.host || 'https://gitlab.com';
    
    // Log network request for monitoring
    NetworkMonitor.logRequest(this.host, 'INIT');
    
    this.gitlab = new Gitlab({
      token: config.token,
      host: this.host,
    });
  }

  /**
   * Get merge requests (PRs) from a GitLab project
   * @param projectId Project ID or path (e.g., "owner/repo")
   * @param since Optional date to filter MRs created after this date
   * @returns Array of PR records
   */
  async getPullRequests(
    projectId: string,
    since?: Date
  ): Promise<PRRecord[]> {
    // Log network request
    NetworkMonitor.logRequest(`${this.host}/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests`, 'GET');
    
    return this.withRateLimitHandling(async () => {
      const prs: PRRecord[] = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        const mrs = await this.gitlab.MergeRequests.all({
          projectId,
          orderBy: 'created_at',
          sort: 'desc',
          perPage,
          page,
        });

        if (!Array.isArray(mrs) || mrs.length === 0) {
          break;
        }

        for (const mr of mrs) {
          const createdAt = new Date(mr.created_at);

          // Stop if we've reached MRs older than 'since'
          if (since && createdAt < since) {
            return prs;
          }

          // Get reviewers from approvals
          let reviewers: string[] = [];
          try {
            const approvals = await this.gitlab.MergeRequestApprovals.configuration(
              projectId,
              mr.iid
            );
            reviewers = (approvals as any).approved_by?.map((a: any) => a.user.username) || [];
          } catch (error) {
            // Approvals might not be available in all GitLab tiers
            reviewers = [];
          }

          // Get review comments count
          const discussions = await this.gitlab.MergeRequestDiscussions.all(
            projectId,
            mr.iid
          );
          const reviewComments = Array.isArray(discussions) ? discussions.length : 0;

          // Determine status
          let status: PRStatus;
          if (mr.merged_at) {
            status = PRStatus.MERGED;
          } else if (mr.closed_at) {
            status = PRStatus.CLOSED;
          } else {
            status = PRStatus.OPEN;
          }

          prs.push({
            id: `gitlab-${projectId}-${mr.iid}`,
            author: mr.author?.username || 'unknown',
            reviewers,
            created_at: createdAt,
            merged_at: mr.merged_at ? new Date(mr.merged_at) : null,
            closed_at: mr.closed_at ? new Date(mr.closed_at) : null,
            review_comments: reviewComments,
            files_changed: mr.changes_count ? parseInt(mr.changes_count) : 0,
            status,
          });
        }

        // Check if there are more pages
        if (mrs.length < perPage) {
          break;
        }

        page++;
      }

      return prs;
    });
  }

  /**
   * Get issues from a GitLab project
   * @param projectId Project ID or path (e.g., "owner/repo")
   * @param since Optional date to filter issues created after this date
   * @returns Array of issue records
   */
  async getIssues(
    projectId: string,
    since?: Date
  ): Promise<IssueRecord[]> {
    // Log network request
    NetworkMonitor.logRequest(`${this.host}/api/v4/projects/${encodeURIComponent(projectId)}/issues`, 'GET');
    
    return this.withRateLimitHandling(async () => {
      const issues: IssueRecord[] = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        const gitlabIssues = await this.gitlab.Issues.all({
          projectId,
          state: 'all',
          orderBy: 'created_at',
          sort: 'desc',
          perPage,
          page,
        });

        if (!Array.isArray(gitlabIssues) || gitlabIssues.length === 0) {
          break;
        }

        for (const issue of gitlabIssues) {
          const createdAt = new Date(issue.created_at);

          // Stop if we've reached issues older than 'since'
          if (since && createdAt < since) {
            return issues;
          }

          // Get first response time from notes
          let firstResponseAt: Date | null = null;
          if (issue.user_notes_count > 0) {
            const notes = await this.gitlab.IssueNotes.all(projectId, issue.iid, {
              perPage: 1,
              page: 1,
              orderBy: 'created_at',
              sort: 'asc',
            });

            if (Array.isArray(notes) && notes.length > 0) {
              firstResponseAt = new Date(notes[0].created_at);
            }
          }

          issues.push({
            id: `gitlab-${projectId}-${issue.iid}`,
            author: issue.author?.username || 'unknown',
            assignees: issue.assignees?.map((a) => a.username) || [],
            labels: issue.labels || [],
            created_at: createdAt,
            closed_at: issue.closed_at ? new Date(issue.closed_at) : null,
            first_response_at: firstResponseAt,
            comment_count: issue.user_notes_count || 0,
            status: issue.state === 'opened' ? IssueStatus.OPEN : IssueStatus.CLOSED,
            title: issue.title,
            description: issue.description || '',
          });
        }

        // Check if there are more pages
        if (gitlabIssues.length < perPage) {
          break;
        }

        page++;
      }

      return issues;
    });
  }

  /**
   * Parse GitLab repository URL to extract project path
   */
  static parseGitLabUrl(url: string): string | null {
    // Match patterns like:
    // https://gitlab.com/owner/repo
    // https://gitlab.com/owner/repo.git
    // git@gitlab.com:owner/repo.git
    const httpsMatch = url.match(/gitlab\.com\/([^\/]+\/[^\/\.]+)/);
    if (httpsMatch) {
      return httpsMatch[1];
    }

    const sshMatch = url.match(/gitlab\.com:([^\/]+\/[^\/\.]+)/);
    if (sshMatch) {
      return sshMatch[1];
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

        // Check if it's a rate limit error (429)
        if (error.response?.status === 429) {
          const retryAfter = error.response?.headers['retry-after'];
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : this.baseDelay * Math.pow(2, attempt);

          if (waitTime < 3600000) {
            // Wait up to 1 hour
            console.warn(`Rate limit exceeded. Waiting ${waitTime}ms...`);
            await this.sleep(waitTime);
            continue;
          }
        }

        // Check if it's a retryable error (5xx, network errors)
        if (
          error.response?.status >= 500 ||
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
