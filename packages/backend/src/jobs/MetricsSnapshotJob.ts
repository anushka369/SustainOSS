import { Job } from 'bull';
import { Pool } from 'pg';
import { RepositoryStore } from '../storage/RepositoryStore.js';
import { MetricsCalculator } from '../analytics/MetricsCalculator.js';
import { SustainabilityScorer } from '../analytics/SustainabilityScorer.js';
import { TrendAnalyzer } from '../analytics/TrendAnalyzer.js';

/**
 * Metrics snapshot job
 * Captures weekly snapshots of all metrics for trend analysis
 * Requirements: 6.1
 */

export interface MetricsSnapshotJobData {
  repositoryId: string;
  timestamp?: Date;
}

export interface MetricsSnapshotJobResult {
  repositoryId: string;
  timestamp: Date;
  metricsCount: number;
  success: boolean;
  error?: string;
}

export class MetricsSnapshotJob {
  private metricsCalculator: MetricsCalculator;
  private sustainabilityScorer: SustainabilityScorer;
  private trendAnalyzer: TrendAnalyzer;
  private repositoryStore: RepositoryStore;

  constructor(pool: Pool) {
    this.metricsCalculator = new MetricsCalculator(pool);
    this.sustainabilityScorer = new SustainabilityScorer(pool);
    this.trendAnalyzer = new TrendAnalyzer(pool);
    this.repositoryStore = new RepositoryStore(pool);
  }

  /**
   * Process a metrics snapshot job
   */
  async process(job: Job<MetricsSnapshotJobData>): Promise<MetricsSnapshotJobResult> {
    const { repositoryId, timestamp = new Date() } = job.data;

    console.log(`[MetricsSnapshotJob] Creating snapshot for repository ${repositoryId}`);

    try {
      // Get repository
      const repository = await this.repositoryStore.findById(repositoryId);
      if (!repository) {
        throw new Error(`Repository not found: ${repositoryId}`);
      }

      // Calculate time period (last 90 days)
      const endDate = timestamp;
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 90);

      // Calculate all metrics
      const metrics: Record<string, number> = {};

      // Load metrics
      const prReviews = await this.metricsCalculator.calculatePRReviewsPerMaintainer(
        repositoryId,
        { start: startDate, end: endDate }
      );
      const openIssues = await this.metricsCalculator.calculateOpenIssuesPerMaintainer(
        repositoryId
      );
      const turnaroundTimes = await this.metricsCalculator.calculateAvgReviewTurnaround(
        repositoryId,
        { start: startDate, end: endDate }
      );

      // Aggregate load metrics
      const totalPRReviews = Object.values(prReviews).reduce((sum: number, val: number) => sum + val, 0);
      const totalOpenIssues = Object.values(openIssues).reduce((sum: number, val: number) => sum + val, 0);
      const avgTurnaround =
        Object.values(turnaroundTimes).reduce((sum: number, val: number) => sum + val, 0) /
        Math.max(Object.keys(turnaroundTimes).length, 1);

      metrics['total_pr_reviews'] = totalPRReviews;
      metrics['total_open_issues'] = totalOpenIssues;
      metrics['avg_review_turnaround'] = avgTurnaround;

      // Contribution concentration
      const concentration = await this.metricsCalculator.calculateContributionConcentration(
        repositoryId,
        { start: startDate, end: endDate }
      );
      metrics['contribution_concentration'] = concentration;

      // Diversity and retention
      const diversity = await this.metricsCalculator.calculateContributorDiversity(
        repositoryId,
        { start: startDate, end: endDate }
      );
      const retention = await this.metricsCalculator.calculateRetentionRatio(
        repositoryId,
        { start: startDate, end: endDate }
      );

      metrics['contributor_diversity'] = diversity;
      metrics['retention_ratio'] = retention;

      // Sustainability score
      const sustainabilityScore = await this.sustainabilityScorer.calculateSustainabilityIndex(
        repositoryId,
        { start: startDate, end: endDate }
      );

      metrics['sustainability_score'] = sustainabilityScore.overall_score;
      metrics['diversity_score'] = sustainabilityScore.contributor_diversity_score;
      metrics['load_distribution_score'] = sustainabilityScore.load_distribution_score;
      metrics['response_time_score'] = sustainabilityScore.response_time_score;
      metrics['retention_score'] = sustainabilityScore.retention_score;

      // Store snapshot
      await this.trendAnalyzer.store_snapshot(repositoryId, metrics, timestamp);

      console.log(
        `[MetricsSnapshotJob] Completed snapshot for repository ${repositoryId}: ` +
          `${Object.keys(metrics).length} metrics stored`
      );

      return {
        repositoryId,
        timestamp,
        metricsCount: Object.keys(metrics).length,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `[MetricsSnapshotJob] Failed to create snapshot for repository ${repositoryId}:`,
        error
      );

      return {
        repositoryId,
        timestamp: timestamp || new Date(),
        metricsCount: 0,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Schedule snapshot for a specific repository
   */
  static async scheduleSnapshot(
    repositoryId: string,
    timestamp?: Date,
    delay: number = 0
  ): Promise<Job<MetricsSnapshotJobData>> {
    const { getJobQueue } = await import('./JobQueue.js');
    const jobQueue = getJobQueue();

    return jobQueue.addJob(
      'metrics-snapshot',
      'snapshot',
      { repositoryId, timestamp },
      { delay }
    );
  }

  /**
   * Schedule recurring weekly snapshots for a repository
   * Default: every Sunday at 2 AM
   */
  static async scheduleWeeklySnapshot(
    repositoryId: string,
    cronExpression: string = '0 2 * * 0'
  ): Promise<Job<MetricsSnapshotJobData>> {
    const { getJobQueue } = await import('./JobQueue.js');
    const jobQueue = getJobQueue();

    return jobQueue.scheduleRepeatingJob(
      'metrics-snapshot',
      'snapshot',
      { repositoryId },
      cronExpression
    );
  }
}
