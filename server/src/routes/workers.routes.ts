import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  listWorkers,
  getWorkerById,
  createWorker,
  updateWorker,
  deactivateWorker,
  resetWorkerCredentials,
} from '../services/worker.service.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin, requireSupervisorOrAdmin } from '../middleware/roles.js';
import { validate } from '../middleware/validate.js';
import { Roles } from '../config/index.js';

const router = Router();

// Require auth for all worker routes
router.use(authenticate);

const createWorkerSchema = z.object({
  body: z.object({
    workerId: z.string().min(2, 'Worker ID must be at least 2 characters'),
    name: z.string().min(2, 'Full name is required'),
    phone: z.string().optional(),
    passwordOrPin: z.string().min(4, 'PIN/Password must be at least 4 characters'),
    role: z.enum([Roles.SUPER_ADMIN, Roles.ADMIN, Roles.SUPERVISOR, Roles.WORKER]).optional(),
    departmentId: z.string().optional(),
    shiftId: z.string().optional(),
    wageType: z.enum(['FIXED', 'CUSTOM']).optional(),
    dailyWage: z.number().nullable().optional(),
    customWageRate: z.number().nullable().optional(),
    hasCustomWageAccess: z.boolean().optional(),
    unit: z.string().optional(),
    joiningDate: z.string().optional(),
  }),
});

// List workers: Admin & Supervisor
router.get('/', requireSupervisorOrAdmin, async (req: Request, res: Response) => {
  try {
    const { search, departmentId, role, isActive, unit, page, limit } = req.query;

    // If supervisor, only allow viewing their assigned department if assigned
    let targetDeptId = departmentId as string | undefined;
    if (req.user?.role === Roles.SUPERVISOR && req.user.departmentId) {
      targetDeptId = req.user.departmentId;
    }

    const result = await listWorkers({
      search: search as string,
      departmentId: targetDeptId,
      role: role as any,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      unit: unit as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single worker
router.get('/:id', requireSupervisorOrAdmin, async (req: Request, res: Response) => {
  try {
    const worker = await getWorkerById(req.params.id);
    res.json({ success: true, data: worker });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message });
  }
});

// Create worker (Admin only)
router.post('/', requireAdmin, validate(createWorkerSchema), async (req: Request, res: Response) => {
  try {
    const newWorker = await createWorker(req.body, {
      id: req.user!.id,
      name: req.user!.name,
    });

    res.status(201).json({
      success: true,
      message: `Worker ${newWorker.name} (${newWorker.workerId}) created successfully`,
      data: newWorker,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update worker (Admin only)
router.patch('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reason, ...data } = req.body;
    const updated = await updateWorker(
      req.params.id,
      data,
      { id: req.user!.id, name: req.user!.name },
      reason || 'Updated worker profile'
    );

    res.json({
      success: true,
      message: 'Worker details updated successfully',
      data: updated,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Deactivate worker (Admin only)
router.patch('/:id/deactivate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const deactivated = await deactivateWorker(
      req.params.id,
      { id: req.user!.id, name: req.user!.name },
      reason || 'Deactivated by administrator'
    );

    res.json({
      success: true,
      message: `Worker ${deactivated.workerId} deactivated successfully`,
      data: deactivated,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Reset PIN / password (Admin only)
router.post('/:id/reset-pin', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { newPin } = req.body;
    const result = await resetWorkerCredentials(
      req.params.id,
      newPin,
      { id: req.user!.id, name: req.user!.name }
    );

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
