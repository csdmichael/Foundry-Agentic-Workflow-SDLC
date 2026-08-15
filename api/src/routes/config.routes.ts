import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { config } from '../config';
import { capabilitiesFor } from '../services/rbac.service';
import * as projects from '../services/projects.service';

export const configRouter = Router();

configRouter.use(authenticate);

// Non-secret configuration surfaced to the UI/admin. Secrets are never returned.
configRouter.get('/', authorize('config.manage'), (_req, res) => {
  res.json({
    apim: config.apim,
    integrations: config.integrations,
    guardrails: config.guardrails,
    persistence: { provider: config.persistence.provider },
    agentsDefaults: config.agents.defaults,
  });
});

// Capabilities for the current user — used by the UI to hide unauthorized nav.
configRouter.get('/capabilities', (req, res) => {
  res.json({ role: req.authUser!.role, capabilities: capabilitiesFor(req.authUser!.role) });
});

configRouter.get('/workflow-runs', authorize('projects.read'), async (_req, res, next) => {
  try {
    res.json(await projects.listRuns());
  } catch (err) {
    next(err);
  }
});
