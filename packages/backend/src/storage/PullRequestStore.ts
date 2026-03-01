import { Pool } from 'pg';
import { PRRecord } from '../types/models.js';

/**
 * Pull Request store for managing PR records
 * Requirements: 1.3
 */
export class PullRequestStore {
  constructor(private pool: Pool) {}

  /**
   * Create a new pull request record
   */
  async create(repoId: string, pr: PRRecord): Promise<void> {
    const query = `
      INSERT INTO pull_requests (repo_id, pr_id, author, reviewers, created_at, merged_at, closed_at, review_comments, files_changed, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (repo_id, pr_id) DO UPDATE SET
        reviewers = EXCLUDED.reviewers,
        merged_at = EXCLUDED.merged_at,
        closed_at = EXCLUDED.closed_at,
        review_comments = EXCLUDED.review_comments,
        files_changed = EXCLUDED.files_changed,
        status = EXCLUDED.status
    `;
    const values = [
      repoId,
      pr.id,
      pr.author,
      JSON.stringify(pr.reviewers),
      pr.created_at,
      pr.merged_at,
      pr.closed_at,
      pr.review_comments,
      pr.files_changed,
      pr.status,
    ];

    await this.pool.query(query, values);
  }

  /**
   * Bulk insert pull requests
   */
  async createMany(repoId: string, prs: PRRecord[]): Promise<void> {
    if (prs.length === 0) return;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const pr of prs) {
        await this.create(repoId, pr);
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
   * Find pull requests by repository ID
   */
  async findByRepoId(
    repoId: string,
    since?: Date,
    limit?: number
  ): Promise<PRRecord[]> {
    let query = `
      SELECT pr_id, author, reviewers, created_at, merged_at, closed_at, review_comments, files_changed, status
      FROM pull_requests
      WHERE repo_id = $1
    `;
    const values: any[] = [repoId];

    if (since) {
      query += ' AND created_at >= $2';
      values.push(since);
    }

    query += ' ORDER BY created_at DESC';

    if (limit) {
      query += ` LIMIT $${values.length + 1}`;
      values.push(limit);
    }

    const result = await this.pool.query(query, values);
    return result.rows.map((row) => this.mapRowToPR(row));
  }

  /**
   * Find pull requests by status
   */
  async findByStatus(repoId: string, status: string): Promise<PRRecord[]> {
    const query = `
      SELECT pr_id, author, reviewers, created_at, merged_at, closed_at, review_comments, files_changed, status
      FROM pull_requests
      WHERE repo_id = $1 AND status = $2
      ORDER BY created_at DESC
    `;
    const result = await this.pool.query(query, [repoId, status]);
    return result.rows.map((row) => this.mapRowToPR(row));
  }

  /**
   * Get PR count by repository
   */
  async countByRepoId(repoId: string, since?: Date): Promise<number> {
    let query = 'SELECT COUNT(*) FROM pull_requests WHERE repo_id = $1';
    const values: any[] = [repoId];

    if (since) {
      query += ' AND created_at >= $2';
      values.push(since);
    }

    const result = await this.pool.query(query, values);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Map database row to PRRecord
   */
  private mapRowToPR(row: any): PRRecord {
    return {
      id: row.pr_id,
      author: row.author,
      reviewers: JSON.parse(row.reviewers || '[]'),
      created_at: new Date(row.created_at),
      merged_at: row.merged_at ? new Date(row.merged_at) : null,
      closed_at: row.closed_at ? new Date(row.closed_at) : null,
      review_comments: row.review_comments,
      files_changed: row.files_changed,
      status: row.status,
    };
  }
}
