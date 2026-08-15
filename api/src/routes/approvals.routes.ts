import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import * as approvals from '../services/approval.service';

export const approvalsRouter = Router();

approvalsRouter.use(authenticate);

// The pending approval queue (any authenticated user can view their queue).
approvalsRouter.get('/pending', authorize('projects.read'), async (_req, res, next) => {
  try {
    res.json(await approvals.listPending());
  } catch (err) {
    next(err);
  }
});

approvalsRouter.get('/run/:runId', authorize('projects.read'), async (req, res, next) => {
  try {
    res.json(await approvals.listForRun(req.params.runId));
  } catch (err) {
    next(err);
  }
});

// Record a decision. Authorization is enforced twice: the capability check
// here, and the role-vs-requiredRole check inside approvals.decide().
approvalsRouter.post('/:gateId/decision', async (req, res, next) => {
  try {
    const gate = await approvals.decide(
      req.params.gateId,
      {
        decision: req.body?.decision,
        comments: req.body?.comments,
        delegatedTo: req.body?.delegatedTo,
        artifactRefs: req.body?.artifactRefs,
      },
      req.authUser!,
      req.correlationId,
    );
    res.json(gate);
  } catch (err) {
    next(err);
  }
});
