import Redis from 'ioredis';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379');

// Export globally structured Redis client for Next.js hot-reloading stability
const globalForRedis = global as unknown as { redis: Redis };

export const redis =
  globalForRedis.redis || new Redis(redisPort, redisHost);

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

/**
 * Attempts to acquire a distributed lock using SETNX.
 * @param key The unique key for the resource (e.g., component_id + time slot)
 * @param ttlSeconds Time-To-Live in seconds for the lock (e.g., 300 for 5 minutes)
 * @returns boolean indicating if the lock was successfully acquired
 */
export async function acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
  const result = await redis.set(key, 'LOCKED', 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}

/**
 * Releases a previously acquired distributed lock.
 * @param key The unique key for the resource
 */
export async function releaseLock(key: string): Promise<void> {
  await redis.del(key);
}
