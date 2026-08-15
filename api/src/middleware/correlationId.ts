import { NextFunction, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { config } from '../config';

/** Assigns/propagates a correlation ID across UI, API, APIM, agents, and audit. */
export function correlationId(req: Request, res: Response, next: NextFunction): void {
  const header = config.api.correlation.headerName;
  const incoming = req.header(header);
  req.correlationId = incoming && incoming.trim() ? incoming.trim() : uuid();
  res.setHeader(header, req.correlationId);
  next();
}
