import {
  areInstagramActionsConfigured,
  isInstagramEmergencyStopped,
  setInstagramEmergencyStop,
} from '../config/action-policy.js';
import { redis } from '../lib/redis.js';

const command = process.argv[2];

try {
  if (command === 'stop') {
    await setInstagramEmergencyStop(true);
    console.log('Instagram emergency stop enabled.');
  } else if (command === 'resume') {
    await setInstagramEmergencyStop(false);
    console.log('Instagram emergency stop cleared.');
  } else if (command === 'status') {
    console.log(
      JSON.stringify({
        configured: areInstagramActionsConfigured(),
        emergencyStopped: await isInstagramEmergencyStopped(),
      }),
    );
  } else {
    console.error('Usage: instagram-actions <stop|resume|status>');
    process.exitCode = 1;
  }
} finally {
  await redis.quit();
}
