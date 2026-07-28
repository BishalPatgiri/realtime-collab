import type { Server as HttpServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { logger } from '../logger.js';
import { handleConnection, type Connection } from './connection.js';

/** How often to probe connections, and how long a silent peer may live. */
const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Attach a WebSocket server to an existing HTTP server so both share a port.
 *
 * A heartbeat pings every connection on an interval; any socket that failed to
 * answer the previous ping is considered dead and terminated. This reclaims
 * connections dropped by flaky networks that never sent a proper close frame.
 */
export function attachWebSocketServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', handleConnection);

  const heartbeat = setInterval(() => {
    for (const client of wss.clients as Set<Connection>) {
      if (!client.isAlive) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => clearInterval(heartbeat));

  logger.info('WebSocket server attached at /ws');
  return wss;
}
