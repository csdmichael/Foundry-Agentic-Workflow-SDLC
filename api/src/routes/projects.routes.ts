import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import * as projects from '../services/projects.service';
import * as orchestrator from '../services/agentOrchestrator.service';
import * as approvals from '../services/approval.service';

export const projectsRouter = Router();

projectsRouter.use(authenticate);

projectsRouter.get('/', authorize('projects.read'), async (_req, res, next) => {
  try {
    res.json(await projects.list());
  } catch (err) {
    next(err);
  }
});

projectsRouter.get('/:id', authorize('projects.read'), async (req, res, next) => {
  try {
    const project = await projects.getById(req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    const run = await projects.getRunForProject(project.id);
    const artifacts = await orchestrator.listArtifacts(project.id);
    const gates = run ? await approvals.listForRun(run.id) : [];
    const agentRuns = run ? await orchestrator.listRuns(run.id) : [];
    res.json({ project, run, gates, artifacts, agentRuns });
  } catch (err) {
    next(err);
  }
});

projectsRouter.post('/', authorize('projects.create'), async (req, res, next) => {
  try {
    const project = await projects.create(req.body, req.authUser!, req.correlationId);
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

projectsRouter.post('/:id/submit', authorize('projects.create'), async (req, res, next) => {
  try {
    const run = await projects.submit(req.params.id, req.authUser!, req.correlationId);
    res.status(201).json(run);
  } catch (err) {
    next(err);
  }
});

projectsRouter.post('/:id/archive', authorize('projects.manage'), async (req, res, next) => {
  try {
    const project = await projects.archive(req.params.id, req.authUser!, req.correlationId);
    res.json(project);
  } catch (err) {
    next(err);
  }
});

// Run an agent for the project's current workflow run. Enforces approval gates
// server-side via the orchestrator (cannot be bypassed by calling directly).
projectsRouter.post('/:id/agents/:agentId/run', authorize('agents.run'), async (req, res, next) => {
  try {
    const run = await projects.getRunForProject(req.params.id);
    if (!run) {
      res.status(409).json({ error: 'Project has no workflow run. Submit it first.' });
      return;
    }
    const agentRun = await orchestrator.runAgent(
      {
        workflowRunId: run.id,
        projectId: req.params.id,
        agentId: req.params.agentId,
        prompt: String(req.body?.prompt ?? 'Generate outputs for this lifecycle stage.'),
      },
      req.authUser!,
      req.correlationId,
    );
    res.status(201).json(agentRun);
  } catch (err) {
    next(err);
  }
});
