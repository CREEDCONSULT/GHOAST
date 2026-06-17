import { getUnfollowQueue } from '../services/queue.service.js';
import { redis } from '../lib/redis.js';

function hasForceFlag(): boolean {
  return process.argv.includes('--force') || process.env.CONFIRM_QUEUE_CLEAR === 'true';
}

async function main(): Promise<void> {
  if (!hasForceFlag()) {
    throw new Error('Refusing to clear the queue without --force or CONFIRM_QUEUE_CLEAR=true.');
  }

  const queue = getUnfollowQueue();
  const before = await queue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed');

  await queue.drain(true);
  await queue.clean(0, 10_000, 'delayed');
  await queue.clean(0, 10_000, 'wait');
  await queue.clean(0, 10_000, 'failed');

  const after = await queue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed');

  console.log(JSON.stringify({ queue: queue.name, before, after }, null, 2));

  await queue.close();
  await redis.quit();
}

main().catch(async (err) => {
  console.error('Queue clear failed:', err);
  await redis.quit().catch(() => undefined);
  process.exit(1);
});
