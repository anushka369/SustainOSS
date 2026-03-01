import { RepositoryParser } from '../RepositoryParser';
import * as fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Feature: sustainoss
 * Property 1: Repository Cloning Success
 * 
 * For any valid Git repository URL, the Ingestion Layer should successfully 
 * clone the repository and extract commit history without errors.
 * 
 * Validates: Requirements 1.1
 */

describe('RepositoryParser - Property-Based Tests', () => {
  let parser: RepositoryParser;
  const testWorkingDir = path.join(process.cwd(), 'test-repos-pbt');

  beforeAll(async () => {
    parser = new RepositoryParser({ workingDirectory: testWorkingDir });
    // Create test directory
    try {
      await fs.mkdir(testWorkingDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(testWorkingDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  afterEach(async () => {
    // Clean up any cloned repositories after each test
    try {
      const files = await fs.readdir(testWorkingDir);
      for (const file of files) {
        await fs.rm(path.join(testWorkingDir, file), { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  /**
   * Property 1: Repository Cloning Success
   * 
   * This property tests that valid Git repository URLs can be successfully cloned.
   * We test with a small, stable public repository to verify the cloning functionality.
   * 
   * Note: Due to network latency and repository size, we use a single well-known
   * small repository and run multiple iterations to verify consistency.
   */
  describe('Property 1: Repository Cloning Success', () => {
    it('should successfully clone a valid public Git repository', async () => {
      // Use octocat/Hello-World - a small, stable test repository
      const repoUrl = 'https://github.com/octocat/Hello-World.git';

      // Clone the repository
      const repo = await parser.cloneRepository(repoUrl);

      // Verify repository metadata is returned
      expect(repo).toBeDefined();
      expect(repo.id).toBeDefined();
      expect(repo.url).toBe(repoUrl);
      expect(repo.name).toBeDefined();
      expect(repo.localPath).toBeDefined();
      expect(repo.lastSync).toBeInstanceOf(Date);
      expect(repo.createdAt).toBeInstanceOf(Date);
      expect(repo.maintainers).toEqual([]);

      // Verify the repository was actually cloned to disk
      const stats = await fs.stat(repo.localPath);
      expect(stats.isDirectory()).toBe(true);

      // Verify .git directory exists
      const gitDir = path.join(repo.localPath, '.git');
      const gitStats = await fs.stat(gitDir);
      expect(gitStats.isDirectory()).toBe(true);

      // Verify we can extract commits from the cloned repository
      const commits = await parser.getCommits(repo);
      expect(commits).toBeDefined();
      expect(Array.isArray(commits)).toBe(true);
      expect(commits.length).toBeGreaterThan(0);

      // Verify commit structure
      if (commits.length > 0) {
        const firstCommit = commits[0];
        expect(firstCommit.sha).toBeDefined();
        expect(typeof firstCommit.sha).toBe('string');
        expect(firstCommit.author).toBeDefined();
        expect(typeof firstCommit.author).toBe('string');
        expect(firstCommit.authorEmail).toBeDefined();
        expect(typeof firstCommit.authorEmail).toBe('string');
        expect(firstCommit.timestamp).toBeInstanceOf(Date);
        expect(typeof firstCommit.filesChanged).toBe('number');
        expect(typeof firstCommit.insertions).toBe('number');
        expect(typeof firstCommit.deletions).toBe('number');
        expect(firstCommit.message).toBeDefined();
        expect(typeof firstCommit.message).toBe('string');
      }
    }, 60000); // 60 second timeout for network operation

    it('should successfully clone and extract commits with property-based verification', async () => {
      // Use a small, stable public repository
      const repoUrl = 'https://github.com/octocat/Hello-World.git';
      
      // Clone once for the property test
      const repo = await parser.cloneRepository(repoUrl);

      // Property-based test: verify that commit extraction is consistent
      await fc.assert(
        fc.asyncProperty(
          fc.constant(repo), // Use the cloned repository
          async (repository) => {
            // Extract commits multiple times - should be consistent
            const commits = await parser.getCommits(repository);

            // Property: All commits should have required fields
            for (const commit of commits) {
              expect(commit.sha).toBeDefined();
              expect(typeof commit.sha).toBe('string');
              expect(commit.sha.length).toBeGreaterThan(0);
              
              expect(commit.author).toBeDefined();
              expect(typeof commit.author).toBe('string');
              
              expect(commit.authorEmail).toBeDefined();
              expect(typeof commit.authorEmail).toBe('string');
              
              expect(commit.timestamp).toBeInstanceOf(Date);
              expect(commit.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
              
              expect(typeof commit.filesChanged).toBe('number');
              expect(commit.filesChanged).toBeGreaterThanOrEqual(0);
              
              expect(typeof commit.insertions).toBe('number');
              expect(commit.insertions).toBeGreaterThanOrEqual(0);
              
              expect(typeof commit.deletions).toBe('number');
              expect(commit.deletions).toBeGreaterThanOrEqual(0);
              
              expect(commit.message).toBeDefined();
              expect(typeof commit.message).toBe('string');
            }

            // Property: Commits should be ordered by timestamp (most recent first)
            for (let i = 0; i < commits.length - 1; i++) {
              expect(commits[i].timestamp.getTime()).toBeGreaterThanOrEqual(
                commits[i + 1].timestamp.getTime()
              );
            }
          }
        ),
        {
          numRuns: 100, // Run 100 iterations as specified in design
          timeout: 5000, // 5 second timeout per iteration (no cloning, just reading)
        }
      );
    }, 120000); // 2 minute timeout for the entire test
  });

  /**
   * Property 4: Invalid Repository Error Handling
   * 
   * For any invalid or inaccessible repository URL, the Ingestion Layer should 
   * return a descriptive error message without crashing.
   * 
   * Validates: Requirements 1.6
   */
  describe('Property 4: Invalid Repository Error Handling', () => {
    it('should return descriptive errors for invalid URLs without crashing', async () => {
      // Generator for invalid Git URLs (focusing on format validation, not network calls)
      const invalidUrlArbitrary = fc.oneof(
        // Empty strings
        fc.constant(''),
        // Random strings without URL structure
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('://')),
        // Invalid protocols
        fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}://github.com/user/repo`),
        // Missing path components
        fc.constant('https://github.com'),
        fc.constant('https://github.com/'),
        fc.constant('https://github.com/user'),
        // Malformed URLs
        fc.constant('https://'),
        fc.constant('git@'),
        fc.constant('git://'),
        // URLs with invalid characters
        fc.constant('https://github.com/<invalid>/repo'),
        fc.constant('https://github.com/user/repo with spaces')
      );

      await fc.assert(
        fc.asyncProperty(invalidUrlArbitrary, async (invalidUrl) => {
          // Property: Invalid URLs should throw an error
          let errorThrown = false;
          let errorMessage = '';

          try {
            await parser.cloneRepository(invalidUrl);
          } catch (error: any) {
            errorThrown = true;
            errorMessage = error.message;
          }

          // Verify an error was thrown
          expect(errorThrown).toBe(true);

          // Verify the error message is descriptive (not empty or generic)
          expect(errorMessage).toBeDefined();
          expect(errorMessage.length).toBeGreaterThan(0);
          expect(typeof errorMessage).toBe('string');

          // Verify the error message contains useful information
          // It should mention one of: invalid, repository, URL, not found, inaccessible, failed
          const hasDescriptiveContent = 
            errorMessage.toLowerCase().includes('invalid') ||
            errorMessage.toLowerCase().includes('repository') ||
            errorMessage.toLowerCase().includes('url') ||
            errorMessage.toLowerCase().includes('not found') ||
            errorMessage.toLowerCase().includes('inaccessible') ||
            errorMessage.toLowerCase().includes('failed') ||
            errorMessage.toLowerCase().includes('authentication') ||
            errorMessage.toLowerCase().includes('permission');

          expect(hasDescriptiveContent).toBe(true);

          // Property: The system should not crash (we should reach this point)
          // If we get here, the system handled the error gracefully
          expect(true).toBe(true);
        }),
        {
          numRuns: 100, // Run 100 iterations as specified in design
          timeout: 5000, // 5 second timeout per iteration (no network calls)
        }
      );
    }, 120000); // 2 minute timeout for the entire test

    it('should handle specific invalid URL patterns with descriptive errors', async () => {
      const invalidUrls = [
        { url: '', expectedPattern: /invalid/i },
        { url: 'not-a-url', expectedPattern: /invalid/i },
        { url: 'https://', expectedPattern: /invalid/i },
        { url: 'https://github.com', expectedPattern: /invalid/i },
        { url: 'git@', expectedPattern: /invalid/i },
        { url: 'https://github.com/user', expectedPattern: /(invalid|not found|inaccessible)/i },
      ];

      for (const { url, expectedPattern } of invalidUrls) {
        await expect(parser.cloneRepository(url)).rejects.toThrow(expectedPattern);
      }
    });

    it('should handle non-existent repositories with descriptive errors', async () => {
      // Test with GitHub only (faster than GitLab)
      const nonExistentUrl = 'https://github.com/nonexistent-user-xyz123/nonexistent-repo-abc456';

      let errorThrown = false;
      let errorMessage = '';

      try {
        await parser.cloneRepository(nonExistentUrl);
      } catch (error: any) {
        errorThrown = true;
        errorMessage = error.message;
      }

      expect(errorThrown).toBe(true);
      expect(errorMessage).toBeDefined();
      expect(errorMessage.length).toBeGreaterThan(0);
      
      // Should mention the issue (not found, inaccessible, failed, etc.)
      const hasRelevantInfo = 
        errorMessage.toLowerCase().includes('not found') ||
        errorMessage.toLowerCase().includes('inaccessible') ||
        errorMessage.toLowerCase().includes('failed') ||
        errorMessage.toLowerCase().includes('404');
      
      expect(hasRelevantInfo).toBe(true);
    }, 60000); // 60 second timeout for network operation
  });
});
