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
import { backend } from '../collab/index.js';
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

    void routeMessage(conn, parsed.message, log).catch((err) => {
      log.error({ err }, 'failed to handle message');
      send(conn, { type: 'error', code: 'INTERNAL', message: 'Failed to process message' });
    });
  });

  conn.on('close', (code) => {
    // Tell each room's remaining members this connection is gone.
    void Promise.all([...conn.rooms].map((roomId) => leaveRoom(conn, roomId))).catch((err) =>
      log.error({ err }, 'error during disconnect cleanup'),
    );
    log.info({ code }, 'client disconnected');
  });

  conn.on('error', (err) => {
    log.error({ err }, 'connection error');
  });
}

/**
 * Remove a connection from a room and notify the remaining members. Shared by
 * the explicit `leave` message and disconnect cleanup so presence stays correct
 * either way. Presence removal and the notification go through the backend, so
 * members on other instances see the departure too.
 */
async function leaveRoom(conn: Connection, roomId: string): Promise<void> {
  if (!roomManager.isMember(roomId, conn)) return;
  await backend.removePresence(roomId, conn.connectionId);
  await roomManager.publish(
    roomId,
    { type: 'presence:leave', roomId, connectionId: conn.connectionId },
    conn.connectionId,
  );
  await roomManager.leave(roomId, conn);
}

async function routeMessage(
  conn: Connection,
  message: ClientMessage,
  log: typeof logger,
): Promise<void> {
  switch (message.type) {
    case 'ping':
      send(conn, { type: 'pong', serverTime: new Date().toISOString() });
      break;
    case 'echo':
      send(conn, { type: 'echo', payload: message.payload });
      break;
    case 'join': {
      const { roomId } = message;
      await roomManager.join(roomId, conn);
      await backend.addPresence(roomId, {
        connectionId: conn.connectionId,
        user: conn.user,
        cursor: null,
      });
      log.info({ roomId }, 'joined room');

      // Hand the joiner the current document and the full cross-instance roster.
      const [snapshot, members] = await Promise.all([
        backend.getSnapshot(roomId),
        backend.getPresence(roomId),
      ]);
      send(conn, { type: 'joined', roomId, snapshot });
      send(conn, { type: 'presence:sync', roomId, members });

      // Announce the newcomer to everyone else in the room, on any instance.
      await roomManager.publish(
        roomId,
        {
          type: 'presence:join',
          roomId,
          member: { connectionId: conn.connectionId, user: conn.user, cursor: null },
        },
        conn.connectionId,
      );
      break;
    }
    case 'leave':
      await leaveRoom(conn, message.roomId);
      log.info({ roomId: message.roomId }, 'left room');
      break;
    case 'cursor': {
      const { roomId, cursor } = message;
      if (!roomManager.isMember(roomId, conn)) return;
      await backend.setCursor(roomId, conn.connectionId, cursor);
      await roomManager.publish(
        roomId,
        { type: 'presence:cursor', roomId, connectionId: conn.connectionId, cursor },
        conn.connectionId,
      );
      break;
    }
    case 'doc:op': {
      const { roomId, op } = message;
      if (!roomManager.isMember(roomId, conn)) {
        send(conn, { type: 'error', code: 'NOT_IN_ROOM', message: 'Join the room first' });
        return;
      }
      const revision = await backend.applyOp(roomId, op);
      // Fan the op out to everyone else editing the same document, everywhere.
      await roomManager.publish(
        roomId,
        { type: 'doc:op', roomId, op, revision, authorId: conn.user.id },
        conn.connectionId,
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
