/**
 * Agentic SDLC / Software Factory API entrypoint.
 * Wires middleware (correlation ID, security headers, CORS), routes, seed
 * users, and the central error handler.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import './middleware/types';
import { config } from './config';
import { correlationId } from './middleware/correlationId';
import { errorHandler, notFound } from './middleware/errorHandler';
import { ensureSeedUsers } from './services/users.service';

import { authRouter } from './routes/auth.routes';
import { usersRouter } from './routes/users.routes';
import { projectsRouter } from './routes/projects.routes';
import { approvalsRouter } from './routes/approvals.routes';
import { agentsRouter } from './routes/agents.routes';
import { auditRouter } from './routes/audit.routes';
import { configRouter } from './routes/config.routes';
import { uploadsRouter } from './routes/uploads.routes';

export function createApp(): express.Express {
  const app = express();
  app.use(helmet());
  app.use(
    cors({
      origin: config.api.service.corsAllowedOrigins,
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', config.api.correlation.headerName],
      exposedHeaders: [config.api.correlation.headerName],
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(correlationId);

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: config.api.service.name }));

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/approvals', approvalsRouter);
  app.use('/api/agents', agentsRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/config', configRouter);
  app.use('/api/uploads', uploadsRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

async function main(): Promise<void> {
  await ensureSeedUsers();
  const app = createApp();
  const port = config.api.service.port;
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Agentic SDLC API listening on :${port} (persistence=${config.persistence.provider})`);
    if (config.flags.allowAnonymous) {
      // eslint-disable-next-line no-console
      console.warn('AUTH_ALLOW_ANONYMOUS=1 — all requests run as app_owner. DEV ONLY.');
    }
  });
}

if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}
