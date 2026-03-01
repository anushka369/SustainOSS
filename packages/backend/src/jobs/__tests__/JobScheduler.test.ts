import { JobScheduler } from '../JobScheduler';
import { Pool } from 'pg';
import { IngestionOrchestrator } from '../../ingestion/IngestionOrchestrator';
import { getJobQueue } from '../JobQueue';

jest.mock('../JobQueue');

describe('JobScheduler', () => {
  let jobScheduler: JobScheduler;
  let mockPool: jest.Mocked<Pool>;
  let mockIngestionOrchestrator: jest.Mocked<IngestionOrchestrator>;
  let mockJobQueue: any;

  beforeEach(() => {
    mockPool = {} as any;
    mockIngestionOrchestrator = {} as any;

    mockJobQueue = {
      processJobs: jest.fn(),
      getJobCounts: jest.fn(),
      addJob: jest.fn(),
      scheduleRepeatingJob: jest.fn(),
    };

    (getJobQueue as jest.Mock).mockReturnValue(mockJobQueue);

    jobScheduler = new JobScheduler(mockPool, mockIngestionOrchestrator);
  });

  describe('start', () => {
    it('should start processing jobs', () => {
      jobScheduler.start();

      expect(mockJobQueue.processJobs).toHaveBeenCalledWith(
        'repository-sync',
        'sync',
        expect.any(Function),
        2
      );
      expect(mockJobQueue.processJobs).toHaveBeenCalledWith(
        'metrics-snapshot',
        'snapshot',
        expect.any(Function),
        1
      );
    });

    it('should not start twice', () => {
      jobScheduler.start();
      jobScheduler.start();

      // Should only be called once per queue
      expect(mockJobQueue.processJobs).toHaveBeenCalledTimes(2);
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const mockStats = {
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
      };

      mockJobQueue.getJobCounts.mockResolvedValue(mockStats);

      const stats = await jobScheduler.getQueueStats();

      expect(stats).toBeDefined();
      expect(stats.repositorySync).toEqual(mockStats);
      expect(stats.metricsSnapshot).toEqual(mockStats);
    });
  });
});
