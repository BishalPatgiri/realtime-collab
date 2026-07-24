import { pino } from 'pino';
import { config } from './config.js';

/**
 * Application-wide structured logger.
 *
 * In development we pretty-print for readability; in production we emit
 * newline-delimited JSON that ships cleanly to a log aggregator.
 */
export const logger = pino({
  level: config.logLevel,
  transport: config.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
});
