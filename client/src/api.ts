import type { PublicUser } from '@realtime-collab/shared';

export interface AuthResult {
  token: string;
  user: PublicUser;
}

async function authRequest(path: string, username: string, password: string): Promise<AuthResult> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? 'Request failed');
  }
  return body as AuthResult;
}

export const login = (username: string, password: string) =>
  authRequest('/auth/login', username, password);

export const register = (username: string, password: string) =>
  authRequest('/auth/register', username, password);
