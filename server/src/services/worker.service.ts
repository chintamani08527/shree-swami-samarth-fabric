import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';
import { RoleType, Roles } from '../config/index.js';
import { logAudit } from '../middleware/audit.js';

export async function listWorkers(params: {
  search?: string;
  departmentId?: string;
  role?: RoleType;
  isActive?: boolean;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: any = {};

  if (params.isActive !== undefined) {
    where.isActive = params.isActive;
  }

  if (params.role) {
    where.role = params.role;
  } else {
    // Only workers and supervisors are listed in worker management.
    // The factory Owner (Vinayak Ginde) is an executive/owner, not a worker.
    where.role = { in: [Roles.WORKER, Roles.SUPERVISOR] };
  }

  if (params.departmentId) {
    where.departmentId = params.departmentId;
  }

  if (params.search) {
    const s = params.search.trim();
    where.OR = [
      { name: { contains: s } },
      { workerId: { contains: s.toUpperCase() } },
      { phone: { contains: s } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: {
        department: true,
        workerShifts: {
          where: { effectiveTo: null },
          include: { shift: true },
          take: 1,
        },
      },
      orderBy: [{ workerId: 'asc' }],
      skip,
      take: limit,
    }),
  ]);

  const formatted = users.map((u) => ({
    id: u.id,
    workerId: u.workerId,
    name: u.name,
    phone: u.phone,
    role: u.role,
    wageType: u.wageType || 'FIXED',
    dailyWage: u.dailyWage,
    hasCustomWageAccess: Boolean(u.hasCustomWageAccess),
    isActive: u.isActive,
    department: u.department ? { id: u.department.id, name: u.department.name } : null,
    shift: u.workerShifts[0]?.shift ? {
      id: u.workerShifts[0].shift.id,
      name: u.workerShifts[0].shift.name,
      startTime: u.workerShifts[0].shift.startTime,
      endTime: u.workerShifts[0].shift.endTime,
    } : null,
    joiningDate: u.joiningDate,
    createdAt: u.createdAt,
  }));

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    workers: formatted,
  };
}

export async function getWorkerById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      department: true,
      workerShifts: {
        where: { effectiveTo: null },
        include: { shift: true },
        take: 1,
      },
      attendanceRecords: {
        orderBy: { attendanceDate: 'desc' },
        take: 10,
      },
    },
  });

  if (!user) throw new Error('Worker not found');

  return {
    id: user.id,
    workerId: user.workerId,
    name: user.name,
    phone: user.phone,
    role: user.role,
    wageType: user.wageType || 'FIXED',
    dailyWage: user.dailyWage,
    hasCustomWageAccess: Boolean(user.hasCustomWageAccess),
    isActive: user.isActive,
    department: user.department,
    shift: user.workerShifts[0]?.shift || null,
    joiningDate: user.joiningDate,
    recentAttendance: user.attendanceRecords,
  };
}

export async function createWorker(
  data: {
    workerId: string;
    name: string;
    phone?: string;
    passwordOrPin: string;
    role?: RoleType;
    departmentId?: string;
    shiftId?: string;
    wageType?: 'FIXED' | 'CUSTOM';
    dailyWage?: number | null;
    hasCustomWageAccess?: boolean;
    joiningDate?: string;
  },
  adminActor: { id: string; name: string }
) {
  const normalizedWorkerId = data.workerId.trim().toUpperCase();

  const existing = await prisma.user.findUnique({
    where: { workerId: normalizedWorkerId },
  });

  if (existing) {
    throw new Error(`Worker ID "${normalizedWorkerId}" already exists. Please assign a unique ID.`);
  }

  const passwordHash = await bcrypt.hash(data.passwordOrPin, 10);
  const isCustom = data.wageType === 'CUSTOM';
  const hasCustomWageAccess = isCustom
    ? (data.hasCustomWageAccess !== undefined ? Boolean(data.hasCustomWageAccess) : true)
    : Boolean(data.hasCustomWageAccess);

  const newUser = await prisma.user.create({
    data: {
      workerId: normalizedWorkerId,
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      passwordHash,
      role: data.role || Roles.WORKER,
      wageType: isCustom ? 'CUSTOM' : 'FIXED',
      dailyWage: isCustom ? null : (data.dailyWage !== undefined && data.dailyWage !== null ? Number(data.dailyWage) : null),
      hasCustomWageAccess,
      departmentId: data.departmentId || null,
      isActive: true,
      joiningDate: data.joiningDate ? new Date(data.joiningDate) : new Date(),
    },
    include: { department: true },
  });

  // Assign shift if specified, or assign default shift
  const targetShiftId = data.shiftId || (await prisma.shift.findFirst({ where: { isActive: true } }))?.id;
  if (targetShiftId) {
    await prisma.workerShift.create({
      data: {
        userId: newUser.id,
        shiftId: targetShiftId,
        effectiveFrom: new Date(),
      },
    });
  }

  await logAudit({
    actorUserId: adminActor.id,
    actorName: adminActor.name,
    action: 'WORKER_CREATED',
    entityType: 'WORKER',
    entityId: newUser.id,
    reason: `Registered new worker: ${newUser.name} (${newUser.workerId})`,
    details: { workerId: newUser.workerId, name: newUser.name, role: newUser.role },
  });

  return newUser;
}

