import { Pool } from 'pg';
import { CommitRecord } from '../types/models.js';

/**
 * Commit store for managing commit records
 * Requirements: 1.2
 */
export class CommitStore {
  constructor(private pool: Pool) {}

  /**
   * Create a new commit record
   */
  async create(repoId: string, commit: CommitRecord): Promise<void> {
    const query = `
      INSERT INTO commits (repo_id, sha, author, author_email, timestamp, files_changed, insertions, deletions, message)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (repo_id, sha) DO NOTHING
    `;
    const values = [
      repoId,
      commit.sha,
      commit.author,
      commit.author_email,
      commit.timestamp,
      commit.files_changed,
      commit.insertions,
      commit.deletions,
      commit.message,
    ];

    await this.pool.query(query, values);
  }

  /**
   * Bulk insert commits
   */
  async createMany(repoId: string, commits: CommitRecord[]): Promise<void> {
    if (commits.length === 0) return;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const commit of commits) {
        await this.create(repoId, commit);
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
   * Find commits by repository ID with optional date filtering
   */
  async findByRepoId(
    repoId: string,
    since?: Date,
    limit?: number
  ): Promise<CommitRecord[]> {
    let query = `
      SELECT sha, author, author_email, timestamp, files_changed, insertions, deletions, message
      FROM commits
      WHERE repo_id = $1
    `;
    const values: any[] = [repoId];

    if (since) {
      query += ' AND timestamp >= $2';
      values.push(since);
    }

    query += ' ORDER BY timestamp DESC';

    if (limit) {
      query += ` LIMIT $${values.length + 1}`;
      values.push(limit);
    }

    const result = await this.pool.query(query, values);
    return result.rows.map((row) => this.mapRowToCommit(row));
  }

  /**
   * Get commit count by repository
   */
  async countByRepoId(repoId: string, since?: Date): Promise<number> {
    let query = 'SELECT COUNT(*) FROM commits WHERE repo_id = $1';
    const values: any[] = [repoId];

    if (since) {
      query += ' AND timestamp >= $2';
      values.push(since);
    }

    const result = await this.pool.query(query, values);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get commits by author email
   */
  async findByAuthorEmail(
    repoId: string,
    authorEmail: string,
    since?: Date
  ): Promise<CommitRecord[]> {
    let query = `
      SELECT sha, author, author_email, timestamp, files_changed, insertions, deletions, message
      FROM commits
      WHERE repo_id = $1 AND author_email = $2
    `;
    const values: any[] = [repoId, authorEmail];

    if (since) {
      query += ' AND timestamp >= $3';
      values.push(since);
    }

    query += ' ORDER BY timestamp DESC';

    const result = await this.pool.query(query, values);
    return result.rows.map((row) => this.mapRowToCommit(row));
  }

  /**
   * Map database row to CommitRecord
   */
  private mapRowToCommit(row: any): CommitRecord {
    return {
      sha: row.sha,
      author: row.author,
      author_email: row.author_email,
      timestamp: new Date(row.timestamp),
      files_changed: row.files_changed,
      insertions: row.insertions,
      deletions: row.deletions,
      message: row.message,
    };
  }
}
