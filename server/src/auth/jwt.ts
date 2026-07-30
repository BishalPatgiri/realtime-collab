import jwt from 'jsonwebtoken';
import type { PublicUser } from '@realtime-collab/shared';
import { config } from '../config.js';

/** Claims we embed in the signed token. */
export interface TokenClaims {
  sub: string;
  username: string;
}

/** Issue a signed JWT for an authenticated user. */
export function signToken(user: PublicUser): string {
  const claims: TokenClaims = { sub: user.id, username: user.username };
  return jwt.sign(claims, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Verify a token and return the user it represents, or null if the token is
 * missing, malformed, expired, or signed with the wrong secret.
 */
export function verifyToken(token: string | undefined): PublicUser | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as TokenClaims;
    return { id: decoded.sub, username: decoded.username };
  } catch {
    return null;
  }
}
