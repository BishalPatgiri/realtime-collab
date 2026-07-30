import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import type { PublicUser } from '@realtime-collab/shared';
import { verifyToken } from '../auth/jwt.js';
import { logger } from '../logger.js';
import { handleConnection, type Connection } from './connection.js';

/** How often to probe connections, and how long a silent peer may live. */
const HEARTBEAT_INTERVAL_MS = 30_000;

const WS_PATH = '/ws';

/** Pull the bearer token out of the `?token=` upgrade query parameter. */
function tokenFromRequest(req: IncomingMessage): string | undefined {
  const url = new URL(req.url ?? '', 'http://localhost');
  return url.searchParams.get('token') ?? undefined;
}

/** Reject an upgrade attempt with a minimal HTTP response, then close. */
function rejectUpgrade(socket: Duplex, status: number, message: string): void {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

/**
 * Attach a WebSocket server to an existing HTTP server, authenticating every
 * upgrade before a socket is accepted. We use `noServer` mode and drive the
 * upgrade by hand so an unauthenticated client is turned away with a 401
 * instead of ever reaching the connection handler.
 */
export function attachWebSocketServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    if (url.pathname !== WS_PATH) {
      rejectUpgrade(socket, 404, 'Not Found');
      return;
    }

    const user = verifyToken(tokenFromRequest(req));
    if (!user) {
      logger.warn('rejected unauthenticated WebSocket upgrade');
      rejectUpgrade(socket, 401, 'Unauthorized');
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, user);
    });
  });

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage, user: PublicUser) => {
    handleConnection(ws, user);
  });

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

  logger.info(`WebSocket server attached at ${WS_PATH}`);
  return wss;
}
