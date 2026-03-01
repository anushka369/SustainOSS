import { Pool } from 'pg';
import { getCacheService } from './CacheService';

/**
 * Metrics store for managing time series metrics data
 * Uses TimescaleDB hypertable for efficient time series storage
 */
export class MetricsStore {
  private cache = getCacheService();

  constructor(private pool: Pool) {}

  /**
   * Store a metric value
   */
  async storeMetric(
    repoId: string,
    metricName: string,
    value: number,
    timestamp: Date,
    maintainer?: string
  ): Promise<void> {
    const query = `
      INSERT INTO repository_metrics (time, repo_id, metric_name, maintainer, value)
      VALUES ($1, $2, $3, $4, $5)
    `;
    const values = [timestamp, repoId, metricName, maintainer || null, value];

    await this.pool.query(query, values);
    
    // Invalidate cache for this metric
    const cacheKey = `metric:${repoId}:${metricName}:${maintainer || 'all'}`;
    this.cache.delete(cacheKey);
  }

  /**
   * Store multiple metrics at once
   */
  async storeMetrics(
    repoId: string,
    metrics: Record<string, number>,
    timestamp: Date
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const [metricName, value] of Object.entries(metrics)) {
        await this.storeMetric(repoId, metricName, value, timestamp);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get metric values over a time range
   */
  async getMetric(
    repoId: string,
    metricName: string,
    startTime: Date,
    endTime: Date,
    maintainer?: string
  ): Promise<Array<{ time: Date; value: number }>> {
    let query = `
      SELECT time, value
      FROM repository_metrics
      WHERE repo_id = $1 AND metric_name = $2 AND time >= $3 AND time <= $4
    `;
    const values: any[] = [repoId, metricName, startTime, endTime];

    if (maintainer) {
      query += ' AND maintainer = $5';
      values.push(maintainer);
    }

    query += ' ORDER BY time ASC';

    const result = await this.pool.query(query, values);
    return result.rows.map((row) => ({
      time: new Date(row.time),
      value: parseFloat(row.value),
    }));
  }

  /**
   * Get latest metric value
   */
  async getLatestMetric(
    repoId: string,
    metricName: string,
    maintainer?: string
  ): Promise<number | null> {
    // Check cache first
    const cacheKey = `metric:${repoId}:${metricName}:${maintainer || 'all'}`;
    const cached = this.cache.get<number>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    let query = `
      SELECT value
      FROM repository_metrics
      WHERE repo_id = $1 AND metric_name = $2
    `;
    const values: any[] = [repoId, metricName];

    if (maintainer) {
      query += ' AND maintainer = $3';
      values.push(maintainer);
    }

    query += ' ORDER BY time DESC LIMIT 1';

    const result = await this.pool.query(query, values);
    if (result.rows.length === 0) {
      return null;
    }

    const value = parseFloat(result.rows[0].value);
    
    // Cache the result
    this.cache.set(cacheKey, value);
    
    return value;
  }

  /**
   * Get all metrics for a repository at a specific time
   */
  async getSnapshotMetrics(
    repoId: string,
    timestamp: Date
  ): Promise<Record<string, number>> {
    const query = `
      SELECT metric_name, value
      FROM repository_metrics
      WHERE repo_id = $1 AND time = $2
    `;
    const result = await this.pool.query(query, [repoId, timestamp]);

    const metrics: Record<string, number> = {};
    result.rows.forEach((row) => {
      metrics[row.metric_name] = parseFloat(row.value);
    });

    return metrics;
  }

  /**
   * Get metric values grouped by maintainer
   */
  async getMetricByMaintainer(
    repoId: string,
    metricName: string,
    timestamp: Date
  ): Promise<Record<string, number>> {
    const query = `
      SELECT maintainer, value
      FROM repository_metrics
      WHERE repo_id = $1 AND metric_name = $2 AND time = $3 AND maintainer IS NOT NULL
    `;
    const result = await this.pool.query(query, [repoId, metricName, timestamp]);

    const metrics: Record<string, number> = {};
    result.rows.forEach((row) => {
      metrics[row.maintainer] = parseFloat(row.value);
    });

    return metrics;
  }

  /**
   * Delete old metrics (for data retention)
   */
  async deleteOldMetrics(beforeDate: Date): Promise<void> {
    const query = 'DELETE FROM repository_metrics WHERE time < $1';
    await this.pool.query(query, [beforeDate]);
  }
}
