import { Pool } from 'pg';
import { BurnoutAlert } from '../types/models.js';

/**
 * Burnout Alert store for managing burnout alerts
 * Requirements: 3.5
 */
export class BurnoutAlertStore {
  constructor(private pool: Pool) {}

  /**
   * Create a new burnout alert
   */
  async create(repoId: string, alert: BurnoutAlert): Promise<number> {
    const query = `
      INSERT INTO burnout_alerts (repo_id, type, severity, affected_maintainers, metric_value, threshold, message, timestamp, resolved)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;
    const values = [
      repoId,
      alert.type,
      alert.severity,
      JSON.stringify(alert.affected_maintainers),
      alert.metric_value,
      alert.threshold,
      alert.message,
      alert.timestamp,
      false,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0].id;
  }

  /**
   * Find active (unresolved) alerts by repository
   */
  async findActiveByRepoId(repoId: string): Promise<BurnoutAlert[]> {
    const query = `
      SELECT type, severity, affected_maintainers, metric_value, threshold, message, timestamp
      FROM burnout_alerts
      WHERE repo_id = $1 AND resolved = false
      ORDER BY timestamp DESC
    `;
    const result = await this.pool.query(query, [repoId]);
    return result.rows.map((row) => this.mapRowToAlert(row));
  }

  /**
   * Find all alerts by repository
   */
  async findByRepoId(repoId: string, limit?: number): Promise<BurnoutAlert[]> {
    let query = `
      SELECT type, severity, affected_maintainers, metric_value, threshold, message, timestamp
      FROM burnout_alerts
      WHERE repo_id = $1
      ORDER BY timestamp DESC
    `;

    if (limit) {
      query += ` LIMIT $2`;
    }

    const values = limit ? [repoId, limit] : [repoId];
    const result = await this.pool.query(query, values);
    return result.rows.map((row) => this.mapRowToAlert(row));
  }

  /**
   * Resolve alerts by type
   */
  async resolveByType(repoId: string, type: string): Promise<void> {
    const query = `
      UPDATE burnout_alerts
      SET resolved = true
      WHERE repo_id = $1 AND type = $2 AND resolved = false
    `;
    await this.pool.query(query, [repoId, type]);
  }

  /**
   * Resolve all alerts for a repository
   */
  async resolveAll(repoId: string): Promise<void> {
    const query = `
      UPDATE burnout_alerts
      SET resolved = true
      WHERE repo_id = $1 AND resolved = false
    `;
    await this.pool.query(query, [repoId]);
  }

  /**
   * Map database row to BurnoutAlert
   */
  private mapRowToAlert(row: any): BurnoutAlert {
    return {
      type: row.type,
      severity: row.severity,
      affected_maintainers: JSON.parse(row.affected_maintainers || '[]'),
      metric_value: parseFloat(row.metric_value),
      threshold: parseFloat(row.threshold),
      message: row.message,
      timestamp: new Date(row.timestamp),
    };
  }
}
