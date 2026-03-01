import { Pool } from 'pg';
import { MetricsCalculator, TimePeriod } from './MetricsCalculator.js';
import { SustainabilityScore } from '../types/models.js';

/**
 * Sustainability Scorer for calculating composite sustainability index
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */
export class SustainabilityScorer {
  private metricsCalculator: MetricsCalculator;

  constructor(pool: Pool) {
    this.metricsCalculator = new MetricsCalculator(pool);
  }

  /**
   * Calculate contributor diversity score (0-25)
   * Requirements: 5.1
   * Score = min(25, contributor_count / 2)
   * Rationale: 50+ contributors = maximum diversity
   */
  async calculateContributorDiversityScore(
    repoId: string,
    timePeriod: TimePeriod
  ): Promise<number> {
    const contributorCount =
      await this.metricsCalculator.calculateContributorDiversity(
        repoId,
        timePeriod
      );

    const score = Math.min(25, contributorCount / 2);
    return score;
  }

  /**
   * Calculate load distribution score (0-25)
   * Requirements: 5.2
   * Score = 25 × (1 - gini_coefficient)
   * Rationale: Lower Gini = more equal distribution = higher score
   */
  async calculateLoadDistributionScore(
    repoId: string,
    timePeriod: TimePeriod
  ): Promise<number> {
    const giniCoefficient =
      await this.metricsCalculator.calculateContributionConcentration(
        repoId,
        timePeriod
      );

    const score = 25 * (1 - giniCoefficient);
    return score;
  }

  /**
   * Calculate response time score (0-25)
   * Requirements: 5.3
   * Score = 25 × max(0, 1 - (median_hours / 168))
   * Rationale: < 1 week response time = good, > 1 week = declining score
   */
  async calculateResponseTimeScore(
    repoId: string,
    timePeriod: TimePeriod
  ): Promise<number> {
    const turnaroundTimes =
      await this.metricsCalculator.calculateAvgReviewTurnaround(
        repoId,
        timePeriod
      );

    // Calculate median response time from all maintainers
    const times = Object.values(turnaroundTimes).filter((time) => time > 0);

    if (times.length === 0) {
      // No response times available, return 0
      return 0;
    }

    // Calculate median
    const sortedTimes = times.sort((a, b) => a - b);
    const medianHours =
      sortedTimes.length % 2 === 0
        ? (sortedTimes[sortedTimes.length / 2 - 1] +
            sortedTimes[sortedTimes.length / 2]) /
          2
        : sortedTimes[Math.floor(sortedTimes.length / 2)];

    const score = 25 * Math.max(0, 1 - medianHours / 168);
    return score;
  }

  /**
   * Calculate retention score (0-25)
   * Requirements: 5.4
   * Score = retention_ratio × 0.25
   * Rationale: Direct mapping of percentage to score
   */
  async calculateRetentionScore(
    repoId: string,
    timePeriod: TimePeriod
  ): Promise<number> {
    const retentionRatio =
      await this.metricsCalculator.calculateRetentionRatio(repoId, timePeriod);

    const score = retentionRatio * 0.25;
    return score;
  }

  /**
   * Calculate composite sustainability index
   * Requirements: 5.5, 5.6
   * Handles missing metrics with proportional redistribution
   */
  async calculateSustainabilityIndex(
    repoId: string,
    timePeriod: TimePeriod
  ): Promise<SustainabilityScore> {
    const missingMetrics: string[] = [];
    const scores: Record<string, number | null> = {
      contributor_diversity: null,
      load_distribution: null,
      response_time: null,
      retention: null,
    };

    // Try to calculate each component score
    try {
      scores.contributor_diversity =
        await this.calculateContributorDiversityScore(repoId, timePeriod);
    } catch (error) {
      missingMetrics.push('contributor_diversity');
    }

    try {
      scores.load_distribution = await this.calculateLoadDistributionScore(
        repoId,
        timePeriod
      );
    } catch (error) {
      missingMetrics.push('load_distribution');
    }

    try {
      scores.response_time = await this.calculateResponseTimeScore(
        repoId,
        timePeriod
      );
    } catch (error) {
      missingMetrics.push('response_time');
    }

    try {
      scores.retention = await this.calculateRetentionScore(repoId, timePeriod);
    } catch (error) {
      missingMetrics.push('retention');
    }

    // Calculate overall score with proportional redistribution
    const availableScores = Object.values(scores).filter(
      (score) => score !== null
    ) as number[];
    const availableCount = availableScores.length;

    let overallScore = 0;
    const componentScores: Record<string, number> = {
      contributor_diversity_score: 0,
      load_distribution_score: 0,
      response_time_score: 0,
      retention_score: 0,
    };

    if (availableCount > 0) {
      // Redistribute weight proportionally
      const weightPerComponent = 100 / availableCount;

      if (scores.contributor_diversity !== null) {
        const redistributedScore =
          (scores.contributor_diversity / 25) * weightPerComponent;
        componentScores.contributor_diversity_score = redistributedScore;
        overallScore += redistributedScore;
      }

      if (scores.load_distribution !== null) {
        const redistributedScore =
          (scores.load_distribution / 25) * weightPerComponent;
        componentScores.load_distribution_score = redistributedScore;
        overallScore += redistributedScore;
      }

      if (scores.response_time !== null) {
        const redistributedScore =
          (scores.response_time / 25) * weightPerComponent;
        componentScores.response_time_score = redistributedScore;
        overallScore += redistributedScore;
      }

      if (scores.retention !== null) {
        const redistributedScore = (scores.retention / 25) * weightPerComponent;
        componentScores.retention_score = redistributedScore;
        overallScore += redistributedScore;
      }
    }

    return {
      overall_score: overallScore,
      contributor_diversity_score: componentScores.contributor_diversity_score,
      load_distribution_score: componentScores.load_distribution_score,
      response_time_score: componentScores.response_time_score,
      retention_score: componentScores.retention_score,
      missing_metrics: missingMetrics,
      timestamp: new Date(),
    };
  }
}
