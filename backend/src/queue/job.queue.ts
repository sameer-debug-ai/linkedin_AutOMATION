import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../config/logger';

const connection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

connection.on('connect', () => logger.info('[Redis] Connected'));
connection.on('error', (err) => logger.error('[Redis] Error:', err));

export const automationQueue = new Queue('automation', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export { connection };
