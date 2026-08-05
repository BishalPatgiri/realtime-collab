import {
  encodeServerMessage,
  type ServerMessage,
} from '@realtime-collab/shared';
import { backend, type RoomEnvelope } from '../collab/index.js';
import type { Connection } from '../ws/connection.js';

/**
 * Tracks which local sockets belong to which rooms and turns cross-instance
 * envelopes into actual sends.
 *
 * Authoritative document and presence state live in the backend; this class
 * only knows about connections on *this* instance. It subscribes to a room's
 * Pub/Sub channel on the first local join and unsubscribes on the last leave,
 * so an instance only receives traffic for rooms it actually serves.
 */
class RoomManager {
  private localMembers = new Map<string, Set<Connection>>();

  constructor() {
    // Every envelope — whether it originated here or on another instance —
    // arrives through the backend and is delivered to matching local sockets.
    backend.onEnvelope((roomId, envelope) => this.deliver(roomId, envelope));
  }

  private members(roomId: string): Set<Connection> {
    let set = this.localMembers.get(roomId);
    if (!set) {
      set = new Set();
      this.localMembers.set(roomId, set);
    }
    return set;
  }

  /** Add a local connection to a room, subscribing on the first local member. */
  async join(roomId: string, conn: Connection): Promise<void> {
    const set = this.members(roomId);
    if (set.size === 0) {
      await backend.subscribe(roomId);
    }
    set.add(conn);
    conn.rooms.add(roomId);
  }

  /** Remove a local connection, unsubscribing once no local members remain. */
  async leave(roomId: string, conn: Connection): Promise<void> {
    const set = this.localMembers.get(roomId);
    if (!set) return;
    set.delete(conn);
    conn.rooms.delete(roomId);
    if (set.size === 0) {
      this.localMembers.delete(roomId);
      await backend.unsubscribe(roomId);
    }
  }

  isMember(roomId: string, conn: Connection): boolean {
    return this.localMembers.get(roomId)?.has(conn) ?? false;
  }

  /** Send an envelope's message to matching local sockets. */
  private deliver(roomId: string, envelope: RoomEnvelope): void {
    const set = this.localMembers.get(roomId);
    if (!set) return;
    const data = encodeServerMessage(envelope.message);
    for (const conn of set) {
      if (conn.connectionId === envelope.excludeConnectionId) continue;
      if (conn.readyState === conn.OPEN) conn.send(data);
    }
  }

  /** Convenience: publish a server message to a room via the backend. */
  async publish(roomId: string, message: ServerMessage, excludeConnectionId?: string): Promise<void> {
    await backend.publish(roomId, { message, excludeConnectionId });
  }
}

export const roomManager = new RoomManager();
