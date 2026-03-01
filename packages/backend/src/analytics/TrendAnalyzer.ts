import { Pool } from 'pg';
import { TrendData, TrendAlert, DataPoint } from '../types/models';
import { TrendDirection } from '../types/enums';
import { MetricsStore } from '../storage/MetricsStore';

/**
 * TrendAnalyzer tracks metric changes over time and identifies significant trends
 * Requirements: 6.1, 6.3
 */
export class TrendAnalyzer {
  private metricsStore: MetricsStore;

  constructor(pool: Pool) {
    this.metricsStore = new MetricsStore(pool);
  }

  /**
   * Store a snapshot of metrics at a specific timestamp
   * Requirements: 6.1
   */
  async store_snapshot(
    repo_id: string,
    metrics: Record<string, number>,
    timestamp: Date
  ): Promise<void> {
    await this.metricsStore.storeMetrics(repo_id, metrics, timestamp);
  }

  /**
   * Retrieve trend data for a metric over a time range
   * Requirements: 6.1, 6.2
   */
  async get_trend(
    repo_id: string,
    metric_name: string,
    start_time: Date,
    end_time: Date
  ): Promise<TrendData> {
    const dataPoints = await this.metricsStore.getMetric(
      repo_id,
      metric_name,
      start_time,
      end_time
    );

    const data_points: DataPoint[] = dataPoints.map((dp) => ({
      timestamp: dp.time,
      value: dp.value,
    }));

    // Calculate trend direction using linear regression
    const trend_direction = this.calculateTrendDirection(data_points);

    // Calculate change percentage
    const change_percentage = this.calculateChangePercentage(data_points);

    return {
      metric_name,
      data_points,
      trend_direction,
      change_percentage,
    };
  }

  /**
   * Detect significant changes in a metric
   * Requirements: 6.3
   */
  async detect_significant_changes(
    repo_id: string,
    metric_name: string,
    current_time: Date,
    comparison_period_days: number
  ): Promise<TrendAlert | null> {
    const comparison_time = new Date(current_time);
    comparison_time.setDate(comparison_time.getDate() - comparison_period_days);

    // Get current value
    const currentData = await this.metricsStore.getMetric(
      repo_id,
      metric_name,
      current_time,
      current_time
    );

    if (currentData.length === 0) {
      return null;
    }

    const current_value = currentData[0].value;

    // Get previous value
    const previousData = await this.metricsStore.getMetric(
      repo_id,
      metric_name,
      comparison_time,
      comparison_time
    );

    if (previousData.length === 0) {
      return null;
    }

    const previous_value = previousData[0].value;

    // Calculate change percentage
    const change_percentage =
      previous_value !== 0
        ? ((current_value - previous_value) / Math.abs(previous_value)) * 100
        : 0;

    const is_significant = Math.abs(change_percentage) > 30;

    const direction: 'increase' | 'decrease' =
      change_percentage > 0 ? 'increase' : 'decrease';

    return {
      metric_name,
      change_percentage,
      direction,
      current_value,
      previous_value,
      is_significant,
    };
  }

  /**
   * Calculate trend direction using linear regression
   * Returns: increasing, decreasing, or stable
   */
  private calculateTrendDirection(data_points: DataPoint[]): TrendDirection {
    if (data_points.length < 2) {
      return TrendDirection.STABLE;
    }

    // Convert timestamps to numeric values (milliseconds since epoch)
    const n = data_points.length;
    const x = data_points.map((dp) => dp.timestamp.getTime());
    const y = data_points.map((dp) => dp.value);

    // Calculate means
    const x_mean = x.reduce((sum, val) => sum + val, 0) / n;
    const y_mean = y.reduce((sum, val) => sum + val, 0) / n;

    // Calculate slope using least squares method
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (x[i] - x_mean) * (y[i] - y_mean);
      denominator += (x[i] - x_mean) * (x[i] - x_mean);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;

    // Determine direction based on slope
    // Use a small threshold to avoid noise
    const threshold = 1e-10;

    if (slope > threshold) {
      return TrendDirection.INCREASING;
    } else if (slope < -threshold) {
      return TrendDirection.DECREASING;
    } else {
      return TrendDirection.STABLE;
    }
  }

  /**
   * Calculate percentage change from first to last data point
   */
  private calculateChangePercentage(data_points: DataPoint[]): number {
    if (data_points.length < 2) {
      return 0;
    }

    const first_value = data_points[0].value;
    const last_value = data_points[data_points.length - 1].value;

    if (first_value === 0) {
      return 0;
    }

    return ((last_value - first_value) / Math.abs(first_value)) * 100;
  }
}
