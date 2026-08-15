import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import * as users from '../services/users.service';
import * as audit from '../services/audit.service';
import { AuthProvider, UserRole } from '../models';

export const usersRouter = Router();

usersRouter.use(authenticate);

// Reading the directory requires users.read (admin/app_owner).
usersRouter.get('/', authorize('users.read'), async (_req, res, next) => {
  try {
    res.json(await users.list());
  } catch (err) {
    next(err);
  }
});

// Creating/updating/removing users is App Owner only (users.manage).
usersRouter.post('/', authorize('users.manage'), async (req, res, next) => {
  try {
    const user = await users.createOrUpdate({
      email: String(req.body?.email ?? ''),
      name: String(req.body?.name ?? ''),
      role: req.body?.role as UserRole,
      provider: req.body?.provider as AuthProvider,
      disabled: Boolean(req.body?.disabled),
    });
    await audit.record({
      actorType: 'user',
      actor: req.authUser!.email,
      action: 'user.upsert',
      targetType: 'user',
      targetId: user.id,
      correlationId: req.correlationId,
      details: { role: user.role, provider: user.provider },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

usersRouter.delete('/:id', authorize('users.manage'), async (req, res, next) => {
  try {
    const removed = await users.remove(req.params.id);
    await audit.record({
      actorType: 'user',
      actor: req.authUser!.email,
      action: 'user.delete',
      targetType: 'user',
      targetId: req.params.id,
      correlationId: req.correlationId,
    });
    res.json({ removed });
  } catch (err) {
    next(err);
  }
});
