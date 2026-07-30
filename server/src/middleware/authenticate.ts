import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../auth/jwt.js';

/**
 * Guards REST routes: requires a valid `Authorization: Bearer <token>` header
 * and attaches the resolved user to `req.user`.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  req.user = user;
  next();
}
