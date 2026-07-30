import { Router } from 'express';
import { z } from 'zod';
import { signToken } from '../auth/jwt.js';
import { createUser, verifyCredentials } from '../auth/users.js';
import { authenticate } from '../middleware/authenticate.js';

export const authRouter = Router();

const credentialsSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(8).max(128),
});

/** Register a new account and return a token so the client is logged in. */
authRouter.post('/auth/register', async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid username or password', details: parsed.error.flatten() });
    return;
  }

  try {
    const user = await createUser(parsed.data.username, parsed.data.password);
    res.status(201).json({ token: signToken(user), user });
  } catch {
    res.status(409).json({ error: 'Username already taken' });
  }
});

/** Exchange credentials for a JWT. */
authRouter.post('/auth/login', async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid username or password' });
    return;
  }

  const user = await verifyCredentials(parsed.data.username, parsed.data.password);
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  res.json({ token: signToken(user), user });
});

/** Return the currently authenticated user — handy for token validation. */
authRouter.get('/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});
