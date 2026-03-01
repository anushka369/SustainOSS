import { Pool } from 'pg';
import { getJobQueue, closeJobQueue } from './JobQueue.js';
import { RepositorySyncJob } from './RepositorySyncJob.js';
import { MetricsSnapshotJob } from './MetricsSnapshotJob.js';
import { IngestionOrchestrator } from '../ingestion/IngestionOrchestrator.js';

/**
 * Job scheduler that coordinates all background jobs
 * Requirements: 1.5, 6.1
 */
export class JobScheduler {
  private repositorySyncJob: RepositorySyncJob;
  private metricsSnapshotJob: MetricsSnapshotJob;
  private isStarted: boolean = false;

  constructor(
    pool: Pool,
    ingestionOrchestrator: IngestionOrchestrator
  ) {
    this.repositorySyncJob = new RepositorySyncJob(ingestionOrchestrator);
    this.metricsSnapshotJob = new MetricsSnapshotJob(pool);
  }

  /**
   * Start processing jobs
   */
  start(): void {
    if (this.isStarted) {
      console.warn('[JobScheduler] Already started');
      return;
    }

    const jobQueue = getJobQueue();

    // Process repository sync jobs
    jobQueue.processJobs(
      'repository-sync',
      'sync',
      async (job) => {
        return this.repositorySyncJob.process(job);
      },
      2 // Process up to 2 sync jobs concurrently
    );

    // Process metrics snapshot jobs
    jobQueue.processJobs(
      'metrics-snapshot',
      'snapshot',
      async (job) => {
        return this.metricsSnapshotJob.process(job);
      },
      1 // Process snapshots one at a time
    );

    this.isStarted = true;
    console.log('[JobScheduler] Started processing jobs');
  }

  /**
   * Stop processing jobs and close connections
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    await closeJobQueue();
    this.isStarted = false;
    console.log('[JobScheduler] Stopped processing jobs');
  }

  /**
   * Schedule repository sync
   */
  async scheduleRepositorySync(
    repositoryId: string,
    delay: number = 0
  ): Promise<void> {
    await RepositorySyncJob.scheduleSync(repositoryId, delay);
    console.log(`[JobScheduler] Scheduled sync for repository ${repositoryId}`);
  }

  /**
   * Schedule recurring repository sync
   */
  async scheduleRecurringRepositorySync(
    repositoryId: string,
    cronExpression: string = '0 */6 * * *'
  ): Promise<void> {
    await RepositorySyncJob.scheduleRecurringSync(repositoryId, cronExpression);
    console.log(
      `[JobScheduler] Scheduled recurring sync for repository ${repositoryId} (${cronExpression})`
    );
  }

  /**
   * Schedule metrics snapshot
   */
  async scheduleMetricsSnapshot(
    repositoryId: string,
    timestamp?: Date,
    delay: number = 0
  ): Promise<void> {
    await MetricsSnapshotJob.scheduleSnapshot(repositoryId, timestamp, delay);
    console.log(`[JobScheduler] Scheduled snapshot for repository ${repositoryId}`);
  }

  /**
   * Schedule recurring weekly metrics snapshot
   */
  async scheduleWeeklyMetricsSnapshot(
    repositoryId: string,
    cronExpression: string = '0 2 * * 0'
  ): Promise<void> {
    await MetricsSnapshotJob.scheduleWeeklySnapshot(repositoryId, cronExpression);
    console.log(
      `[JobScheduler] Scheduled weekly snapshot for repository ${repositoryId} (${cronExpression})`
    );
  }

  /**
   * Get job queue statistics
   */
  async getQueueStats(): Promise<{
    repositorySync: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    };
    metricsSnapshot: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    };
  }> {
    const jobQueue = getJobQueue();

    const [repositorySync, metricsSnapshot] = await Promise.all([
      jobQueue.getJobCounts('repository-sync'),
      jobQueue.getJobCounts('metrics-snapshot'),
    ]);

    return {
      repositorySync,
      metricsSnapshot,
    };
  }
}
