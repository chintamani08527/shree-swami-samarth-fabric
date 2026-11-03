import { Router, Request, Response } from 'express';
import {
  getDashboardKPIs,
  getWeeklyAttendanceReport,
  getMonthlyAttendanceReport,
  getYearlyAttendanceReport,
} from '../services/report.service.js';
import {
  generateWeeklyExcelReport,
  generateMonthlyExcelReport,
  generateYearlyExcelReport,
  generateSalaryExcelReport,
} from '../services/excel.service.js';
import { authenticate } from '../middleware/auth.js';
import { requireSupervisorOrAdmin, requireAdmin } from '../middleware/roles.js';
import { Roles } from '../config/index.js';

const router = Router();

router.use(authenticate);

// 1. Dashboard KPIs and Overview
router.get('/dashboard', requireSupervisorOrAdmin, async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    const data = await getDashboardKPIs(date as string);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Weekly Report JSON
router.get('/weekly', requireSupervisorOrAdmin, async (req: Request, res: Response) => {
  try {
    const { refDate, departmentId } = req.query;

    let targetDeptId = departmentId as string | undefined;
    if (req.user?.role === Roles.SUPERVISOR && req.user.departmentId) {
      targetDeptId = req.user.departmentId;
    }

    const data = await getWeeklyAttendanceReport(refDate as string, targetDeptId);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Weekly Report Excel Export
router.get('/weekly/export', requireSupervisorOrAdmin, async (req: Request, res: Response) => {
  try {
    const { refDate, departmentId } = req.query;

    let targetDeptId = departmentId as string | undefined;
    if (req.user?.role === Roles.SUPERVISOR && req.user.departmentId) {
      targetDeptId = req.user.departmentId;
    }

    const buffer = await generateWeeklyExcelReport(
      refDate as string,
      targetDeptId,
      req.user!.name
    );

    const filename = `SSF_Weekly_Attendance_${refDate || 'Current'}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Monthly Report JSON
router.get('/monthly', requireSupervisorOrAdmin, async (req: Request, res: Response) => {
  try {
    const { refDate, departmentId } = req.query;

    let targetDeptId = departmentId as string | undefined;
    if (req.user?.role === Roles.SUPERVISOR && req.user.departmentId) {
      targetDeptId = req.user.departmentId;
    }

    const data = await getMonthlyAttendanceReport(refDate as string, targetDeptId);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Monthly Report Excel Export
router.get('/monthly/export', requireSupervisorOrAdmin, async (req: Request, res: Response) => {
  try {
    const { refDate, departmentId } = req.query;

    let targetDeptId = departmentId as string | undefined;
    if (req.user?.role === Roles.SUPERVISOR && req.user.departmentId) {
      targetDeptId = req.user.departmentId;
    }

    const buffer = await generateMonthlyExcelReport(
      refDate as string,
      targetDeptId,
      req.user!.name
    );

    const filename = `SSF_Monthly_Attendance_${refDate || 'Current'}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. Yearly Report JSON
router.get('/yearly', requireSupervisorOrAdmin, async (req: Request, res: Response) => {
  try {
    const { year, departmentId } = req.query;

    let targetDeptId = departmentId as string | undefined;
    if (req.user?.role === Roles.SUPERVISOR && req.user.departmentId) {
      targetDeptId = req.user.departmentId;
    }

    const data = await getYearlyAttendanceReport(year as string, targetDeptId);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. Yearly Report Excel Export
router.get('/yearly/export', requireSupervisorOrAdmin, async (req: Request, res: Response) => {
  try {
    const { year, departmentId } = req.query;

    let targetDeptId = departmentId as string | undefined;
    if (req.user?.role === Roles.SUPERVISOR && req.user.departmentId) {
      targetDeptId = req.user.departmentId;
    }

    const buffer = await generateYearlyExcelReport(
      year as string,
      targetDeptId,
      req.user!.name
    );

    const filename = `SSF_Yearly_Attendance_${year || 'Current'}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 8. Dedicated Salary Calculation Excel Export (Clean 6 Columns)
router.get('/salary/export', requireSupervisorOrAdmin, async (req: Request, res: Response) => {
  try {
    const { refDate, periodType, departmentId } = req.query;

    let targetDeptId = departmentId as string | undefined;
    if (req.user?.role === Roles.SUPERVISOR && req.user.departmentId) {
      targetDeptId = req.user.departmentId;
    }

    const buffer = await generateSalaryExcelReport(
      refDate as string,
      (periodType as any) || 'MONTHLY',
      targetDeptId,
      req.user!.name
    );

    const filename = `SSF_Salary_Calculation_${refDate || 'Current'}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
