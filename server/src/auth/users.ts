import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { PublicUser } from '@realtime-collab/shared';

/**
 * A minimal in-memory user store. It is intentionally swappable for a real
 * database later: the rest of the app only depends on the exported functions,
 * not on where the records live.
 */
interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
}

const usersByUsername = new Map<string, UserRecord>();

const SALT_ROUNDS = 10;

function toPublic(user: UserRecord): PublicUser {
  return { id: user.id, username: user.username };
}

/** Create a new user. Throws if the username is already taken. */
export async function createUser(username: string, password: string): Promise<PublicUser> {
  const normalized = username.trim().toLowerCase();
  if (usersByUsername.has(normalized)) {
    throw new Error('Username already taken');
  }
  const record: UserRecord = {
    id: randomUUID(),
    username: username.trim(),
    passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
  };
  usersByUsername.set(normalized, record);
  return toPublic(record);
}

/** Return the user if the username/password pair is valid, otherwise null. */
export async function verifyCredentials(
  username: string,
  password: string,
): Promise<PublicUser | null> {
  const record = usersByUsername.get(username.trim().toLowerCase());
  if (!record) return null;
  const matches = await bcrypt.compare(password, record.passwordHash);
  return matches ? toPublic(record) : null;
}

/** Seed a couple of demo accounts so the app is usable out of the box. */
export async function seedDemoUsers(): Promise<void> {
  if (usersByUsername.size > 0) return;
  await createUser('alice', 'password123');
  await createUser('bob', 'password123');
}
