import { RepositoryParser } from './RepositoryParser.js';
import { GitHubClient } from './GitHubClient.js';
import { GitLabClient } from './GitLabClient.js';
import { Repository, PRRecord, IssueRecord, Credentials } from '../types/models.js';

export interface IngestionOrchestratorConfig {
  workingDirectory: string;
  githubToken?: string;
  gitlabToken?: string;
}

export interface SyncResult {
  repository: Repository;
  newCommits: number;
  newPRs: number;
  newIssues: number;
  syncedAt: Date;
}

/**
 * Orchestrates the ingestion of repository data from Git and platform APIs
 * Implements incremental update mechanism to avoid re-processing entire history
 * Requirements: 1.5
 */
export class IngestionOrchestrator {
  private repositoryParser: RepositoryParser;
  private githubClient: GitHubClient;
  private gitlabClient: GitLabClient;
  private repositoryStore: Map<string, Repository>; // In-memory store for demo

  constructor(config: IngestionOrchestratorConfig) {
    this.repositoryParser = new RepositoryParser({
      workingDirectory: config.workingDirectory,
    });
    this.githubClient = new GitHubClient({ token: config.githubToken });
    this.gitlabClient = new GitLabClient({ token: config.gitlabToken });
    this.repositoryStore = new Map();
  }

  /**
   * Add a new repository and perform initial sync
   * @param url Repository URL
   * @param credentials Optional credentials for authentication
   * @returns Sync result with repository metadata
   */
  async addRepository(
    url: string,
    credentials?: Credentials
  ): Promise<SyncResult> {
    // Clone the repository
    const repository = await this.repositoryParser.cloneRepository(url, credentials);

    // Store repository metadata
    this.repositoryStore.set(repository.id, repository);

    // Perform initial sync (no 'since' date, get all data)
    return this.syncRepository(repository.id);
  }

  /**
   * Sync an existing repository with incremental updates
   * Only fetches data created after the last sync timestamp
   * @param repositoryId Repository ID
   * @returns Sync result with counts of new items
   */
  async syncRepository(repositoryId: string): Promise<SyncResult> {
    const repository = this.repositoryStore.get(repositoryId);
    if (!repository) {
      throw new Error(`Repository not found: ${repositoryId}`);
    }

    // Use last sync timestamp for incremental updates
    const since = repository.lastSync;

    // Update Git repository (pull latest changes)
    const updatedRepo = await this.repositoryParser.updateRepository(repository);

    // Get new commits since last sync
    const commits = await this.repositoryParser.getCommits(updatedRepo, since);

    // Get PRs and issues from platform APIs
    let prs: PRRecord[] = [];
    let issues: IssueRecord[] = [];

    // Detect platform and fetch data accordingly
    if (this.isGitHubUrl(repository.url)) {
      const parsed = GitHubClient.parseGitHubUrl(repository.url);
      if (parsed) {
        prs = await this.githubClient.getPullRequests(
          parsed.owner,
          parsed.repo,
          since
        );
        issues = await this.githubClient.getIssues(
          parsed.owner,
          parsed.repo,
          since
        );
      }
    } else if (this.isGitLabUrl(repository.url)) {
      const projectId = GitLabClient.parseGitLabUrl(repository.url);
      if (projectId) {
        prs = await this.gitlabClient.getPullRequests(projectId, since);
        issues = await this.gitlabClient.getIssues(projectId, since);
      }
    }

    // Update last sync timestamp
    updatedRepo.lastSync = new Date();
    this.repositoryStore.set(repositoryId, updatedRepo);

    return {
      repository: updatedRepo,
      newCommits: commits.length,
      newPRs: prs.length,
      newIssues: issues.length,
      syncedAt: updatedRepo.lastSync,
    };
  }

  /**
   * Get all commits, PRs, and issues for a repository
   * Used for initial data extraction or full re-sync
   * @param repositoryId Repository ID
   * @param since Optional date to filter data
   * @returns Complete dataset
   */
  async getRepositoryData(
    repositoryId: string,
    since?: Date
  ): Promise<{
    commits: any[];
    prs: PRRecord[];
    issues: IssueRecord[];
  }> {
    const repository = this.repositoryStore.get(repositoryId);
    if (!repository) {
      throw new Error(`Repository not found: ${repositoryId}`);
    }

    // Get commits
    const commits = await this.repositoryParser.getCommits(repository, since);

    // Get PRs and issues
    let prs: PRRecord[] = [];
    let issues: IssueRecord[] = [];

    if (this.isGitHubUrl(repository.url)) {
      const parsed = GitHubClient.parseGitHubUrl(repository.url);
      if (parsed) {
        prs = await this.githubClient.getPullRequests(
          parsed.owner,
          parsed.repo,
          since
        );
        issues = await this.githubClient.getIssues(
          parsed.owner,
          parsed.repo,
          since
        );
      }
    } else if (this.isGitLabUrl(repository.url)) {
      const projectId = GitLabClient.parseGitLabUrl(repository.url);
      if (projectId) {
        prs = await this.gitlabClient.getPullRequests(projectId, since);
        issues = await this.gitlabClient.getIssues(projectId, since);
      }
    }

    return { commits, prs, issues };
  }

  /**
   * Get repository metadata by ID
   */
  getRepository(repositoryId: string): Repository | undefined {
    return this.repositoryStore.get(repositoryId);
  }

  /**
   * List all tracked repositories
   */
  listRepositories(): Repository[] {
    return Array.from(this.repositoryStore.values());
  }

  /**
   * Check if URL is a GitHub repository
   */
  private isGitHubUrl(url: string): boolean {
    return url.includes('github.com');
  }

  /**
   * Check if URL is a GitLab repository
   */
  private isGitLabUrl(url: string): boolean {
    return url.includes('gitlab.com');
  }
}
