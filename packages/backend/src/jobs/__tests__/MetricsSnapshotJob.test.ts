import { MetricsSnapshotJob } from '../MetricsSnapshotJob';
import { Pool } from 'pg';
import { Job } from 'bull';

// Mock the dependencies
jest.mock('../../storage/RepositoryStore');
jest.mock('../../analytics/MetricsCalculator');
jest.mock('../../analytics/SustainabilityScorer');
jest.mock('../../analytics/TrendAnalyzer');

describe('MetricsSnapshotJob', () => {
  let metricsSnapshotJob: MetricsSnapshotJob;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = {} as any;
    metricsSnapshotJob = new MetricsSnapshotJob(mockPool);

    // Mock the internal dependencies
    (metricsSnapshotJob as any).repositoryStore = {
      findById: jest.fn(),
    };
    (metricsSnapshotJob as any).metricsCalculator = {
      calculatePRReviewsPerMaintainer: jest.fn(),
      calculateOpenIssuesPerMaintainer: jest.fn(),
      calculateAvgReviewTurnaround: jest.fn(),
      calculateContributionConcentration: jest.fn(),
      calculateContributorDiversity: jest.fn(),
      calculateRetentionRatio: jest.fn(),
    };
    (metricsSnapshotJob as any).sustainabilityScorer = {
      calculateSustainabilityIndex: jest.fn(),
    };
    (metricsSnapshotJob as any).trendAnalyzer = {
      store_snapshot: jest.fn(),
    };
  });

  describe('process', () => {
    it('should successfully create a metrics snapshot', async () => {
      const mockRepository = {
        id: 'repo-1',
        url: 'https://github.com/test/repo',
        name: 'test-repo',
        localPath: '/tmp/test-repo',
        lastSync: new Date(),
        createdAt: new Date(),
        maintainers: [],
      };

      (metricsSnapshotJob as any).repositoryStore.findById.mockResolvedValue(
        mockRepository
      );
      (metricsSnapshotJob as any).metricsCalculator.calculatePRReviewsPerMaintainer.mockResolvedValue(
        { alice: 10, bob: 5 }
      );
      (metricsSnapshotJob as any).metricsCalculator.calculateOpenIssuesPerMaintainer.mockResolvedValue(
        { alice: 3, bob: 2 }
      );
      (metricsSnapshotJob as any).metricsCalculator.calculateAvgReviewTurnaround.mockResolvedValue(
        { alice: 24, bob: 48 }
      );
      (metricsSnapshotJob as any).metricsCalculator.calculateContributionConcentration.mockResolvedValue(
        0.3
      );
      (metricsSnapshotJob as any).metricsCalculator.calculateContributorDiversity.mockResolvedValue(
        25
      );
      (metricsSnapshotJob as any).metricsCalculator.calculateRetentionRatio.mockResolvedValue(
        75
      );
      (metricsSnapshotJob as any).sustainabilityScorer.calculateSustainabilityIndex.mockResolvedValue(
        {
          overall_score: 72.5,
          contributor_diversity_score: 18,
          load_distribution_score: 20,
          response_time_score: 17.5,
          retention_score: 17,
          missing_metrics: [],
          timestamp: new Date(),
        }
      );
      (metricsSnapshotJob as any).trendAnalyzer.store_snapshot.mockResolvedValue(
        undefined
      );

      const job = {
        data: { repositoryId: 'repo-1' },
      } as Job;

      const result = await metricsSnapshotJob.process(job);

      expect(result.success).toBe(true);
      expect(result.repositoryId).toBe('repo-1');
      expect(result.metricsCount).toBeGreaterThan(0);
      expect((metricsSnapshotJob as any).trendAnalyzer.store_snapshot).toHaveBeenCalled();
    });

    it('should handle repository not found error', async () => {
      (metricsSnapshotJob as any).repositoryStore.findById.mockResolvedValue(null);

      const job = {
        data: { repositoryId: 'repo-1' },
      } as Job;

      const result = await metricsSnapshotJob.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Repository not found');
    });

    it('should handle metrics calculation errors gracefully', async () => {
      const mockRepository = {
        id: 'repo-1',
        url: 'https://github.com/test/repo',
        name: 'test-repo',
        localPath: '/tmp/test-repo',
        lastSync: new Date(),
        createdAt: new Date(),
        maintainers: [],
      };

      (metricsSnapshotJob as any).repositoryStore.findById.mockResolvedValue(
        mockRepository
      );
      (metricsSnapshotJob as any).metricsCalculator.calculatePRReviewsPerMaintainer.mockRejectedValue(
        new Error('Calculation failed')
      );

      const job = {
        data: { repositoryId: 'repo-1' },
      } as Job;

      const result = await metricsSnapshotJob.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
