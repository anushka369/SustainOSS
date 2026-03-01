import { JobQueue } from '../JobQueue';

// These tests require Redis to be running
// Skip if Redis is not available
describe('JobQueue', () => {
  let jobQueue: JobQueue;
  let redisAvailable = false;

  beforeAll(async () => {
    try {
      jobQueue = new JobQueue({
        redis: {
          host: 'localhost',
          port: 6379,
        },
      });
      // Try to get a queue to test connection
      const testQueue = jobQueue.getQueue('connection-test');
      await testQueue.isReady();
      redisAvailable = true;
      await jobQueue.cleanQueue('connection-test');
    } catch (error) {
      console.log('Redis not available, skipping JobQueue tests');
      redisAvailable = false;
    }
  });

  afterAll(async () => {
    if (redisAvailable && jobQueue) {
      await jobQueue.close();
    }
  });

  describe('getQueue', () => {
    it('should create a new queue if it does not exist', () => {
      if (!redisAvailable) {
        console.log('Skipping test: Redis not available');
        return;
      }
      const queue = jobQueue.getQueue('test-queue');
      expect(queue).toBeDefined();
      expect(queue.name).toBe('test-queue');
    });

    it('should return the same queue instance for the same name', () => {
      if (!redisAvailable) {
        console.log('Skipping test: Redis not available');
        return;
      }
      const queue1 = jobQueue.getQueue('test-queue');
      const queue2 = jobQueue.getQueue('test-queue');
      expect(queue1).toBe(queue2);
    });
  });

  describe('addJob', () => {
    it('should add a job to the queue', async () => {
      if (!redisAvailable) {
        console.log('Skipping test: Redis not available');
        return;
      }
      const job = await jobQueue.addJob('test-queue', 'test-job', { data: 'test' });
      expect(job).toBeDefined();
      expect(job.name).toBe('test-job');
      expect(job.data).toEqual({ data: 'test' });
    });

    it('should add a job with custom options', async () => {
      if (!redisAvailable) {
        console.log('Skipping test: Redis not available');
        return;
      }
      const job = await jobQueue.addJob(
        'test-queue',
        'test-job',
        { data: 'test' },
        { delay: 1000 }
      );
      expect(job).toBeDefined();
      expect(job.opts.delay).toBe(1000);
    });
  });

  describe('scheduleRepeatingJob', () => {
    it('should schedule a repeating job with cron expression', async () => {
      if (!redisAvailable) {
        console.log('Skipping test: Redis not available');
        return;
      }
      const job = await jobQueue.scheduleRepeatingJob(
        'test-queue',
        'test-job',
        { data: 'test' },
        '0 0 * * *'
      );
      expect(job).toBeDefined();
      expect(job.opts.repeat).toBeDefined();
      // Check that repeat options exist (cron property may vary by Bull version)
      expect(job.opts.repeat).toHaveProperty('cron');
    });
  });

  describe('getJobCounts', () => {
    it('should return job counts for a queue', async () => {
      if (!redisAvailable) {
        console.log('Skipping test: Redis not available');
        return;
      }
      await jobQueue.addJob('test-queue', 'test-job', { data: 'test' });
      const counts = await jobQueue.getJobCounts('test-queue');
      expect(counts).toBeDefined();
      expect(typeof counts.waiting).toBe('number');
      expect(typeof counts.active).toBe('number');
      expect(typeof counts.completed).toBe('number');
      expect(typeof counts.failed).toBe('number');
      expect(typeof counts.delayed).toBe('number');
    });
  });

  describe('processJobs', () => {
    it('should process jobs in the queue', async () => {
      if (!redisAvailable) {
        console.log('Skipping test: Redis not available');
        return;
      }
      const processor = jest.fn().mockResolvedValue({ success: true });
      
      jobQueue.processJobs('test-queue', 'test-job', processor);
      
      await jobQueue.addJob('test-queue', 'test-job', { data: 'test' });
      
      // Wait for job to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      expect(processor).toHaveBeenCalled();
    });
  });
});
