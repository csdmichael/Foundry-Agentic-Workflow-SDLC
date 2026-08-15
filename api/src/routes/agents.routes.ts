import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import * as agents from '../services/agents.service';
import * as orchestrator from '../services/agentOrchestrator.service';
import * as audit from '../services/audit.service';

export const agentsRouter = Router();

agentsRouter.use(authenticate);

agentsRouter.get('/', authorize('agents.read'), (_req, res) => {
  res.json(agents.list());
});

agentsRouter.get('/runs', authorize('agents.read'), async (req, res, next) => {
  try {
    const workflowRunId = req.query.workflowRunId ? String(req.query.workflowRunId) : undefined;
    res.json(await orchestrator.listRuns(workflowRunId));
  } catch (err) {
    next(err);
  }
});

// Configure an agent (model, route, tools, guardrails, approval). Admin+.
agentsRouter.patch('/:agentId', authorize('agents.configure'), async (req, res, next) => {
  try {
    const updated = agents.update(req.params.agentId, req.body);
    await audit.record({
      actorType: 'user',
      actor: req.authUser!.email,
      action: 'agent.configure',
      targetType: 'agent',
      targetId: req.params.agentId,
      correlationId: req.correlationId,
      details: req.body,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
