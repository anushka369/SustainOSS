import simpleGit, { SimpleGit, SimpleGitOptions, LogResult } from 'simple-git';
import { Repository, Commit, Credentials } from '../types/models.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface RepositoryParserConfig {
  workingDirectory: string;
}

export class RepositoryParser {
  private config: RepositoryParserConfig;

  constructor(config: RepositoryParserConfig) {
    this.config = config;
  }

  /**
   * Clone a Git repository to local storage
   * @param url Repository URL (HTTPS or SSH)
   * @param credentials Optional credentials for authentication
   * @returns Repository metadata
   */
  async cloneRepository(
    url: string,
    credentials?: Credentials
  ): Promise<Repository> {
    try {
      // Validate URL format
      if (!this.isValidGitUrl(url)) {
        throw new Error(`Invalid Git repository URL: ${url}`);
      }

      // Extract repository name from URL
      const repoName = this.extractRepoName(url);
      const localPath = path.join(this.config.workingDirectory, repoName);

      // Check if directory already exists
      try {
        await fs.access(localPath);
        throw new Error(`Repository directory already exists: ${localPath}`);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      // Prepare git options with authentication
      const gitOptions: Partial<SimpleGitOptions> = {
        baseDir: this.config.workingDirectory,
        binary: 'git',
        maxConcurrentProcesses: 6,
      };

      const git: SimpleGit = simpleGit(gitOptions);

      // Build clone options
      const cloneOptions: string[] = [];
      
      // Handle authentication for HTTPS URLs
      if (credentials && url.startsWith('https://')) {
        const authenticatedUrl = this.buildAuthenticatedUrl(url, credentials);
        await git.clone(authenticatedUrl, localPath, cloneOptions);
      } else {
        // For SSH or public repos
        await git.clone(url, localPath, cloneOptions);
      }

      // Get repository metadata
      const repoGit = simpleGit(localPath);
      await repoGit.getRemotes(true);

      return {
        id: this.generateRepoId(url),
        url,
        name: repoName,
        localPath,
        lastSync: new Date(),
        createdAt: new Date(),
        maintainers: [],
      };
    } catch (error: any) {
      // Provide descriptive error messages
      if (error.message.includes('not found') || error.message.includes('404')) {
        throw new Error(`Repository not found or inaccessible: ${url}`);
      }
      if (error.message.includes('authentication') || error.message.includes('401')) {
        throw new Error(`Authentication failed for repository: ${url}`);
      }
      if (error.message.includes('permission') || error.message.includes('403')) {
        throw new Error(`Permission denied for repository: ${url}`);
      }
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  /**
   * Get commits from a repository with optional date filtering
   * @param repo Repository metadata
   * @param since Optional start date for filtering commits
   * @returns Array of commits
   */
  async getCommits(repo: Repository, since?: Date): Promise<Commit[]> {
    try {
      const git: SimpleGit = simpleGit(repo.localPath);

      // Build log options
      const logOptions: any = {
        '--all': null,
        '--numstat': null,
      };

      if (since) {
        logOptions['--since'] = since.toISOString();
      }

      const log: LogResult = await git.log(logOptions);

      // Transform git log to Commit objects
      const commits: Commit[] = log.all.map((commit) => ({
        sha: commit.hash,
        author: commit.author_name,
        authorEmail: commit.author_email,
        timestamp: new Date(commit.date),
        filesChanged: 0, // Will be populated from diff stats
        insertions: 0,
        deletions: 0,
        message: commit.message,
      }));

      // Get detailed stats for each commit
      for (const commit of commits) {
        try {
          const diffSummary = await git.diffSummary([`${commit.sha}^`, commit.sha]);
          commit.filesChanged = diffSummary.files.length;
          commit.insertions = diffSummary.insertions;
          commit.deletions = diffSummary.deletions;
        } catch (error) {
          // First commit won't have a parent, skip stats
          commit.filesChanged = 0;
          commit.insertions = 0;
          commit.deletions = 0;
        }
      }

      return commits;
    } catch (error: any) {
      throw new Error(`Failed to get commits: ${error.message}`);
    }
  }

  /**
   * Update an existing repository by pulling latest changes
   * @param repo Repository metadata
   * @returns Updated repository metadata
   */
  async updateRepository(repo: Repository): Promise<Repository> {
    try {
      const git: SimpleGit = simpleGit(repo.localPath);
      
      // Fetch and pull latest changes
      await git.fetch();
      await git.pull();

      return {
        ...repo,
        lastSync: new Date(),
      };
    } catch (error: any) {
      throw new Error(`Failed to update repository: ${error.message}`);
    }
  }

  /**
   * Validate if a string is a valid Git URL
   */
  private isValidGitUrl(url: string): boolean {
    // Check for HTTPS URLs
    if (url.startsWith('https://')) {
      return /^https:\/\/.+\/.+/.test(url);
    }
    // Check for SSH URLs
    if (url.startsWith('git@')) {
      return /^git@.+:.+\/.+/.test(url);
    }
    // Check for git:// protocol
    if (url.startsWith('git://')) {
      return /^git:\/\/.+\/.+/.test(url);
    }
    return false;
  }

  /**
   * Extract repository name from URL
   */
  private extractRepoName(url: string): string {
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1];
    return lastPart.replace('.git', '');
  }

  /**
   * Generate a unique repository ID from URL
   */
  private generateRepoId(url: string): string {
    // Simple hash function for demo purposes
    // In production, use a proper UUID or database-generated ID
    return Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  /**
   * Build authenticated URL for HTTPS cloning
   */
  private buildAuthenticatedUrl(url: string, credentials: Credentials): string {
    const urlObj = new URL(url);
    if (credentials.token) {
      // For GitHub/GitLab, use token as username
      urlObj.username = credentials.token;
      urlObj.password = 'x-oauth-basic';
    } else if (credentials.username && credentials.password) {
      urlObj.username = credentials.username;
      urlObj.password = credentials.password;
    }
    return urlObj.toString();
  }
}
