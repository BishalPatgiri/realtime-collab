import { Router } from 'express';

/**
 * Liveness/readiness endpoint. Kept dependency-free so it stays green even
 * when downstream services (Redis, etc.) are degraded — those get their own
 * checks once they are wired in.
 */
export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});
