import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import {
  PROTOCOL_VERSION,
  encodeServerMessage,
  parseClientMessage,
  type ServerMessage,
} from '@realtime-collab/shared';
import { logger } from '../logger.js';

/**
 * A live client connection. We attach a little bookkeeping to the raw socket:
 * a stable id for logging/correlation and the liveness flag the heartbeat uses.
 */
export interface Connection extends WebSocket {
  connectionId: string;
  isAlive: boolean;
}

/** Send a typed server message over a connection. */
export function send(conn: Connection, message: ServerMessage): void {
  conn.send(encodeServerMessage(message));
}

/**
 * Wire up a freshly accepted socket: assign it an id, greet it, and start
 * routing its messages. Message handling for later stages (auth, rooms, doc
 * ops) plugs into the switch below.
 */
export function handleConnection(socket: WebSocket): void {
  const conn = socket as Connection;
  conn.connectionId = randomUUID();
  conn.isAlive = true;

  const log = logger.child({ connectionId: conn.connectionId });
  log.info('client connected');

  conn.on('pong', () => {
    conn.isAlive = true;
  });

  send(conn, {
    type: 'welcome',
    connectionId: conn.connectionId,
    protocolVersion: PROTOCOL_VERSION,
    serverTime: new Date().toISOString(),
  });

  conn.on('message', (data) => {
    const parsed = parseClientMessage(data.toString());

    if (!parsed.ok) {
      log.warn({ reason: parsed.error }, 'rejected malformed message');
      send(conn, { type: 'error', code: 'BAD_MESSAGE', message: parsed.error });
      return;
    }

    routeMessage(conn, parsed.message, log);
  });

  conn.on('close', (code) => {
    log.info({ code }, 'client disconnected');
  });

  conn.on('error', (err) => {
    log.error({ err }, 'connection error');
  });
}

function routeMessage(
  conn: Connection,
  message: import('@realtime-collab/shared').ClientMessage,
  log: typeof logger,
): void {
  switch (message.type) {
    case 'ping':
      send(conn, { type: 'pong', serverTime: new Date().toISOString() });
      break;
    case 'echo':
      send(conn, { type: 'echo', payload: message.payload });
      break;
    default: {
      // Exhaustiveness guard: adding a ClientMessage variant without handling
      // it here becomes a compile error.
      const _never: never = message;
      log.warn({ message: _never }, 'unhandled message type');
    }
  }
}
