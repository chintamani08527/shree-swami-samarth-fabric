import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  processCheckIn,
  processCheckOut,
  getWorkerStatus,
  getWorkerAttendanceHistory,
  listAttendanceRecords,
  correctAttendanceRecord,
  getCurrentlyCheckedInWorkers,
} from '../services/attendance.service.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin, requireSupervisorOrAdmin } from '../middleware/roles.js';
import { validate } from '../middleware/validate.js';
import { AttendanceSources, Roles } from '../config/index.js';

const router = Router();

router.use(authenticate);

// 1. Worker Check-In
router.post('/check-in', async (req: Request, res: Response) => {
  try {
    const isMobile = req.headers['user-agent']?.includes('Mobile') || false;
    const source = isMobile ? AttendanceSources.WEB_MOBILE : AttendanceSources.WEB_DESKTOP;

    // A worker marks their own attendance; an admin can optionally pass workerUserId
    let targetUserId = req.user!.id;
    let adminActor: { id: string; name: string } | undefined = undefined;

    if (req.body.workerUserId && req.user!.role === Roles.ADMIN) {
      targetUserId = req.body.workerUserId;
      adminActor = { id: req.user!.id, name: req.user!.name };
    }

    const result = await processCheckIn(targetUserId, source, adminActor);

    res.json({
      success: true,
      message: result.message,
      data: result.record,
      worker: result.worker,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Check-in failed.',
    });
  }
});

// 2. Worker Check-Out
router.post('/check-out', async (req: Request, res: Response) => {
  try {
    const isMobile = req.headers['user-agent']?.includes('Mobile') || false;
    const source = isMobile ? AttendanceSources.WEB_MOBILE : AttendanceSources.WEB_DESKTOP;

    let targetUserId = req.user!.id;
    let adminActor: { id: string; name: string } | undefined = undefined;

    if (req.body.workerUserId && req.user!.role === Roles.ADMIN) {
      targetUserId = req.body.workerUserId;
      adminActor = { id: req.user!.id, name: req.user!.name };
    }

    const result = await processCheckOut(targetUserId, source, adminActor);

    res.json({
      success: true,
      message: result.message,
      data: result.record,
      workingHours: result.workingHours,
      breakMinutes: result.breakMinutes,
      overtimeMinutes: result.overtimeMinutes,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Check-out failed.',
    });
  }
});

// 3. Worker self-view: today's status & live timer
router.get('/me', async (req: Request, res: Response) => {
  try {
    const status = await getWorkerStatus(req.user!.id);
    res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Worker self-view: personal attendance history (restricted to self)
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { limit, startDate, endDate } = req.query;
    const history = await getWorkerAttendanceHistory(
      req.user!.id,
      limit ? parseInt(limit as string, 10) : 30,
      startDate as string,
      endDate as string
    );

    res.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Admin / Supervisor: Query all attendance records with filters & pagination
router.get('/', requireSupervisorOrAdmin, async (req: Request, res: Response) => {
  try {
    const { date, startDate, endDate, workerId, departmentId, status, isMissingCheckOut, page, limit } = req.query;

    let targetDeptId = departmentId as string | undefined;
    if (req.user?.role === Roles.SUPERVISOR && req.user.departmentId) {
      targetDeptId = req.user.departmentId;
    }

    const result = await listAttendanceRecords({
      date: date as string,
      startDate: startDate as string,
      endDate: endDate as string,
      workerId: workerId as string,
      departmentId: targetDeptId,
      status: status as string,
      isMissingCheckOut: isMissingCheckOut !== undefined ? isMissingCheckOut === 'true' : undefined,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. Admin / Supervisor: Live list of currently checked-in workers
router.get('/live', requireSupervisorOrAdmin, async (req: Request, res: Response) => {
  try {
    let targetDeptId: string | undefined = undefined;
    if (req.user?.role === Roles.SUPERVISOR && req.user.departmentId) {
      targetDeptId = req.user.departmentId;
    } else if (req.query.departmentId) {
      targetDeptId = req.query.departmentId as string;
    }

    const liveList = await getCurrentlyCheckedInWorkers(targetDeptId);

    res.json({
      success: true,
      data: liveList,
      count: liveList.length,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. Admin: Authorized correction with mandatory reason & audit logging
const correctionSchema = z.object({
  body: z.object({
    reason: z.string().min(5, 'Mandatory reason must be at least 5 characters long'),
    checkInAt: z.string().nullable().optional(),
    checkOutAt: z.string().nullable().optional(),
    status: z.enum(['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'ON_LEAVE', 'HOLIDAY']).optional(),
    remarks: z.string().optional(),
  }),
});

router.patch('/:id/correct', requireAdmin, validate(correctionSchema), async (req: Request, res: Response) => {
  try {
    const { reason, ...updateData } = req.body;

    const updated = await correctAttendanceRecord(
      req.params.id,
      updateData,
      { id: req.user!.id, name: req.user!.name },
      reason
    );

    res.json({
      success: true,
      message: 'Attendance record corrected successfully and logged to audit trail.',
      data: updated,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
