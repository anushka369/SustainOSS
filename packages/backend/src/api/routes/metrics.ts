import { Router, Request, Response, NextFunction } from 'express';
import {
  MetricsCalculator,
  BurnoutDetector,
  SustainabilityScorer,
  TrendAnalyzer,
  GoodFirstIssueAnalyzer,
  TimePeriod,
} from '../../analytics/index.js';
import { RepositoryStore } from '../../storage/index.js';
import { ApiError } from '../middleware/index.js';
import { documentStore } from '../../config/database.js';

const router = Router();

// Initialize analytics services
const metricsCalculator = new MetricsCalculator(documentStore);
const burnoutDetector = new BurnoutDetector(documentStore);
const sustainabilityScorer = new SustainabilityScorer(documentStore);
const trendAnalyzer = new TrendAnalyzer(documentStore);
const goodFirstIssueAnalyzer = new GoodFirstIssueAnalyzer(documentStore);
const repositoryStore = new RepositoryStore(documentStore);

/**
 * Parse time period from query parameter
 * Supports: 7d, 30d, 90d, 1y
 */
function parseTimePeriod(timePeriodStr?: string): TimePeriod {
  const end = new Date();
  let start = new Date();

  switch (timePeriodStr) {
    case '7d':
      start.setDate(end.getDate() - 7);
      break;
    case '30d':
      start.setDate(end.getDate() - 30);
      break;
    case '90d':
      start.setDate(end.getDate() - 90);
      break;
    case '1y':
      start.setFullYear(end.getFullYear() - 1);
      break;
    default:
      // Default to 30 days
      start.setDate(end.getDate() - 30);
  }

  return { start, end };
}

/**
 * GET /api/v1/repositories/:id/metrics
 * Get current metrics for a repository
 * Requirements: 8.1, 8.2
 */
router.get('/:id/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const timePeriodStr = req.query.time_period as string | undefined;

    // Check if repository exists
    const repository = await repositoryStore.findById(id);
    if (!repository) {
      throw new ApiError(404, 'Repository not found', `Repository with ID ${id} not found`);
    }

    const timePeriod = parseTimePeriod(timePeriodStr);

    // Calculate metrics
    const prReviews = await metricsCalculator.calculatePRReviewsPerMaintainer(
      id,
      timePeriod
    );
    const openIssues = await metricsCalculator.calculateOpenIssuesPerMaintainer(id);
    const avgTurnaround = await metricsCalculator.calculateAvgReviewTurnaround(
      id,
      timePeriod
    );
    const contributionConcentration =
      await metricsCalculator.calculateContributionConcentration(id, timePeriod);
    const contributorDiversity =
      await metricsCalculator.calculateContributorDiversity(id, timePeriod);
    const retentionRatio = await metricsCalculator.calculateRetentionRatio(
      id,
      timePeriod
    );

    res.json({
      repository_id: id,
      time_period: {
        start: timePeriod.start,
        end: timePeriod.end,
      },
      metrics: {
        pr_reviews_per_maintainer: prReviews,
        open_issues_per_maintainer: openIssues,
        avg_review_turnaround_hours: avgTurnaround,
        contribution_concentration: contributionConcentration,
        contributor_diversity: contributorDiversity,
        retention_ratio: retentionRatio,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/repositories/:id/burnout
 * Get burnout risk indicators
 * Requirements: 8.2
 */
router.get('/:id/burnout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Check if repository exists
    const repository = await repositoryStore.findById(id);
    if (!repository) {
      throw new ApiError(404, 'Repository not found', `Repository with ID ${id} not found`);
    }

    const timePeriod = parseTimePeriod('30d');

    // Detect all burnout indicators
    const { alerts, overallRisk } =
      await burnoutDetector.detectAndStoreAllAlerts(id, timePeriod);

    res.json({
      repository_id: id,
      overall_risk: overallRisk,
      alerts: alerts.map((alert) => ({
        type: alert.type,
        severity: alert.severity,
        affected_maintainers: alert.affected_maintainers,
        metric_value: alert.metric_value,
        threshold: alert.threshold,
        message: alert.message,
        timestamp: alert.timestamp,
      })),
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/repositories/:id/sustainability
 * Get sustainability index
 * Requirements: 8.3
 */
router.get('/:id/sustainability', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const timePeriodStr = req.query.time_period as string | undefined;

    // Check if repository exists
    const repository = await repositoryStore.findById(id);
    if (!repository) {
      throw new ApiError(404, 'Repository not found', `Repository with ID ${id} not found`);
    }

    const timePeriod = parseTimePeriod(timePeriodStr);

    // Calculate sustainability index
    const sustainabilityScore =
      await sustainabilityScorer.calculateSustainabilityIndex(id, timePeriod);

    res.json({
      repository_id: id,
      time_period: {
        start: timePeriod.start,
        end: timePeriod.end,
      },
      sustainability_score: {
        overall_score: sustainabilityScore.overall_score,
        contributor_diversity_score:
          sustainabilityScore.contributor_diversity_score,
        load_distribution_score: sustainabilityScore.load_distribution_score,
        response_time_score: sustainabilityScore.response_time_score,
        retention_score: sustainabilityScore.retention_score,
        missing_metrics: sustainabilityScore.missing_metrics,
        timestamp: sustainabilityScore.timestamp,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/repositories/:id/trends
 * Get historical trend data
 * Requirements: 8.4
 */
router.get('/:id/trends', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const metricName = req.query.metric_name as string | undefined;
    const timeRange = req.query.time_range as string | undefined;

    // Check if repository exists
    const repository = await repositoryStore.findById(id);
    if (!repository) {
      throw new ApiError(404, 'Repository not found', `Repository with ID ${id} not found`);
    }

    if (!metricName) {
      throw new ApiError(400, 'Invalid request', 'metric_name query parameter is required');
    }

    const timePeriod = parseTimePeriod(timeRange);

    // Get trend data
    const trendData = await trendAnalyzer.get_trend(
      id,
      metricName,
      timePeriod.start,
      timePeriod.end
    );

    res.json({
      repository_id: id,
      metric_name: trendData.metric_name,
      time_range: {
        start: timePeriod.start,
        end: timePeriod.end,
      },
      data_points: trendData.data_points,
      trend_direction: trendData.trend_direction,
      change_percentage: trendData.change_percentage,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/repositories/:id/good-first-issues
 * Get recommended good first issues
 * Requirements: 8.4
 */
router.get('/:id/good-first-issues', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const limitStr = req.query.limit as string | undefined;
    const limit = limitStr ? parseInt(limitStr, 10) : 10;

    // Check if repository exists
    const repository = await repositoryStore.findById(id);
    if (!repository) {
      throw new ApiError(404, 'Repository not found', `Repository with ID ${id} not found`);
    }

    // Get recommendations
    const recommendations =
      await goodFirstIssueAnalyzer.recommendGoodFirstIssues(id, limit);

    res.json({
      repository_id: id,
      recommendations: recommendations.map((rec) => ({
        issue_id: rec.issue_id,
        title: rec.title,
        complexity_score: rec.complexity_score,
        clarity_score: rec.clarity_score,
        overall_score: rec.overall_score,
        justification: rec.justification,
        labels: rec.labels,
      })),
      total: recommendations.length,
    });
  } catch (error) {
    next(error);
  }
});

export { router as metricsRouter };
