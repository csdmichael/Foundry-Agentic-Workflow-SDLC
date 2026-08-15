import { NextFunction, Request, Response } from 'express';
import { Capability, hasCapability } from '../services/rbac.service';

/**
 * Authorization middleware factory. Blocks the request server-side unless the
 * authenticated user's role grants the required capability. This guarantees
 * that bypassing the UI cannot bypass authorization.
 */
export function authorize(...capabilities: Capability[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.authUser;
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const ok = capabilities.every((c) => hasCapability(user.role, c));
    if (!ok) {
      res.status(403).json({ error: 'Forbidden: insufficient role', requiredCapabilities: capabilities });
      return;
    }
    next();
  };
}
