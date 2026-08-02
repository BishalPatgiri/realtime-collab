import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import {
  PROTOCOL_VERSION,
  encodeServerMessage,
  parseClientMessage,
  type ClientMessage,
  type PublicUser,
  type ServerMessage,
} from '@realtime-collab/shared';
import { logger } from '../logger.js';
import { roomManager } from '../rooms/manager.js';

/**
 * A live client connection. We attach a little bookkeeping to the raw socket:
 * a stable id for logging/correlation, the authenticated user, and the
 * liveness flag the heartbeat uses.
 */
export interface Connection extends WebSocket {
  connectionId: string;
  user: PublicUser;
  isAlive: boolean;
  /** Ids of the rooms this connection has joined. */
  rooms: Set<string>;
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
export function handleConnection(socket: WebSocket, user: PublicUser): void {
  const conn = socket as Connection;
  conn.connectionId = randomUUID();
  conn.user = user;
  conn.isAlive = true;
  conn.rooms = new Set();

  const log = logger.child({ connectionId: conn.connectionId, userId: user.id });
  log.info({ username: user.username }, 'client connected');

  conn.on('pong', () => {
    conn.isAlive = true;
  });

  send(conn, {
    type: 'welcome',
    connectionId: conn.connectionId,
    protocolVersion: PROTOCOL_VERSION,
    serverTime: new Date().toISOString(),
    user,
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
    roomManager.leaveAll(conn);
    log.info({ code }, 'client disconnected');
  });

  conn.on('error', (err) => {
    log.error({ err }, 'connection error');
  });
}

function routeMessage(conn: Connection, message: ClientMessage, log: typeof logger): void {
  switch (message.type) {
    case 'ping':
      send(conn, { type: 'pong', serverTime: new Date().toISOString() });
      break;
    case 'echo':
      send(conn, { type: 'echo', payload: message.payload });
      break;
    case 'join': {
      const room = roomManager.join(message.roomId, conn);
      log.info({ roomId: message.roomId }, 'joined room');
      // Hand the joiner the current document so it starts in sync.
      send(conn, { type: 'joined', roomId: room.id, snapshot: room.snapshot() });
      break;
    }
    case 'leave':
      roomManager.leave(message.roomId, conn);
      log.info({ roomId: message.roomId }, 'left room');
      break;
    case 'doc:op': {
      const room = roomManager.get(message.roomId);
      if (!room || !conn.rooms.has(message.roomId)) {
        send(conn, { type: 'error', code: 'NOT_IN_ROOM', message: 'Join the room first' });
        return;
      }
      const revision = room.applyOp(message.op);
      // Fan the op out to everyone else editing the same document.
      room.broadcast(
        {
          type: 'doc:op',
          roomId: room.id,
          op: message.op,
          revision,
          authorId: conn.user.id,
        },
        conn,
      );
      break;
    }
    default: {
      // Exhaustiveness guard: adding a ClientMessage variant without handling
      // it here becomes a compile error.
      const _never: never = message;
      log.warn({ message: _never }, 'unhandled message type');
    }
  }
}
