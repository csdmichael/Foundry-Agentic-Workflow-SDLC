import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requestOtp, verifyOtp, authMeta } from '../services/auth.service';
import * as audit from '../services/audit.service';

export const authRouter = Router();

/** Public auth metadata for the UI (MSAL config + OTP availability). */
authRouter.get('/meta', (_req, res) => {
  res.json(authMeta());
});

authRouter.post('/otp/request', async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? '').trim();
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email required' });
      return;
    }
    const result = await requestOtp(email);
    await audit.record({
      actorType: 'system',
      actor: email,
      action: 'auth.otp.request',
      targetType: 'auth',
      targetId: email,
      correlationId: req.correlationId,
    });
    res.json({ requested: true, delivered: result.delivered });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/otp/verify', async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? '').trim();
    const code = String(req.body?.code ?? '').trim();
    const result = await verifyOtp(email, code);
    await audit.record({
      actorType: 'user',
      actor: email,
      action: 'auth.otp.verify',
      targetType: 'auth',
      targetId: email,
      correlationId: req.correlationId,
    });
    res.json({
      accessToken: result.token,
      tokenType: 'Bearer',
      expiresIn: result.expiresIn,
      user: result.user,
    });
  } catch (err) {
    next(err);
  }
});

/** Returns the current authenticated identity (validates Entra or app token). */
authRouter.get('/me', authenticate, (req, res) => {
  res.json({ user: req.authUser });
});
