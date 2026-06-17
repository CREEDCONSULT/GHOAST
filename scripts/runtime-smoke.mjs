process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.DATABASE_URL ??= 'postgresql://ghoast:ghoast_dev@localhost:5432/ghoast';
process.env.JWT_SECRET ??= 'runtime-smoke-secret-at-least-32-chars';
process.env.JWT_REFRESH_SECRET ??= 'runtime-refresh-secret-at-least-32-chars';
process.env.SESSION_TOKEN_ENCRYPTION_KEY ??= 'a'.repeat(64);

await import('@ghoast/db');
await import('@ghoast/contracts');
await import('../apps/api/dist/server.js');

console.log('runtime imports ok');
