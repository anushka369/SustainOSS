import { RepositoryParser } from '../RepositoryParser';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('RepositoryParser', () => {
  let parser: RepositoryParser;
  const testWorkingDir = path.join(process.cwd(), 'test-repos');

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

  describe('URL validation', () => {
    it('should reject invalid URLs', async () => {
      await expect(
        parser.cloneRepository('not-a-url')
      ).rejects.toThrow('Invalid Git repository URL');
    });

    it('should reject empty URLs', async () => {
      await expect(
        parser.cloneRepository('')
      ).rejects.toThrow('Invalid Git repository URL');
    });
  });

  describe('Error handling', () => {
    it('should provide descriptive error for non-existent repository', async () => {
      await expect(
        parser.cloneRepository('https://github.com/nonexistent/repo-that-does-not-exist-12345')
      ).rejects.toThrow(/not found|inaccessible/i);
    }, 30000); // Increase timeout for network request
  });
});
