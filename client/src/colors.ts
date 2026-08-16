/**
 * Deterministic color per connection so a given collaborator keeps the same
 * hue everywhere (cursor, avatar, roster) without any server coordination.
 */
export function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 45%)`;
}

/** Initials for an avatar badge. */
export function initials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}
