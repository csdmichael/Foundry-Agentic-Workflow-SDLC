import { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { verifyBearer } from '../services/auth.service';

/**
 * Authentication middleware. Validates the Bearer token (Entra RS256 or app
 * HS256) and attaches req.authUser. Honors AUTH_ALLOW_ANONYMOUS for local dev.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');

  if ((!token || scheme?.toLowerCase() !== 'bearer') && config.flags.allowAnonymous) {
    // DEV/DEMO ONLY: synthesize an app_owner identity.
    req.authUser = {
      sub: 'anonymous',
      email: 'anonymous@localhost',
      name: 'Anonymous (dev)',
      provider: 'email-otp',
      isInternal: false,
      role: 'app_owner',
    };
    next();
    return;
  }

  if (!token || scheme?.toLowerCase() !== 'bearer') {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  try {
    req.authUser = await verifyBearer(token);
    next();
  } catch (err) {
    const status = (err as { status?: number }).status ?? 401;
    res.status(status).json({ error: 'Invalid or expired token' });
  }
}
