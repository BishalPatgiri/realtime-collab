import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(`HTTP server listening on http://localhost:${config.port} (${config.env})`);
});

/** Graceful shutdown so in-flight requests drain before the process exits. */
function shutdown(signal: string): void {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
