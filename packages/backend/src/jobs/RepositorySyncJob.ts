import { Job } from 'bull';
import { IngestionOrchestrator } from '../ingestion/IngestionOrchestrator.js';

/**
 * Repository sync job
 * Syncs repository data incrementally
 * Requirements: 1.5
 */

export interface RepositorySyncJobData {
  repositoryId: string;
}

export interface RepositorySyncJobResult {
  repositoryId: string;
  newCommits: number;
  newPRs: number;
  newIssues: number;
  syncedAt: Date;
  success: boolean;
  error?: string;
}

export class RepositorySyncJob {
  constructor(private ingestionOrchestrator: IngestionOrchestrator) {}

  /**
   * Process a repository sync job
   */
  async process(job: Job<RepositorySyncJobData>): Promise<RepositorySyncJobResult> {
    const { repositoryId } = job.data;

    console.log(`[RepositorySyncJob] Starting sync for repository ${repositoryId}`);

    try {
      // Sync the repository
      const result = await this.ingestionOrchestrator.syncRepository(repositoryId);

      console.log(
        `[RepositorySyncJob] Completed sync for repository ${repositoryId}: ` +
          `${result.newCommits} commits, ${result.newPRs} PRs, ${result.newIssues} issues`
      );

      return {
        repositoryId,
        newCommits: result.newCommits,
        newPRs: result.newPRs,
        newIssues: result.newIssues,
        syncedAt: result.syncedAt,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[RepositorySyncJob] Failed to sync repository ${repositoryId}:`, error);

      return {
        repositoryId,
        newCommits: 0,
        newPRs: 0,
        newIssues: 0,
        syncedAt: new Date(),
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Schedule sync for a specific repository
   */
  static async scheduleSync(
    repositoryId: string,
    delay: number = 0
  ): Promise<Job<RepositorySyncJobData>> {
    const { getJobQueue } = await import('./JobQueue.js');
    const jobQueue = getJobQueue();

    return jobQueue.addJob(
      'repository-sync',
      'sync',
      { repositoryId },
      { delay }
    );
  }

  /**
   * Schedule recurring sync for a repository
   * Default: sync every 6 hours
   */
  static async scheduleRecurringSync(
    repositoryId: string,
    cronExpression: string = '0 */6 * * *'
  ): Promise<Job<RepositorySyncJobData>> {
    const { getJobQueue } = await import('./JobQueue.js');
    const jobQueue = getJobQueue();

    return jobQueue.scheduleRepeatingJob(
      'repository-sync',
      'sync',
      { repositoryId },
      cronExpression
    );
  }
}
