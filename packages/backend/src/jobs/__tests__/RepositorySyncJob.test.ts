import { RepositorySyncJob } from '../RepositorySyncJob';
import { IngestionOrchestrator } from '../../ingestion/IngestionOrchestrator';
import { Job } from 'bull';

describe('RepositorySyncJob', () => {
  let repositorySyncJob: RepositorySyncJob;
  let mockIngestionOrchestrator: jest.Mocked<IngestionOrchestrator>;

  beforeEach(() => {
    mockIngestionOrchestrator = {
      syncRepository: jest.fn(),
    } as any;

    repositorySyncJob = new RepositorySyncJob(mockIngestionOrchestrator);
  });

  describe('process', () => {
    it('should successfully sync a repository', async () => {
      const mockSyncResult = {
        repository: {
          id: 'repo-1',
          url: 'https://github.com/test/repo',
          name: 'test-repo',
          localPath: '/tmp/test-repo',
          lastSync: new Date(),
          createdAt: new Date(),
          maintainers: [],
        },
        newCommits: 10,
        newPRs: 5,
        newIssues: 3,
        syncedAt: new Date(),
      };

      mockIngestionOrchestrator.syncRepository.mockResolvedValue(mockSyncResult);

      const job = {
        data: { repositoryId: 'repo-1' },
      } as Job;

      const result = await repositorySyncJob.process(job);

      expect(result.success).toBe(true);
      expect(result.repositoryId).toBe('repo-1');
      expect(result.newCommits).toBe(10);
      expect(result.newPRs).toBe(5);
      expect(result.newIssues).toBe(3);
      expect(mockIngestionOrchestrator.syncRepository).toHaveBeenCalledWith('repo-1');
    });

    it('should handle sync errors gracefully', async () => {
      mockIngestionOrchestrator.syncRepository.mockRejectedValue(
        new Error('Sync failed')
      );

      const job = {
        data: { repositoryId: 'repo-1' },
      } as Job;

      const result = await repositorySyncJob.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Sync failed');
      expect(result.newCommits).toBe(0);
      expect(result.newPRs).toBe(0);
      expect(result.newIssues).toBe(0);
    });
  });
});
