import type { PublicUser } from '@realtime-collab/shared';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by the authenticate middleware once a valid token is verified. */
      user?: PublicUser;
    }
  }
}

export {};
