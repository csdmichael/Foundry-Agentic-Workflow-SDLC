import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import * as audit from '../services/audit.service';

export const auditRouter = Router();

auditRouter.use(authenticate);

auditRouter.get('/', authorize('audit.read'), async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 200;
    res.json(await audit.list(limit));
  } catch (err) {
    next(err);
  }
});

auditRouter.get('/run/:runId', authorize('audit.read'), async (req, res, next) => {
  try {
    res.json(await audit.listForWorkflowRun(req.params.runId));
  } catch (err) {
    next(err);
  }
});
