import { Pool } from 'pg';
import { IssueStore, BurnoutAlertStore } from '../storage/index.js';
import { MetricsCalculator, TimePeriod } from './MetricsCalculator.js';
import { BurnoutAlert } from '../types/models.js';
import {
  BurnoutAlertType,
  AlertSeverity,
  RiskLevel,
  IssueStatus,
} from '../types/enums.js';

/**
 * Burnout Detector for identifying burnout risk indicators
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
export class BurnoutDetector {
  private issueStore: IssueStore;
  private burnoutAlertStore: BurnoutAlertStore;
  private metricsCalculator: MetricsCalculator;

  constructor(pool: Pool) {
    this.issueStore = new IssueStore(pool);
    this.burnoutAlertStore = new BurnoutAlertStore(pool);
    this.metricsCalculator = new MetricsCalculator(pool);
  }

  /**
   * Detect high load concentration (> 60% threshold)
   * Requirements: 3.1
   */
  async detectHighLoadConcentration(
    repoId: string,
    timePeriod: TimePeriod
  ): Promise<BurnoutAlert[]> {
    const alerts: BurnoutAlert[] = [];

    // Get PR reviews per maintainer
    const prReviews = await this.metricsCalculator.calculatePRReviewsPerMaintainer(
      repoId,
      timePeriod
    );

    // Calculate total activity
    const totalReviews = Object.values(prReviews).reduce(
      (sum, count) => sum + count,
      0
    );

    if (totalReviews === 0) {
      return alerts;
    }

    // Check each maintainer's percentage
    for (const [maintainer, reviewCount] of Object.entries(prReviews)) {
      const percentage = (reviewCount / totalReviews) * 100;

      if (percentage > 60) {
        const severity =
          percentage > 75 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM;

        alerts.push({
          type: BurnoutAlertType.HIGH_LOAD,
          severity,
          affected_maintainers: [maintainer],
          metric_value: percentage,
          threshold: 60,
          message: `${maintainer} is handling ${percentage.toFixed(1)}% of PR reviews, indicating high load concentration`,
          timestamp: new Date(),
        });
      }
    }

    return alerts;
  }

  /**
   * Detect increasing backlog (> 50% increase over 30 days)
   * Requirements: 3.2
   */
  async detectIncreasingBacklog(repoId: string): Promise<BurnoutAlert | null> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get current open issue count
    const currentOpenIssues = await this.issueStore.findByStatus(
      repoId,
      IssueStatus.OPEN
    );
    const currentCount = currentOpenIssues.length;

    // Get open issues from 30 days ago
    // We need to count issues that were open 30 days ago
    // (created before 30 days ago and either still open or closed after 30 days ago)
    const allIssues = await this.issueStore.findByRepoId(repoId);
    const openThirtyDaysAgo = allIssues.filter((issue) => {
      const wasCreatedBefore = issue.created_at < thirtyDaysAgo;
      const wasStillOpen =
        !issue.closed_at || issue.closed_at >= thirtyDaysAgo;
      return wasCreatedBefore && wasStillOpen;
    }).length;

    if (openThirtyDaysAgo === 0) {
      // If there were no open issues 30 days ago, we can't calculate increase
      return null;
    }

    const increasePercentage =
      ((currentCount - openThirtyDaysAgo) / openThirtyDaysAgo) * 100;

    if (increasePercentage > 50) {
      const severity =
        increasePercentage > 100 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM;

      return {
        type: BurnoutAlertType.INCREASING_BACKLOG,
        severity,
        affected_maintainers: [],
        metric_value: increasePercentage,
        threshold: 50,
        message: `Issue backlog increased by ${increasePercentage.toFixed(1)}% over the past 30 days (from ${openThirtyDaysAgo} to ${currentCount} open issues)`,
        timestamp: new Date(),
      };
    }

    return null;
  }

  /**
   * Detect declining responsiveness (> 40% decrease vs baseline)
   * Requirements: 3.3
   */
  async detectDecliningResponsiveness(
    repoId: string
  ): Promise<BurnoutAlert[]> {
    const alerts: BurnoutAlert[] = [];
    const now = new Date();

    // Current period: last 30 days
    const currentPeriod: TimePeriod = {
      start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      end: now,
    };

    // Baseline period: 90 days ago to 60 days ago
    const baselineEnd = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const baselineStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const baselinePeriod: TimePeriod = {
      start: baselineStart,
      end: baselineEnd,
    };

    // Get average turnaround times for both periods
    const currentTurnaround = await this.metricsCalculator.calculateAvgReviewTurnaround(
      repoId,
      currentPeriod
    );
    const baselineTurnaround = await this.metricsCalculator.calculateAvgReviewTurnaround(
      repoId,
      baselinePeriod
    );

    // Check each maintainer
    for (const [maintainer, currentTime] of Object.entries(
      currentTurnaround
    )) {
      const baselineTime = baselineTurnaround[maintainer];

      // Skip if no baseline data or no current activity
      if (!baselineTime || baselineTime === 0 || currentTime === 0) {
        continue;
      }

      // Calculate percentage increase in response time (slower = worse)
      const increasePercentage =
        ((currentTime - baselineTime) / baselineTime) * 100;

      if (increasePercentage > 40) {
        const severity =
          increasePercentage > 100 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM;

        alerts.push({
          type: BurnoutAlertType.DECLINING_RESPONSIVENESS,
          severity,
          affected_maintainers: [maintainer],
          metric_value: increasePercentage,
          threshold: 40,
          message: `${maintainer}'s review response time increased by ${increasePercentage.toFixed(1)}% (from ${baselineTime.toFixed(1)}h to ${currentTime.toFixed(1)}h)`,
          timestamp: new Date(),
        });
      }
    }

    return alerts;
  }

  /**
   * Detect untriaged issues (> 14 days)
   * Requirements: 3.4
   */
  async detectUntriagedIssues(repoId: string): Promise<BurnoutAlert | null> {
    const untriagedIssues = await this.issueStore.findUntriaged(repoId);

    if (untriagedIssues.length === 0) {
      return null;
    }

    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Find issues older than 14 days
    const oldUntriagedIssues = untriagedIssues.filter(
      (issue) => issue.created_at < fourteenDaysAgo
    );

    if (oldUntriagedIssues.length === 0) {
      return null;
    }

    // Find the oldest untriaged issue
    const oldestIssue = oldUntriagedIssues.reduce((oldest, issue) =>
      issue.created_at < oldest.created_at ? issue : oldest
    );

    const daysUntriaged = Math.floor(
      (now.getTime() - oldestIssue.created_at.getTime()) /
        (24 * 60 * 60 * 1000)
    );

    const severity = daysUntriaged > 30 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM;

    return {
      type: BurnoutAlertType.UNTRIAGED_ISSUES,
      severity,
      affected_maintainers: [],
      metric_value: daysUntriaged,
      threshold: 14,
      message: `${oldUntriagedIssues.length} issue(s) remain untriaged for more than 14 days (oldest: ${daysUntriaged} days)`,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate overall risk level from alerts
   * Requirements: 3.5
   */
  calculateOverallRisk(alerts: BurnoutAlert[]): RiskLevel {
    const highAlerts = alerts.filter(
      (alert) => alert.severity === AlertSeverity.HIGH
    ).length;
    const mediumAlerts = alerts.filter(
      (alert) => alert.severity === AlertSeverity.MEDIUM
    ).length;

    // High: 2+ high alerts
    if (highAlerts >= 2) {
      return RiskLevel.HIGH;
    }

    // Medium: 2+ medium alerts OR 1 high alert
    if (mediumAlerts >= 2 || highAlerts >= 1) {
      return RiskLevel.MEDIUM;
    }

    // Low: 0-1 medium alerts, 0 high alerts
    return RiskLevel.LOW;
  }

  /**
   * Detect all burnout indicators and store alerts in database
   * Requirements: 3.5
   */
  async detectAndStoreAllAlerts(
    repoId: string,
    timePeriod: TimePeriod
  ): Promise<{ alerts: BurnoutAlert[]; overallRisk: RiskLevel }> {
    const allAlerts: BurnoutAlert[] = [];

    // Detect high load concentration
    const loadAlerts = await this.detectHighLoadConcentration(
      repoId,
      timePeriod
    );
    allAlerts.push(...loadAlerts);

    // Detect increasing backlog
    const backlogAlert = await this.detectIncreasingBacklog(repoId);
    if (backlogAlert) {
      allAlerts.push(backlogAlert);
    }

    // Detect declining responsiveness
    const responsivenessAlerts = await this.detectDecliningResponsiveness(
      repoId
    );
    allAlerts.push(...responsivenessAlerts);

    // Detect untriaged issues
    const untriagedAlert = await this.detectUntriagedIssues(repoId);
    if (untriagedAlert) {
      allAlerts.push(untriagedAlert);
    }

    // Store all alerts in database
    for (const alert of allAlerts) {
      await this.burnoutAlertStore.create(repoId, alert);
    }

    // Calculate overall risk
    const overallRisk = this.calculateOverallRisk(allAlerts);

    return { alerts: allAlerts, overallRisk };
  }

  /**
   * Get active burnout alerts for a repository
   * Requirements: 3.5
   */
  async getActiveAlerts(repoId: string): Promise<BurnoutAlert[]> {
    return this.burnoutAlertStore.findActiveByRepoId(repoId);
  }

  /**
   * Resolve alerts by type
   * Requirements: 3.5
   */
  async resolveAlertsByType(
    repoId: string,
    type: BurnoutAlertType
  ): Promise<void> {
    await this.burnoutAlertStore.resolveByType(repoId, type);
  }

  /**
   * Resolve all alerts for a repository
   * Requirements: 3.5
   */
  async resolveAllAlerts(repoId: string): Promise<void> {
    await this.burnoutAlertStore.resolveAll(repoId);
  }
}
