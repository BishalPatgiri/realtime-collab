import type { Connection } from '../ws/connection.js';
import { Room } from './room.js';

/**
 * Owns the set of live rooms. Rooms are created lazily on first join and
 * discarded once the last member leaves, so empty rooms don't leak memory.
 *
 * This is the single-instance source of truth. Stage 7 layers Redis Pub/Sub on
 * top so multiple server instances share the same logical rooms.
 */
class RoomManager {
  private rooms = new Map<string, Room>();

  private getOrCreate(roomId: string): Room {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new Room(roomId);
      this.rooms.set(roomId, room);
    }
    return room;
  }

  get(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /** Add a connection to a room, creating the room if needed. */
  join(roomId: string, conn: Connection): Room {
    const room = this.getOrCreate(roomId);
    room.add(conn);
    conn.rooms.add(roomId);
    return room;
  }

  /** Remove a connection from a room, discarding the room if it empties. */
  leave(roomId: string, conn: Connection): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.remove(conn);
    conn.rooms.delete(roomId);
    if (room.size === 0) {
      this.rooms.delete(roomId);
    }
  }

  /** Remove a connection from every room it belongs to (used on disconnect). */
  leaveAll(conn: Connection): void {
    for (const roomId of conn.rooms) {
      this.leave(roomId, conn);
    }
  }
}

export const roomManager = new RoomManager();
