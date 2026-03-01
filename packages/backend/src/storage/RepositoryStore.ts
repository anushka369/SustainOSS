import { Pool } from 'pg';
import { Repository, Maintainer, Credentials } from '../types/models.js';
import { getEncryptionService } from '../security/index.js';
import { getCacheService } from './CacheService';

/**
 * Repository store for managing repository metadata
 * Requirements: 1.1, 10.4
 */
export class RepositoryStore {
  private cache = getCacheService();

  constructor(private pool: Pool) {}

  /**
   * Create a new repository record
   */
  async create(repo: Repository): Promise<Repository> {
    const encryptionService = getEncryptionService();
    
    // Encrypt credentials if provided
    let credentialsEncrypted: string | null = null;
    if (repo.credentials) {
      credentialsEncrypted = encryptionService.encrypt(JSON.stringify(repo.credentials));
    }
    
    const query = `
      INSERT INTO repositories (id, url, name, local_path, credentials_encrypted, last_sync, created_at, maintainers)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [
      repo.id,
      repo.url,
      repo.name,
      repo.localPath,
      credentialsEncrypted,
      repo.lastSync,
      repo.createdAt,
      JSON.stringify(repo.maintainers),
    ];

    const result = await this.pool.query(query, values);
    return this.mapRowToRepository(result.rows[0]);
  }

  /**
   * Find repository by ID
   */
  async findById(id: string): Promise<Repository | null> {
    // Check cache first
    const cacheKey = `repo:${id}`;
    const cached = this.cache.get<Repository>(cacheKey);
    if (cached) {
      return cached;
    }

    const query = 'SELECT * FROM repositories WHERE id = $1';
    const result = await this.pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const repo = this.mapRowToRepository(result.rows[0]);
    
    // Cache the result
    this.cache.set(cacheKey, repo);
    
    return repo;
  }

  /**
   * Find repository by URL
   */
  async findByUrl(url: string): Promise<Repository | null> {
    const query = 'SELECT * FROM repositories WHERE url = $1';
    const result = await this.pool.query(query, [url]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToRepository(result.rows[0]);
  }

  /**
   * List all repositories
   */
  async findAll(): Promise<Repository[]> {
    const query = 'SELECT * FROM repositories ORDER BY created_at DESC';
    const result = await this.pool.query(query);

    return result.rows.map((row) => this.mapRowToRepository(row));
  }

  /**
   * Update repository
   */
  async update(repo: Repository): Promise<Repository> {
    const encryptionService = getEncryptionService();
    
    // Encrypt credentials if provided
    let credentialsEncrypted: string | null = null;
    if (repo.credentials) {
      credentialsEncrypted = encryptionService.encrypt(JSON.stringify(repo.credentials));
    }
    
    const query = `
      UPDATE repositories
      SET url = $2, name = $3, local_path = $4, credentials_encrypted = $5, last_sync = $6, maintainers = $7
      WHERE id = $1
      RETURNING *
    `;
    const values = [
      repo.id,
      repo.url,
      repo.name,
      repo.localPath,
      credentialsEncrypted,
      repo.lastSync,
      JSON.stringify(repo.maintainers),
    ];

    const result = await this.pool.query(query, values);
    const updated = this.mapRowToRepository(result.rows[0]);
    
    // Invalidate cache
    this.cache.delete(`repo:${repo.id}`);
    this.cache.invalidatePattern(/^repo:list/);
    
    return updated;
  }

  /**
   * Delete repository
   */
  async delete(id: string): Promise<void> {
    const query = 'DELETE FROM repositories WHERE id = $1';
    await this.pool.query(query, [id]);
  }

  /**
   * Map database row to Repository object
   */
  private mapRowToRepository(row: any): Repository {
    const encryptionService = getEncryptionService();
    
    // Decrypt credentials if present
    let credentials: Credentials | undefined;
    if (row.credentials_encrypted) {
      try {
        const decrypted = encryptionService.decrypt(row.credentials_encrypted);
        credentials = JSON.parse(decrypted) as Credentials;
      } catch (error) {
        console.error('Failed to decrypt credentials:', error);
        // Don't fail the entire operation, just omit credentials
      }
    }
    
    return {
      id: row.id,
      url: row.url,
      name: row.name,
      localPath: row.local_path,
      credentials,
      lastSync: new Date(row.last_sync),
      createdAt: new Date(row.created_at),
      maintainers: JSON.parse(row.maintainers || '[]') as Maintainer[],
    };
  }
}
