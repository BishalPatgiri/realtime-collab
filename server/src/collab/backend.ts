import type {
  Cursor,
  DocumentSnapshot,
  PresenceMember,
  ServerMessage,
  TextOp,
} from '@realtime-collab/shared';

/**
 * A message to fan out to a room, plus the connection that originated it (so it
 * can be skipped on delivery — the author already reflects its own change).
 */
export interface RoomEnvelope {
  message: ServerMessage;
  excludeConnectionId?: string;
}

export type RoomEnvelopeHandler = (roomId: string, envelope: RoomEnvelope) => void;

/**
 * Everything the connection layer needs that must be shared across instances:
 * authoritative document state, the presence roster, and a room-scoped Pub/Sub
 * bus. The in-memory and Redis implementations are interchangeable — the rest
 * of the server never knows which one it is talking to.
 */
export interface CollabBackend {
  /** Current content + revision of a room's document. */
  getSnapshot(roomId: string): Promise<DocumentSnapshot>;
  /** Apply an op to the shared document and return the new revision. */
  applyOp(roomId: string, op: TextOp): Promise<number>;

  /** Add or replace a member in the room roster. */
  addPresence(roomId: string, member: PresenceMember): Promise<void>;
  /** Update one member's cursor. */
  setCursor(roomId: string, connectionId: string, cursor: Cursor): Promise<void>;
  /** Remove a member from the roster. */
  removePresence(roomId: string, connectionId: string): Promise<void>;
  /** The full roster for a room, across all instances. */
  getPresence(roomId: string): Promise<PresenceMember[]>;

  /** Start receiving this room's envelopes on the registered handler. */
  subscribe(roomId: string): Promise<void>;
  /** Stop receiving this room's envelopes. */
  unsubscribe(roomId: string): Promise<void>;
  /** Publish an envelope to every instance subscribed to the room. */
  publish(roomId: string, envelope: RoomEnvelope): Promise<void>;
  /** Register the single handler that delivers envelopes to local sockets. */
  onEnvelope(handler: RoomEnvelopeHandler): void;

  /** Release any connections/timers. */
  close(): Promise<void>;
}
