import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';
import { config, RoleType } from '../config/index.js';
import { logAudit } from '../middleware/audit.js';

export async function loginUser(workerIdInput: string, passwordOrPin: string) {
  const normalizedWorkerId = workerIdInput.trim().toUpperCase();

  const user = await prisma.user.findFirst({
    where: {
      workerId: {
        equals: normalizedWorkerId,
      },
    },
    include: {
      department: true,
      workerShifts: {
        where: { effectiveTo: null },
        include: { shift: true },
        take: 1,
      },
    },
  });

  if (!user) {
    throw new Error('Invalid Worker ID or Password/PIN.');
  }

  if (!user.isActive) {
    throw new Error('This account has been deactivated. Please contact your factory supervisor or admin.');
  }

  const isPasswordValid = await bcrypt.compare(passwordOrPin, user.passwordHash);
  if (!isPasswordValid) {
    throw new Error('Invalid Worker ID or Password/PIN.');
  }

  const token = jwt.sign(
    {
      id: user.id,
      workerId: user.workerId,
      role: user.role,
      name: user.name,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as any }
  );

  const activeShift = user.workerShifts[0]?.shift || null;

  return {
    token,
    user: {
      id: user.id,
      workerId: user.workerId,
      name: user.name,
      phone: user.phone,
      role: user.role,
      department: user.department ? { id: user.department.id, name: user.department.name } : null,
      shift: activeShift ? {
        id: activeShift.id,
        name: activeShift.name,
        startTime: activeShift.startTime,
        endTime: activeShift.endTime,
      } : null,
      joiningDate: user.joiningDate,
    },
  };
}

export async function getCurrentUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      department: true,
      workerShifts: {
        where: { effectiveTo: null },
        include: { shift: true },
        take: 1,
      },
    },
  });

  if (!user || !user.isActive) {
    throw new Error('User account not found or inactive.');
  }

  const activeShift = user.workerShifts[0]?.shift || null;

  return {
    id: user.id,
    workerId: user.workerId,
    name: user.name,
    phone: user.phone,
    role: user.role,
    department: user.department ? { id: user.department.id, name: user.department.name } : null,
    shift: activeShift ? {
      id: activeShift.id,
      name: activeShift.name,
      startTime: activeShift.startTime,
      endTime: activeShift.endTime,
      gracePeriodMinutes: activeShift.gracePeriodMinutes,
      breakDurationMinutes: activeShift.breakDurationMinutes,
    } : null,
    joiningDate: user.joiningDate,
  };
}
