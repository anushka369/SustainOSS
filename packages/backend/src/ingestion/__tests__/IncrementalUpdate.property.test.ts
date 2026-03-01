import { RepositoryParser } from '../RepositoryParser';
import * as fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Feature: sustainoss
 * Property 3: Incremental Update Efficiency
 * 
 * For any repository that has been previously synced, a subsequent sync should 
 * only process commits, PRs, and issues created after the last sync timestamp.
 * 
 * Validates: Requirements 1.5
 */

describe('RepositoryParser - Incremental Update Property Tests', () => {
  let parser: RepositoryParser;
  const testWorkingDir = path.join(process.cwd(), 'test-repos-incremental-pbt');

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
   * Property 3: Incremental Update Efficiency
   * 
   * This property tests that subsequent syncs only process new data since the last sync.
   * We verify this by:
   * 1. Cloning a repository and getting all commits
   * 2. Using date filtering to simulate incremental updates
   * 3. Verifying that only commits after the filter date are returned
   */
  describe('Property 3: Incremental Update Efficiency', () => {
    it('should only return commits created after the specified since date', async () => {
      // Use a small, stable public repository
      const repoUrl = 'https://github.com/octocat/Hello-World.git';

      // Clone the repository
      const repo = await parser.cloneRepository(repoUrl);
      
      expect(repo).toBeDefined();
      expect(repo.id).toBeDefined();
      expect(repo.localPath).toBeDefined();

      // Get all commits (no date filter)
      const allCommits = await parser.getCommits(repo);
      
      expect(allCommits).toBeDefined();
      expect(Array.isArray(allCommits)).toBe(true);
      expect(allCommits.length).toBeGreaterThan(0);

      // Find a commit in the middle of the history to use as a filter date
      const middleIndex = Math.floor(allCommits.length / 2);
      const filterDate = allCommits[middleIndex].timestamp;

      // Get commits after the filter date (simulating incremental update)
      const incrementalCommits = await parser.getCommits(repo, filterDate);

      // Property: All incremental commits should have timestamps >= filter date
      for (const commit of incrementalCommits) {
        expect(commit.timestamp.getTime()).toBeGreaterThanOrEqual(
          filterDate.getTime()
        );
      }

      // Property: Incremental commits should be a subset of all commits
      expect(incrementalCommits.length).toBeLessThanOrEqual(allCommits.length);

      // Property: The number of incremental commits should be approximately half or less
      // (since we filtered from the middle)
      expect(incrementalCommits.length).toBeLessThanOrEqual(middleIndex + 1);
    }, 120000); // 2 minute timeout for network operations

    it('should verify incremental update with property-based date filtering', async () => {
      // Use a small, stable public repository
      const repoUrl = 'https://github.com/octocat/Hello-World.git';

      // Clone the repository
      const repo = await parser.cloneRepository(repoUrl);

      // Get all commits from the repository
      const allCommits = await parser.getCommits(repo);

      // Property-based test: For any date in the past, filtering by that date
      // should only return commits after that date
      const dateArbitrary = fc.date({
        min: new Date('2000-01-01'),
        max: new Date(),
      });

      await fc.assert(
        fc.asyncProperty(dateArbitrary, async (filterDate) => {
          // Get commits filtered by the generated date
          const filteredCommits = await parser.getCommits(repo, filterDate);

          // Property: All filtered commits should have timestamps after the filter date
          for (const commit of filteredCommits) {
            expect(commit.timestamp.getTime()).toBeGreaterThanOrEqual(
              filterDate.getTime()
            );
          }

          // Property: Filtered commits should be a subset of all commits
          expect(filteredCommits.length).toBeLessThanOrEqual(allCommits.length);

          // Property: If we filter by a date before all commits, we should get all commits
          if (allCommits.length > 0) {
            const oldestCommit = allCommits.reduce((oldest, commit) => {
              return commit.timestamp < oldest.timestamp ? commit : oldest;
            }, allCommits[0]);

            if (filterDate < oldestCommit.timestamp) {
              expect(filteredCommits.length).toBe(allCommits.length);
            }

            // Property: If we filter by a date after all commits, we should get no commits
            const newestCommit = allCommits.reduce((newest, commit) => {
              return commit.timestamp > newest.timestamp ? commit : newest;
            }, allCommits[0]);

            if (filterDate > newestCommit.timestamp) {
              expect(filteredCommits.length).toBe(0);
            }
          }
        }),
        {
          numRuns: 100, // Run 100 iterations as specified in design
          timeout: 5000, // 5 second timeout per iteration
        }
      );
    }, 180000); // 3 minute timeout for the entire test

    it('should return zero commits when filtering by current timestamp', async () => {
      // Use a small, stable public repository
      const repoUrl = 'https://github.com/octocat/Hello-World.git';

      // Clone the repository
      const repo = await parser.cloneRepository(repoUrl);

      // Get all commits
      const allCommits = await parser.getCommits(repo);
      expect(allCommits.length).toBeGreaterThan(0);

      // Filter by current timestamp (simulating a just-completed sync)
      const now = new Date();
      const recentCommits = await parser.getCommits(repo, now);

      // Property: For a stable repository, filtering by current time should return 0 commits
      // (no commits created in the future)
      expect(recentCommits.length).toBe(0);
    }, 120000); // 2 minute timeout

    it('should correctly filter commits across multiple date ranges', async () => {
      // Use a small, stable public repository
      const repoUrl = 'https://github.com/octocat/Hello-World.git';

      // Clone the repository
      const repo = await parser.cloneRepository(repoUrl);

      // Get all commits
      const allCommits = await parser.getCommits(repo);
      
      if (allCommits.length < 3) {
        // Skip test if repository doesn't have enough commits
        return;
      }

      // Sort commits by timestamp (oldest first)
      const sortedCommits = [...allCommits].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );

      // Test filtering at different points in history
      const testPoints = [
        sortedCommits[0].timestamp, // Oldest commit
        sortedCommits[Math.floor(sortedCommits.length / 3)].timestamp, // 1/3 through
        sortedCommits[Math.floor(sortedCommits.length / 2)].timestamp, // Middle
        sortedCommits[Math.floor((sortedCommits.length * 2) / 3)].timestamp, // 2/3 through
        sortedCommits[sortedCommits.length - 1].timestamp, // Newest commit
      ];

      for (const filterDate of testPoints) {
        const filtered = await parser.getCommits(repo, filterDate);

        // Property: All filtered commits should be after or equal to filter date
        for (const commit of filtered) {
          expect(commit.timestamp.getTime()).toBeGreaterThanOrEqual(
            filterDate.getTime()
          );
        }

        // Property: Count should match manual filtering
        const expectedCount = sortedCommits.filter(
          (c) => c.timestamp.getTime() >= filterDate.getTime()
        ).length;
        
        expect(filtered.length).toBe(expectedCount);
      }
    }, 180000); // 3 minute timeout
  });

  /**
   * Additional property: Verify that incremental updates preserve data integrity
   */
  describe('Property 3 Extension: Data Integrity in Incremental Updates', () => {
    it('should maintain consistent commit data across filtered queries', async () => {
      // Use a small, stable public repository
      const repoUrl = 'https://github.com/octocat/Hello-World.git';

      // Clone the repository
      const repo = await parser.cloneRepository(repoUrl);

      // Get all commits
      const allCommits = await parser.getCommits(repo);

      if (allCommits.length === 0) {
        return; // Skip if no commits
      }

      // Pick a commit from the middle
      const middleCommit = allCommits[Math.floor(allCommits.length / 2)];
      const filterDate = new Date(middleCommit.timestamp.getTime() - 1000); // 1 second before

      // Get filtered commits
      const filteredCommits = await parser.getCommits(repo, filterDate);

      // Find the same commit in filtered results
      const foundCommit = filteredCommits.find((c) => c.sha === middleCommit.sha);

      if (foundCommit) {
        // Property: Commit data should be identical regardless of filtering
        expect(foundCommit.sha).toBe(middleCommit.sha);
        expect(foundCommit.author).toBe(middleCommit.author);
        expect(foundCommit.authorEmail).toBe(middleCommit.authorEmail);
        expect(foundCommit.timestamp.getTime()).toBe(middleCommit.timestamp.getTime());
        expect(foundCommit.message).toBe(middleCommit.message);
        expect(foundCommit.filesChanged).toBe(middleCommit.filesChanged);
        expect(foundCommit.insertions).toBe(middleCommit.insertions);
        expect(foundCommit.deletions).toBe(middleCommit.deletions);
      }
    }, 120000); // 2 minute timeout

    it('should handle edge case of filtering by exact commit timestamp', async () => {
      // Use a small, stable public repository
      const repoUrl = 'https://github.com/octocat/Hello-World.git';

      // Clone the repository
      const repo = await parser.cloneRepository(repoUrl);

      // Get all commits
      const allCommits = await parser.getCommits(repo);

      if (allCommits.length === 0) {
        return; // Skip if no commits
      }

      // Pick a specific commit timestamp
      const targetCommit = allCommits[Math.floor(allCommits.length / 2)];
      const exactTimestamp = targetCommit.timestamp;

      // Filter by exact timestamp
      const filteredCommits = await parser.getCommits(repo, exactTimestamp);

      // Property: The target commit should be included (>= comparison)
      const found = filteredCommits.some((c) => c.sha === targetCommit.sha);
      expect(found).toBe(true);

      // Property: All commits should be >= the exact timestamp
      for (const commit of filteredCommits) {
        expect(commit.timestamp.getTime()).toBeGreaterThanOrEqual(
          exactTimestamp.getTime()
        );
      }
    }, 120000); // 2 minute timeout

    it('should verify incremental update efficiency with property-based testing', async () => {
      // Use a small, stable public repository
      const repoUrl = 'https://github.com/octocat/Hello-World.git';

      // Clone the repository
      const repo = await parser.cloneRepository(repoUrl);

      // Get all commits
      const allCommits = await parser.getCommits(repo);

      if (allCommits.length === 0) {
        return; // Skip if no commits
      }

      // Property-based test: Verify that filtering is monotonic
      // (later dates should return fewer or equal commits)
      const dateArbitrary = fc.tuple(
        fc.date({ min: new Date('2000-01-01'), max: new Date() }),
        fc.date({ min: new Date('2000-01-01'), max: new Date() })
      ).map(([d1, d2]) => {
        // Ensure d1 <= d2
        return d1 <= d2 ? [d1, d2] : [d2, d1];
      });

      await fc.assert(
        fc.asyncProperty(dateArbitrary, async ([earlierDate, laterDate]) => {
          const commitsFromEarlier = await parser.getCommits(repo, earlierDate);
          const commitsFromLater = await parser.getCommits(repo, laterDate);

          // Property: Filtering by a later date should return fewer or equal commits
          expect(commitsFromLater.length).toBeLessThanOrEqual(commitsFromEarlier.length);

          // Property: All commits from later filter should be in earlier filter
          for (const laterCommit of commitsFromLater) {
            const foundInEarlier = commitsFromEarlier.some(
              (c) => c.sha === laterCommit.sha
            );
            expect(foundInEarlier).toBe(true);
          }
        }),
        {
          numRuns: 100, // Run 100 iterations as specified in design
          timeout: 5000, // 5 second timeout per iteration
        }
      );
    }, 180000); // 3 minute timeout
  });
});
