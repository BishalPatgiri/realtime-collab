import express, { type Express } from 'express';
import { pinoHttp } from 'pino-http';
import { logger } from './logger.js';
import { healthRouter } from './routes/health.js';

/**
 * Builds the Express application. Kept separate from the server bootstrap so
 * it can be imported directly in tests without binding to a port.
 */
export function createApp(): Express {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(express.json());

  app.use(healthRouter);

  app.get('/', (_req, res) => {
    res.json({ name: 'realtime-collab', message: 'server up' });
  });

  // 404 fallback
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
