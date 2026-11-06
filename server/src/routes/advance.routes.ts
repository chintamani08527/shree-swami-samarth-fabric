import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin, requireSupervisorOrAdmin } from '../middleware/roles.js';
import {
  getWorkerAdvances,
  requestAdvance,
  listAllAdvances,
  createAdvance,
  updateAdvanceStatus,
  deleteAdvance,
} from '../services/advance.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// 1. Worker: View personal advances & summary
router.get('/me', async (req: Request, res: Response) => {
  try {
    const data = await getWorkerAdvances(req.user!.id);
    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Worker: Request an advance
router.post('/request', async (req: Request, res: Response) => {
  try {
    const { amount, reason } = req.body;
    if (!amount) {
      return res.status(400).json({ success: false, message: 'कृपया उचल रक्कम प्रविष्ट करा (Amount required)' });
    }
    const advance = await requestAdvance(req.user!.id, parseFloat(amount), reason);
    res.status(201).json({
      success: true,
      message: 'उचल मागणी यशस्वीरीत्या नोंदवली (Advance request submitted)',
      data: advance,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 3. Admin / Supervisor: Query all advances with stats & filters
router.get('/', requireSupervisorOrAdmin, async (req: Request, res: Response) => {
  try {
    const { workerId, userId, status, unit, startDate, endDate, page, limit } = req.query;

    const data = await listAllAdvances({
      workerId: workerId as string,
      userId: userId as string,
      status: status as string,
      unit: unit as string,
      startDate: startDate as string,
      endDate: endDate as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 50,
    });

    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Admin: Give/record advance to worker
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, amount, advanceDate, paymentMode, reason } = req.body;
    if (!userId || !amount) {
      return res.status(400).json({ success: false, message: 'कामगार आणि उचल रक्कम आवश्यक आहे (Worker and amount required)' });
    }

    const advance = await createAdvance({
      userId,
      amount: parseFloat(amount),
      advanceDate,
      paymentMode,
      reason,
      approvedBy: req.user!.name || req.user!.workerId || 'Admin',
    });

    res.status(201).json({
      success: true,
      message: 'कामगारास उचल यशस्वीरीत्या नोंदवली (Advance recorded successfully)',
      data: advance,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 5. Admin: Update advance status (Approve request, mark Deducted from salary, mark Repaid, Reject)
router.patch('/:id/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const updated = await updateAdvanceStatus(req.params.id, status, {
      rejectionReason,
      actorName: req.user!.name || req.user!.workerId || 'Admin',
    });

    res.json({
      success: true,
      message: 'उचल स्थिती अद्यतनित केली (Advance status updated)',
      data: updated,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 6. Admin: Delete advance record
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await deleteAdvance(req.params.id);
    res.json({
      success: true,
      message: 'उचल रेकॉर्ड हटवला (Advance record deleted)',
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
