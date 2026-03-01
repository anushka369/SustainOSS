import { Pool } from 'pg';
import { IssueRecord } from '../types/models.js';

/**
 * Issue store for managing issue records
 * Requirements: 1.4
 */
export class IssueStore {
  constructor(private pool: Pool) {}

  /**
   * Create a new issue record
   */
  async create(repoId: string, issue: IssueRecord): Promise<void> {
    const query = `
      INSERT INTO issues (repo_id, issue_id, author, assignees, labels, created_at, closed_at, first_response_at, comment_count, status, title, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (repo_id, issue_id) DO UPDATE SET
        assignees = EXCLUDED.assignees,
        labels = EXCLUDED.labels,
        closed_at = EXCLUDED.closed_at,
        first_response_at = EXCLUDED.first_response_at,
        comment_count = EXCLUDED.comment_count,
        status = EXCLUDED.status,
        title = EXCLUDED.title,
        description = EXCLUDED.description
    `;
    const values = [
      repoId,
      issue.id,
      issue.author,
      JSON.stringify(issue.assignees),
      JSON.stringify(issue.labels),
      issue.created_at,
      issue.closed_at,
      issue.first_response_at,
      issue.comment_count,
      issue.status,
      issue.title,
      issue.description,
    ];

    await this.pool.query(query, values);
  }

  /**
   * Bulk insert issues
   */
  async createMany(repoId: string, issues: IssueRecord[]): Promise<void> {
    if (issues.length === 0) return;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const issue of issues) {
        await this.create(repoId, issue);
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
   * Find issues by repository ID
   */
  async findByRepoId(
    repoId: string,
    since?: Date,
    limit?: number
  ): Promise<IssueRecord[]> {
    let query = `
      SELECT issue_id, author, assignees, labels, created_at, closed_at, first_response_at, comment_count, status, title, description
      FROM issues
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
    return result.rows.map((row) => this.mapRowToIssue(row));
  }

  /**
   * Find issues by status
   */
  async findByStatus(repoId: string, status: string): Promise<IssueRecord[]> {
    const query = `
      SELECT issue_id, author, assignees, labels, created_at, closed_at, first_response_at, comment_count, status, title, description
      FROM issues
      WHERE repo_id = $1 AND status = $2
      ORDER BY created_at DESC
    `;
    const result = await this.pool.query(query, [repoId, status]);
    return result.rows.map((row) => this.mapRowToIssue(row));
  }

  /**
   * Find open issues with no assignees (untriaged)
   */
  async findUntriaged(repoId: string): Promise<IssueRecord[]> {
    const query = `
      SELECT issue_id, author, assignees, labels, created_at, closed_at, first_response_at, comment_count, status, title, description
      FROM issues
      WHERE repo_id = $1 
        AND status = 'open'
        AND jsonb_array_length(assignees) = 0
        AND comment_count = 0
      ORDER BY created_at ASC
    `;
    const result = await this.pool.query(query, [repoId]);
    return result.rows.map((row) => this.mapRowToIssue(row));
  }

  /**
   * Get issue count by repository
   */
  async countByRepoId(repoId: string, since?: Date): Promise<number> {
    let query = 'SELECT COUNT(*) FROM issues WHERE repo_id = $1';
    const values: any[] = [repoId];

    if (since) {
      query += ' AND created_at >= $2';
      values.push(since);
    }

    const result = await this.pool.query(query, values);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Map database row to IssueRecord
   */
  private mapRowToIssue(row: any): IssueRecord {
    return {
      id: row.issue_id,
      author: row.author,
      assignees: JSON.parse(row.assignees || '[]'),
      labels: JSON.parse(row.labels || '[]'),
      created_at: new Date(row.created_at),
      closed_at: row.closed_at ? new Date(row.closed_at) : null,
      first_response_at: row.first_response_at
        ? new Date(row.first_response_at)
        : null,
      comment_count: row.comment_count,
      status: row.status,
      title: row.title,
      description: row.description,
    };
  }
}
