import {
  applyTextOp,
  encodeServerMessage,
  type Cursor,
  type DocumentSnapshot,
  type PresenceMember,
  type ServerMessage,
  type TextOp,
} from '@realtime-collab/shared';
import type { Connection } from '../ws/connection.js';

/**
 * A single collaborative document, the set of connections editing it, and each
 * member's cursor.
 *
 * The room owns the authoritative content. Operations are applied here in the
 * order they arrive; the resulting revision number gives every member a shared
 * sense of ordering.
 */
export class Room {
  readonly id: string;
  private content = '';
  private revision = 0;
  readonly members = new Set<Connection>();
  /** Latest cursor per connection; null until the member first moves. */
  private cursors = new Map<string, Cursor | null>();

  constructor(id: string) {
    this.id = id;
  }

  snapshot(): DocumentSnapshot {
    return { content: this.content, revision: this.revision };
  }

  add(conn: Connection): void {
    this.members.add(conn);
    this.cursors.set(conn.connectionId, null);
  }

  remove(conn: Connection): void {
    this.members.delete(conn);
    this.cursors.delete(conn.connectionId);
  }

  get size(): number {
    return this.members.size;
  }

  setCursor(conn: Connection, cursor: Cursor): void {
    this.cursors.set(conn.connectionId, cursor);
  }

  /** Everyone currently present, with their latest cursor. */
  presence(): PresenceMember[] {
    return [...this.members].map((conn) => ({
      connectionId: conn.connectionId,
      user: conn.user,
      cursor: this.cursors.get(conn.connectionId) ?? null,
    }));
  }

  /** Apply an op to the authoritative content and return the new revision. */
  applyOp(op: TextOp): number {
    this.content = applyTextOp(this.content, op);
    this.revision += 1;
    return this.revision;
  }

  /** Send a message to every member except the optionally excluded one. */
  broadcast(message: ServerMessage, except?: Connection): void {
    const data = encodeServerMessage(message);
    for (const member of this.members) {
      if (member === except) continue;
      if (member.readyState === member.OPEN) {
        member.send(data);
      }
    }
  }
}
