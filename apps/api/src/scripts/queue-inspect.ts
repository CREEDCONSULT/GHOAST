import { getUnfollowQueue } from '../services/queue.service.js';
import { redis } from '../lib/redis.js';
import type { JobType } from 'bullmq';

const JOB_STATES: JobType[] = ['waiting', 'active', 'delayed', 'completed', 'failed'];

async function main(): Promise<void> {
  const queue = getUnfollowQueue();
  const counts = await queue.getJobCounts(...JOB_STATES);
  const jobs = await queue.getJobs(JOB_STATES, 0, 49, false);

  console.log(JSON.stringify({
    queue: queue.name,
    counts,
    jobs: jobs.map((job) => ({
      id: job.id,
      name: job.name,
      accountId: job.data.accountId,
      ghostId: job.data.ghostId,
      attemptsMade: job.attemptsMade,
      delay: job.delay,
      timestamp: job.timestamp,
      failedReason: job.failedReason,
    })),
  }, null, 2));

  await queue.close();
  await redis.quit();
}

main().catch(async (err) => {
  console.error('Queue inspect failed:', err);
  await redis.quit().catch(() => undefined);
  process.exit(1);
});
