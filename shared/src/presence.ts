import { z } from 'zod';
import type { PublicUser } from './protocol.js';

/**
 * Presence: who is in a room and where their cursor sits.
 *
 * A cursor is a range — `anchor` is where a selection started and `head` is
 * where it currently is. A collapsed selection (anchor === head) is a plain
 * caret. Positions are character offsets into the document.
 */
export const cursor = z.object({
  anchor: z.number().int().nonnegative(),
  head: z.number().int().nonnegative(),
});

export type Cursor = z.infer<typeof cursor>;

/**
 * One participant in a room. Keyed by connectionId rather than user id, so the
 * same user open in two tabs shows up as two distinct cursors.
 */
export interface PresenceMember {
  connectionId: string;
  user: PublicUser;
  cursor: Cursor | null;
}
