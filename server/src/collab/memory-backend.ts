import {
  applyTextOp,
  type Cursor,
  type DocumentSnapshot,
  type PresenceMember,
  type TextOp,
} from '@realtime-collab/shared';
import type { CollabBackend, RoomEnvelope, RoomEnvelopeHandler } from './backend.js';

interface DocState {
  content: string;
  revision: number;
}

/**
 * Single-instance backend. State lives in this process's memory and "publish"
 * simply hands the envelope straight to the local delivery handler. Behaviour is
 * identical to the Redis backend from the caller's point of view, which keeps
 * local development dependency-free.
 */
export class MemoryBackend implements CollabBackend {
  private docs = new Map<string, DocState>();
  private presence = new Map<string, Map<string, PresenceMember>>();
  private handler: RoomEnvelopeHandler = () => {};

  private doc(roomId: string): DocState {
    let doc = this.docs.get(roomId);
    if (!doc) {
      doc = { content: '', revision: 0 };
      this.docs.set(roomId, doc);
    }
    return doc;
  }

  private roster(roomId: string): Map<string, PresenceMember> {
    let roster = this.presence.get(roomId);
    if (!roster) {
      roster = new Map();
      this.presence.set(roomId, roster);
    }
    return roster;
  }

  async getSnapshot(roomId: string): Promise<DocumentSnapshot> {
    const doc = this.doc(roomId);
    return { content: doc.content, revision: doc.revision };
  }

  async applyOp(roomId: string, op: TextOp): Promise<number> {
    const doc = this.doc(roomId);
    doc.content = applyTextOp(doc.content, op);
    doc.revision += 1;
    return doc.revision;
  }

  async addPresence(roomId: string, member: PresenceMember): Promise<void> {
    this.roster(roomId).set(member.connectionId, member);
  }

  async setCursor(roomId: string, connectionId: string, cursor: Cursor): Promise<void> {
    const member = this.roster(roomId).get(connectionId);
    if (member) member.cursor = cursor;
  }

  async removePresence(roomId: string, connectionId: string): Promise<void> {
    const roster = this.presence.get(roomId);
    roster?.delete(connectionId);
    if (roster && roster.size === 0) this.presence.delete(roomId);
  }

  async getPresence(roomId: string): Promise<PresenceMember[]> {
    return [...this.roster(roomId).values()];
  }

  async subscribe(): Promise<void> {}
  async unsubscribe(): Promise<void> {}

  async publish(roomId: string, envelope: RoomEnvelope): Promise<void> {
    this.handler(roomId, envelope);
  }

  onEnvelope(handler: RoomEnvelopeHandler): void {
    this.handler = handler;
  }

  async close(): Promise<void> {}
}
