import { AuthUser } from '../models';

// Augment Express Request with authenticated user and correlation ID.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
      authUser?: AuthUser;
    }
  }
}

export {};
