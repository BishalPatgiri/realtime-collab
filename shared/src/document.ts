import { z } from 'zod';

/**
 * The document model. A document is plain text; edits are expressed as small
 * operations against it. Keeping the op set tiny (insert / delete) makes it
 * cheap to broadcast and trivial for any client to replay against its own copy.
 *
 * `applyTextOp` is pure and shared by both sides: the server applies ops to the
 * authoritative copy, and each client applies the same ops it receives. Because
 * everyone runs identical logic, their copies converge.
 */

export const insertOp = z.object({
  kind: z.literal('insert'),
  index: z.number().int().nonnegative(),
  text: z.string().max(4096),
});

export const deleteOp = z.object({
  kind: z.literal('delete'),
  index: z.number().int().nonnegative(),
  length: z.number().int().positive().max(4096),
});

export const textOp = z.discriminatedUnion('kind', [insertOp, deleteOp]);

export type TextOp = z.infer<typeof textOp>;

/** A point-in-time view of a document. */
export interface DocumentSnapshot {
  content: string;
  revision: number;
}

/**
 * Apply an operation to a document's content, clamping indices so a stale or
 * malformed op can never throw or read out of bounds — it just no-ops or
 * applies at the nearest valid position.
 */
export function applyTextOp(content: string, op: TextOp): string {
  const index = Math.min(Math.max(op.index, 0), content.length);
  if (op.kind === 'insert') {
    return content.slice(0, index) + op.text + content.slice(index);
  }
  const end = Math.min(index + op.length, content.length);
  return content.slice(0, index) + content.slice(end);
}
