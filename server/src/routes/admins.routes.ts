import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin, requireSuperAdmin } from '../middleware/roles.js';
import { prisma } from '../db/prisma.js';

export const router = Router();

// All routes require authentication
router.use(authenticate);

// 1. List all Admins & Super Admins (Accessible to Admin & Super Admin)
router.get('/', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: { in: ['SUPER_ADMIN', 'ADMIN'] },
      },
      select: {
        id: true,
        workerId: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { role: 'asc' }, // 'ADMIN' vs 'SUPER_ADMIN'
        { createdAt: 'asc' },
      ],
    });

    // Sort to ensure SUPER_ADMIN is at the top
    const sorted = [...admins].sort((a, b) => {
      if (a.role === 'SUPER_ADMIN') return -1;
      if (b.role === 'SUPER_ADMIN') return 1;
      return a.workerId.localeCompare(b.workerId);
    });

    res.json({
      success: true,
      data: sorted,
    });
  } catch (error) {
    next(error);
  }
});

// Zod schema for creating admin
const createAdminSchema = z.object({
  workerId: z.string().min(2, 'Admin ID must be at least 2 characters').toUpperCase().trim(),
  name: z.string().min(2, 'Admin name must be at least 2 characters').trim(),
  phone: z.string().optional().nullable(),
  pin: z.string().min(4, 'Password/PIN must be at least 4 characters').max(20),
});

// 2. Add New Admin (Super Admin Only)
router.post('/', requireSuperAdmin, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = createAdminSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid admin data.',
        errors: parseResult.error.flatten().fieldErrors,
      });
      return;
    }

    const { workerId, name, phone, pin } = parseResult.data;

    // Check if workerId or admin ID is already taken
    const existing = await prisma.user.findFirst({
      where: {
        workerId: { equals: workerId, mode: 'insensitive' },
      },
    });

    if (existing) {
      res.status(409).json({
        success: false,
        message: `Admin ID "${workerId}" is already registered in the system.`,
      });
      return;
    }

    const passwordHash = await bcrypt.hash(pin, 10);

    const newAdmin = await prisma.user.create({
      data: {
        workerId,
        name,
        phone: phone?.trim() || null,
        passwordHash,
        role: 'ADMIN',
        isActive: true,
      },
      select: {
        id: true,
        workerId: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorUserId: req.user!.id,
        actorName: req.user!.name,
        action: 'CREATE_ADMIN',
        entityType: 'USER',
        entityId: newAdmin.id,
        reason: `Super Admin created Admin account ${workerId} (${name})`,
      },
    });

    res.status(201).json({
      success: true,
      message: `Admin ${name} (${workerId}) created successfully.`,
      data: newAdmin,
    });
  } catch (error) {
    next(error);
  }
});

// 3. Toggle Admin Active Status (Super Admin Only)
router.patch('/:id/status', requireSuperAdmin, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      res.status(404).json({ success: false, message: 'Admin not found.' });
      return;
    }

    // Super Admin cannot be deactivated
    if (target.role === 'SUPER_ADMIN' || target.workerId === 'VINAYAK4501') {
      res.status(403).json({
        success: false,
        message: 'The Super Admin account (Vinayak Ginde) cannot be deactivated.',
      });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: Boolean(isActive) },
      select: {
        id: true,
        workerId: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    res.json({
      success: true,
      message: `Admin ${updated.name} has been ${updated.isActive ? 'activated' : 'deactivated'}.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

// 4. Reset Admin PIN / Password (Super Admin Only)
router.post('/:id/reset-pin', requireSuperAdmin, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { newPin } = req.body;

    if (!newPin || typeof newPin !== 'string' || newPin.length < 4) {
      res.status(400).json({ success: false, message: 'New password must be at least 4 characters.' });
      return;
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      res.status(404).json({ success: false, message: 'Admin not found.' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPin, 10);

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    res.json({
      success: true,
      message: `Password for Admin ${target.name} (${target.workerId}) has been reset successfully.`,
    });
  } catch (error) {
    next(error);
  }
});

// 5. Delete Admin (Super Admin Only)
router.delete('/:id', requireSuperAdmin, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      res.status(404).json({ success: false, message: 'Admin not found.' });
      return;
    }

    if (target.role === 'SUPER_ADMIN' || target.workerId === 'VINAYAK4501') {
      res.status(403).json({
        success: false,
        message: 'The Super Admin account (Vinayak Ginde) cannot be deleted.',
      });
      return;
    }

    await prisma.user.delete({ where: { id } });

    res.json({
      success: true,
      message: `Admin ${target.name} (${target.workerId}) has been removed.`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
