import { Redis } from 'ioredis';
import type {
  Cursor,
  DocumentSnapshot,
  PresenceMember,
  PublicUser,
  TextOp,
} from '@realtime-collab/shared';
import type { CollabBackend, RoomEnvelope, RoomEnvelopeHandler } from './backend.js';

const CHANNEL_PREFIX = 'room:';
const docKey = (roomId: string) => `doc:${roomId}`;
const presenceKey = (roomId: string) => `presence:${roomId}`;

/**
 * Apply a text op to a document hash atomically, server-side.
 *
 * Running the read-modify-write inside a single Lua script means concurrent ops
 * from different instances can't interleave and corrupt the content — Redis
 * executes the whole script without yielding. Returns the new revision.
 *
 * Note: Lua string indexing is byte-based, which matches JS string offsets for
 * ASCII. Multi-byte content would need offset translation; out of scope here.
 */
const APPLY_OP_LUA = `
local content = redis.call('HGET', KEYS[1], 'content')
if not content then content = '' end
local index = tonumber(ARGV[2])
if index < 0 then index = 0 end
if index > #content then index = #content end
local newContent
if ARGV[1] == 'insert' then
  newContent = string.sub(content, 1, index) .. ARGV[3] .. string.sub(content, index + 1)
else
  local endpos = index + tonumber(ARGV[3])
  if endpos > #content then endpos = #content end
  newContent = string.sub(content, 1, index) .. string.sub(content, endpos + 1)
end
redis.call('HSET', KEYS[1], 'content', newContent)
return redis.call('HINCRBY', KEYS[1], 'revision', 1)
`;

interface StoredPresence {
  user: PublicUser;
  cursor: Cursor | null;
}

/**
 * Redis-backed collaboration backend. Document and presence state live in Redis
 * so every instance sees the same source of truth, and room events fan out over
 * Redis Pub/Sub. A dedicated subscriber connection carries messages; a second
 * connection runs commands (a subscribed connection can't do anything else).
 */
export class RedisBackend implements CollabBackend {
  private readonly commands: Redis;
  private readonly subscriber: Redis;
  private handler: RoomEnvelopeHandler = () => {};
  private readonly subscribed = new Set<string>();

  constructor(url: string) {
    this.commands = new Redis(url, { maxRetriesPerRequest: null });
    this.subscriber = new Redis(url, { maxRetriesPerRequest: null });

    this.subscriber.on('message', (channel, payload) => {
      if (!channel.startsWith(CHANNEL_PREFIX)) return;
      const roomId = channel.slice(CHANNEL_PREFIX.length);
      this.handler(roomId, JSON.parse(payload) as RoomEnvelope);
    });
  }

  async getSnapshot(roomId: string): Promise<DocumentSnapshot> {
    const [content, revision] = await this.commands.hmget(docKey(roomId), 'content', 'revision');
    return { content: content ?? '', revision: revision ? Number(revision) : 0 };
  }

  async applyOp(roomId: string, op: TextOp): Promise<number> {
    const arg = op.kind === 'insert' ? op.text : String(op.length);
    const revision = await this.commands.eval(
      APPLY_OP_LUA,
      1,
      docKey(roomId),
      op.kind,
      String(op.index),
      arg,
    );
    return Number(revision);
  }

  async addPresence(roomId: string, member: PresenceMember): Promise<void> {
    const value: StoredPresence = { user: member.user, cursor: member.cursor };
    await this.commands.hset(presenceKey(roomId), member.connectionId, JSON.stringify(value));
  }

  async setCursor(roomId: string, connectionId: string, cursor: Cursor): Promise<void> {
    const raw = await this.commands.hget(presenceKey(roomId), connectionId);
    if (!raw) return;
    const value = JSON.parse(raw) as StoredPresence;
    value.cursor = cursor;
    await this.commands.hset(presenceKey(roomId), connectionId, JSON.stringify(value));
  }

  async removePresence(roomId: string, connectionId: string): Promise<void> {
    await this.commands.hdel(presenceKey(roomId), connectionId);
  }

  async getPresence(roomId: string): Promise<PresenceMember[]> {
    const entries = await this.commands.hgetall(presenceKey(roomId));
    return Object.entries(entries).map(([connectionId, raw]) => {
      const value = JSON.parse(raw) as StoredPresence;
      return { connectionId, user: value.user, cursor: value.cursor };
    });
  }

  async subscribe(roomId: string): Promise<void> {
    if (this.subscribed.has(roomId)) return;
    this.subscribed.add(roomId);
    await this.subscriber.subscribe(CHANNEL_PREFIX + roomId);
  }

  async unsubscribe(roomId: string): Promise<void> {
    if (!this.subscribed.delete(roomId)) return;
    await this.subscriber.unsubscribe(CHANNEL_PREFIX + roomId);
  }

  async publish(roomId: string, envelope: RoomEnvelope): Promise<void> {
    await this.commands.publish(CHANNEL_PREFIX + roomId, JSON.stringify(envelope));
  }

  onEnvelope(handler: RoomEnvelopeHandler): void {
    this.handler = handler;
  }

  async close(): Promise<void> {
    this.subscriber.disconnect();
    this.commands.disconnect();
  }
}
