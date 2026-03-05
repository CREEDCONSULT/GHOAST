import { Redis } from 'ioredis';
import { logger } from './logger.js';

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL environment variable is required');
}

export const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy: () => null, // Fail once and stop — avoids retry storms when Redis is unreachable
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err: Error) => {
  // Redact any connection strings that might contain credentials
  const safeMsg = err.message.replace(/redis:\/\/[^@]+@/gi, 'redis://***@');
  logger.error({ err: { message: safeMsg } }, 'Redis error');
});

export async function verifyRedisConnection(): Promise<void> {
  const pong = await redis.ping();
  if (pong !== 'PONG') {
    throw new Error('Redis ping failed');
  }
}
