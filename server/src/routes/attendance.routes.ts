import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  processCheckIn,
  processCheckOut,
  logCustomWageWork,
  getWorkerStatus,
  getWorkerAttendanceHistory,
  listAttendanceRecords,
  correctAttendanceRecord,
  getCurrentlyCheckedInWorkers,
  getOvertimeRequests,
  approveOvertime,
  rejectOvertime,
  bulkApproveOvertime,
  verifyFactoryGeofence,
} from '../services/attendance.service.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin, requireSupervisorOrAdmin } from '../middleware/roles.js';
import { validate } from '../middleware/validate.js';
import { AttendanceSources, Roles } from '../config/index.js';

const router = Router();

router.use(authenticate);

// 0. Verify worker location against factory geofence
router.post('/verify-location', async (req: Request, res: Response) => {
  try {
    const { latitude, longitude } = req.body;
    const result = await verifyFactoryGeofence(
      latitude !== undefined && latitude !== null ? Number(latitude) : null,
      longitude !== undefined && longitude !== null ? Number(longitude) : null
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 1. Worker Check-In
router.post('/check-in', async (req: Request, res: Response) => {
  try {
    const isMobile = req.headers['user-agent']?.includes('Mobile') || false;
    const source = isMobile ? AttendanceSources.WEB_MOBILE : AttendanceSources.WEB_DESKTOP;

    // A worker marks their own attendance; an admin can optionally pass workerUserId
    let targetUserId = req.user!.id;
    let adminActor: { id: string; name: string } | undefined = undefined;

    if (req.body.workerUserId && (req.user!.role === Roles.ADMIN || req.user!.role === Roles.SUPER_ADMIN)) {
      targetUserId = req.body.workerUserId;
      adminActor = { id: req.user!.id, name: req.user!.name };
    }

    const { latitude, longitude } = req.body;
    const location = (latitude !== undefined && latitude !== null && longitude !== undefined && longitude !== null)
      ? { latitude: Number(latitude), longitude: Number(longitude) }
      : undefined;

    const shiftChoice = req.body.shiftType || req.body.shiftChoice;
    const result = await processCheckIn(targetUserId, source, adminActor, shiftChoice, location);

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

    if (req.body.workerUserId && (req.user!.role === Roles.ADMIN || req.user!.role === Roles.SUPER_ADMIN)) {
      targetUserId = req.body.workerUserId;
      adminActor = { id: req.user!.id, name: req.user!.name };
    }

    const { latitude, longitude } = req.body;
    const location = (latitude !== undefined && latitude !== null && longitude !== undefined && longitude !== null)
      ? { latitude: Number(latitude), longitude: Number(longitude) }
      : undefined;

    const customDetails = {
      machinesOperated: req.body.machinesOperated !== undefined && req.body.machinesOperated !== null ? Number(req.body.machinesOperated) : undefined,
      hoursOperated: req.body.hoursOperated !== undefined && req.body.hoursOperated !== null ? Number(req.body.hoursOperated) : undefined,
      overtimeMachines: req.body.overtimeMachines !== undefined && req.body.overtimeMachines !== null ? Number(req.body.overtimeMachines) : undefined,
      overtimeHours: req.body.overtimeHours !== undefined && req.body.overtimeHours !== null ? Number(req.body.overtimeHours) : undefined,
    };

    const result = await processCheckOut(targetUserId, source, adminActor, customDetails, location);

    res.json({
      success: true,
      message: result.message,
      data: result.record,
      workingHours: result.workingHours,
      breakMinutes: result.breakMinutes,
      overtimeMinutes: result.overtimeMinutes,
      machinesOperated: result.machinesOperated,
      hoursOperated: result.hoursOperated,
      overtimeMachines: result.overtimeMachines,
      overtimeHours: result.overtimeHours,
      earnings: result.earnings,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Check-out failed.',
    });
  }
});

// 2b. Worker: Log or update custom wage work details (machines & hours operated)
router.post('/custom-wage-log', async (req: Request, res: Response) => {
  try {
    const { machinesOperated, hoursOperated, overtimeMachines, overtimeHours, remarks } = req.body;
    const record = await logCustomWageWork(req.user!.id, {
      machinesOperated: machinesOperated !== undefined && machinesOperated !== null ? Number(machinesOperated) : null,
      hoursOperated: hoursOperated !== undefined && hoursOperated !== null ? Number(hoursOperated) : null,
      overtimeMachines: overtimeMachines !== undefined && overtimeMachines !== null ? Number(overtimeMachines) : null,
      overtimeHours: overtimeHours !== undefined && overtimeHours !== null ? Number(overtimeHours) : null,
      remarks,
    });

    res.json({
      success: true,
      message: 'Custom wage details (machines & hours) recorded successfully.',
      data: record,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to log custom wage details.',
    });
  }
});

// 2c. Worker: Overtime Portal Log (overtime machines & hours)
router.post('/overtime-log', async (req: Request, res: Response) => {
  try {
    const { overtimeMachines, overtimeHours, remarks } = req.body;
    const record = await logCustomWageWork(req.user!.id, {
      overtimeMachines: overtimeMachines !== undefined && overtimeMachines !== null ? Number(overtimeMachines) : null,
      overtimeHours: overtimeHours !== undefined && overtimeHours !== null ? Number(overtimeHours) : null,
      remarks,
    });

    res.json({
      success: true,
      message: 'Overtime details recorded successfully in Overtime Portal.',
      data: record,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to log overtime details.',
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

// 6b. Admin / Supervisor: Overtime approval list
router.get('/overtime/list', requireSupervisorOrAdmin, async (req: Request, res: Response) => {
  try {
    const { status, startDate, endDate, limit } = req.query;
    const result = await getOvertimeRequests({
      status: status as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6c. Admin: Approve single overtime request
router.post('/overtime/:id/approve', requireAdmin, async (req: Request, res: Response) => {
  try {
    const updated = await approveOvertime(req.params.id, {
      id: req.user!.id,
      name: req.user!.name,
    });
    res.json({
      success: true,
      message: 'Worker overtime request approved. Overtime amount added to regular salary.',
      data: updated,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 6d. Admin: Reject single overtime request
router.post('/overtime/:id/reject', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const updated = await rejectOvertime(
      req.params.id,
      { id: req.user!.id, name: req.user!.name },
      reason
    );
    res.json({
      success: true,
      message: 'Worker overtime request rejected.',
      data: updated,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 6e. Admin: Bulk approve overtime requests
router.post('/overtime/bulk-approve', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { recordIds } = req.body;
    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      return res.status(400).json({ success: false, message: 'recordIds must be a non-empty array of IDs.' });
    }
    const result = await bulkApproveOvertime(recordIds, {
      id: req.user!.id,
      name: req.user!.name,
    });
    res.json({
      success: true,
      message: `Successfully approved ${result.count} overtime requests.`,
      count: result.count,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 7. Admin: Authorized correction with mandatory reason & audit logging
const correctionSchema = z.object({
  body: z.object({
    reason: z.string().min(5, 'Mandatory reason must be at least 5 characters long'),
    checkInAt: z.string().nullable().optional(),
    checkOutAt: z.string().nullable().optional(),
    status: z.enum(['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'ON_LEAVE', 'HOLIDAY']).optional(),
    shiftType: z.string().nullable().optional(),
    machinesOperated: z.number().nullable().optional(),
    hoursOperated: z.number().nullable().optional(),
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
