import { config } from '../config.js';
import { logger } from '../logger.js';
import type { CollabBackend } from './backend.js';
import { MemoryBackend } from './memory-backend.js';
import { RedisBackend } from './redis-backend.js';

/**
 * Pick the collaboration backend from configuration. With REDIS_URL set the
 * server is horizontally scalable; without it, it runs as a single in-memory
 * instance. The rest of the app depends only on the CollabBackend interface.
 */
export const backend: CollabBackend = config.redisUrl
  ? new RedisBackend(config.redisUrl)
  : new MemoryBackend();

logger.info(`collaboration backend: ${config.redisUrl ? 'redis' : 'memory'}`);

export type { CollabBackend, RoomEnvelope } from './backend.js';
