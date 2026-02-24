/**
 * Phase 0 — Redis Infrastructure Tests
 * Verifies Redis connection and basic BullMQ queue creation.
 */
import { redis, verifyRedisConnection } from '../../src/lib/redis.js';
import { Queue } from 'bullmq';
import { QUEUE_CONFIG } from '../../src/config/queue.js';

describe('Redis connection', () => {
  afterAll(async () => {
    await redis.quit();
  });

  it('connects to Redis successfully', async () => {
    const pong = await redis.ping();
    expect(pong).toBe('PONG');
  });

  it('verifyRedisConnection resolves without error', async () => {
    await expect(verifyRedisConnection()).resolves.toBeUndefined();
  });

  it('can create a BullMQ queue', async () => {
    const queue = new Queue(QUEUE_CONFIG.QUEUE_NAME_UNFOLLOW, {
      connection: redis,
    });
    const counts = await queue.getJobCounts();
    expect(counts).toBeDefined();
    await queue.close();
  });
});
