import { Router, Request, Response } from 'express';
import { listAuditLogs } from '../services/audit.service.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roles.js';

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { action, entityType, actorUserId, startDate, endDate, page, limit } = req.query;

    const result = await listAuditLogs({
      action: action as string,
      entityType: entityType as string,
      actorUserId: actorUserId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 25,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
