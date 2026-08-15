import { NextFunction, Request, Response } from 'express';

/** Central error handler. Maps thrown errors with a `status` to HTTP codes. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const status = (err as { status?: number }).status ?? 500;
  const message = (err as { message?: string }).message ?? 'Internal server error';
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(`[${req.correlationId}]`, err);
  }
  res.status(status).json({ error: message, correlationId: req.correlationId });
}

/** 404 handler for unmatched routes. */
export function notFound(req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found', path: req.path });
}
