import { Router } from 'express';
import * as path from 'path';
import multer from 'multer';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { config } from '../config';
import * as audit from '../services/audit.service';

// Local disk upload for requirements / UX mockups. File type and size are
// validated against api.config.json. Real deployments should stream to Blob
// Storage; this local store is for dev/demo parity.
const storage = multer.diskStorage({
  destination: path.resolve(process.cwd(), config.integrations.localUpload.storageRoot),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.api.upload.maxFileSizeBytes },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (config.api.upload.allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${ext}`));
    }
  },
});

export const uploadsRouter = Router();

uploadsRouter.use(authenticate);

uploadsRouter.post('/', authorize('projects.create'), upload.array('files', 10), async (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[]) ?? [];
    const stored = files.map((f) => ({ name: f.originalname, storedAs: f.filename, size: f.size }));
    await audit.record({
      actorType: 'user',
      actor: req.authUser!.email,
      action: 'upload.requirements',
      targetType: 'upload',
      targetId: req.body?.projectId ?? 'unassigned',
      correlationId: req.correlationId,
      details: { count: stored.length },
    });
    res.json({ uploaded: stored });
  } catch (err) {
    next(err);
  }
});
