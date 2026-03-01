import Bull, { Queue, Job, JobOptions } from 'bull';

/**
 * Job queue configuration and management
 * Uses Bull for reliable job processing with retry logic
 * Requirements: 1.5, 6.1
 */

export interface JobQueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  defaultJobOptions?: JobOptions;
}

export class JobQueue {
  private queues: Map<string, Queue> = new Map();
  private config: JobQueueConfig;

  constructor(config?: JobQueueConfig) {
    this.config = config || {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2 seconds
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    };
  }

  /**
   * Get or create a queue by name
   */
  getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      const queue = new Bull(name, {
        redis: this.config.redis,
        defaultJobOptions: this.config.defaultJobOptions,
      });

      // Set up error handlers
      queue.on('error', (error) => {
        console.error(`Queue ${name} error:`, error);
      });

      queue.on('failed', (job, error) => {
        console.error(`Job ${job.id} in queue ${name} failed:`, error);
      });

      this.queues.set(name, queue);
    }

    return this.queues.get(name)!;
  }

  /**
   * Add a job to a queue
   */
  async addJob(
    queueName: string,
    jobName: string,
    data: any,
    options?: JobOptions
  ): Promise<Job> {
    const queue = this.getQueue(queueName);
    return queue.add(jobName, data, options);
  }

  /**
   * Schedule a repeating job
   */
  async scheduleRepeatingJob(
    queueName: string,
    jobName: string,
    data: any,
    cronExpression: string
  ): Promise<Job> {
    const queue = this.getQueue(queueName);
    return queue.add(jobName, data, {
      repeat: {
        cron: cronExpression,
      },
    });
  }

  /**
   * Process jobs in a queue
   */
  processJobs(
    queueName: string,
    jobName: string,
    processor: (job: Job) => Promise<any>,
    concurrency: number = 1
  ): void {
    const queue = this.getQueue(queueName);
    queue.process(jobName, concurrency, processor);
  }

  /**
   * Close all queues
   */
  async close(): Promise<void> {
    const closePromises = Array.from(this.queues.values()).map((queue) =>
      queue.close()
    );
    await Promise.all(closePromises);
    this.queues.clear();
  }

  /**
   * Get job counts for a queue
   */
  async getJobCounts(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.getQueue(queueName);
    return queue.getJobCounts();
  }

  /**
   * Remove all jobs from a queue
   */
  async cleanQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.empty();
  }
}

// Singleton instance
let jobQueueInstance: JobQueue | null = null;

export function getJobQueue(): JobQueue {
  if (!jobQueueInstance) {
    jobQueueInstance = new JobQueue();
  }
  return jobQueueInstance;
}

export function closeJobQueue(): Promise<void> {
  if (jobQueueInstance) {
    return jobQueueInstance.close();
  }
  return Promise.resolve();
}
