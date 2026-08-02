import { applyTextOp, encodeServerMessage, type DocumentSnapshot, type ServerMessage, type TextOp } from '@realtime-collab/shared';
import type { Connection } from '../ws/connection.js';

/**
 * A single collaborative document and the set of connections editing it.
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

  constructor(id: string) {
    this.id = id;
  }

  snapshot(): DocumentSnapshot {
    return { content: this.content, revision: this.revision };
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
