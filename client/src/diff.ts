import type { TextOp } from '@realtime-collab/shared';

/**
 * Turn a before/after pair of strings into the minimal set of text ops that
 * transforms one into the other, by trimming the common prefix and suffix.
 *
 * A single edit (typing a char, pasting, selecting-and-replacing) collapses to
 * at most one delete followed by one insert — enough to keep collaborators in
 * sync for ordinary editing.
 */
export function diffToOps(prev: string, next: string): TextOp[] {
  if (prev === next) return [];

  let start = 0;
  const min = Math.min(prev.length, next.length);
  while (start < min && prev[start] === next[start]) start++;

  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--;
    endNext--;
  }

  const ops: TextOp[] = [];
  const removed = endPrev - start;
  const inserted = next.slice(start, endNext);
  if (removed > 0) ops.push({ kind: 'delete', index: start, length: removed });
  if (inserted.length > 0) ops.push({ kind: 'insert', index: start, text: inserted });
  return ops;
}