export async function updateWorker(
  id: string,
  data: {
    name?: string;
    phone?: string;
    departmentId?: string | null;
    shiftId?: string;
    wageType?: 'FIXED' | 'CUSTOM';
    dailyWage?: number | null;
    hasCustomWageAccess?: boolean;
    isActive?: boolean;
    joiningDate?: string;
  },
  adminActor: { id: string; name: string },
  reason: string = 'Worker profile details updated by administrator'
) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new Error('Worker not found');

  const willBeCustom = data.wageType !== undefined ? data.wageType === 'CUSTOM' : existing.wageType === 'CUSTOM';

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
      ...(data.phone !== undefined ? { phone: data.phone ? data.phone.trim() : null } : {}),
      ...(data.departmentId !== undefined ? { departmentId: data.departmentId } : {}),
      ...(data.wageType !== undefined ? { wageType: data.wageType } : {}),
      ...(data.hasCustomWageAccess !== undefined
        ? { hasCustomWageAccess: Boolean(data.hasCustomWageAccess) }
        : data.wageType === 'CUSTOM'
        ? { hasCustomWageAccess: true }
        : {}),
      ...(data.wageType === 'CUSTOM'
        ? { dailyWage: null }
        : data.dailyWage !== undefined
        ? { dailyWage: data.dailyWage !== null ? Number(data.dailyWage) : null }
        : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.joiningDate ? { joiningDate: new Date(data.joiningDate) } : {}),
    },
    include: { department: true },
  });

  // Shift update if specified
  if (data.shiftId) {
    await prisma.workerShift.updateMany({
      where: { userId: id, effectiveTo: null },
      data: { effectiveTo: new Date() },
    });
    await prisma.workerShift.create({
      data: {
        userId: id,
        shiftId: data.shiftId,
        effectiveFrom: new Date(),
      },
    });
  }

  await logAudit({
    actorUserId: adminActor.id,
    actorName: adminActor.name,
    action: 'WORKER_UPDATED',
    entityType: 'WORKER',
    entityId: id,
    reason,
    details: { previous: existing, updated: data },
  });

  return updated;
}

export async function deactivateWorker(
  id: string,
  adminActor: { id: string; name: string },
  reason: string
) {
  if (!reason || reason.trim().length < 5) {
    throw new Error('A mandatory reason is required to deactivate a worker profile.');
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new Error('Worker not found');

  const deactivated = await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });

  await logAudit({
    actorUserId: adminActor.id,
    actorName: adminActor.name,
    action: 'WORKER_DEACTIVATED',
    entityType: 'WORKER',
    entityId: id,
    reason: reason.trim(),
    details: { workerId: existing.workerId, name: existing.name },
  });

  return deactivated;
}

export async function resetWorkerCredentials(
  id: string,
  newPinOrPassword: string,
  adminActor: { id: string; name: string }
) {
  if (!newPinOrPassword || newPinOrPassword.length < 4) {
    throw new Error('New PIN or password must be at least 4 characters/digits.');
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new Error('Worker not found');

  const passwordHash = await bcrypt.hash(newPinOrPassword, 10);

  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });

  await logAudit({
    actorUserId: adminActor.id,
    actorName: adminActor.name,
    action: 'PIN_RESET',
    entityType: 'WORKER',
    entityId: id,
    reason: `PIN / password reset securely by admin ${adminActor.name}`,
    details: { workerId: existing.workerId, name: existing.name },
  });

  return { message: `Credentials successfully reset for worker ${existing.workerId}.` };
}
