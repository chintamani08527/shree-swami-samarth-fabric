import { prisma } from '../db/prisma.js';
import { DEFAULT_ATTENDANCE_RULES, config } from '../config/index.js';
import { logAudit } from '../middleware/audit.js';

export async function getCompanySettings() {
  let settings = await prisma.companySettings.findUnique({
    where: { id: 'default-settings' },
  });

  if (!settings) {
    settings = await prisma.companySettings.create({
      data: {
        id: 'default-settings',
        companyName: config.companyName,
        timezone: config.companyTimezone,
        defaultWorkingHours: 8.0,
        attendanceRules: JSON.stringify(DEFAULT_ATTENDANCE_RULES),
      },
    });
  }

  const shifts = await prisma.shift.findMany({
    orderBy: { startTime: 'asc' },
  });

  let rules = DEFAULT_ATTENDANCE_RULES;
  try {
    rules = JSON.parse(settings.attendanceRules);
  } catch {}

  return {
    settings: {
      id: settings.id,
      companyName: settings.companyName,
      timezone: settings.timezone,
      defaultWorkingHours: settings.defaultWorkingHours,
      rules,
    },
    shifts,
  };
}

export async function updateCompanySettings(
  data: {
    companyName?: string;
    timezone?: string;
    defaultWorkingHours?: number;
    rules?: Record<string, any>;
  },
  adminActor: { id: string; name: string }
) {
  const current = await getCompanySettings();

  const updatedRules = data.rules ? { ...current.settings.rules, ...data.rules } : current.settings.rules;

  const updated = await prisma.companySettings.upsert({
    where: { id: 'default-settings' },
    update: {
      ...(data.companyName ? { companyName: data.companyName.trim() } : {}),
      ...(data.timezone ? { timezone: data.timezone.trim() } : {}),
      ...(data.defaultWorkingHours !== undefined ? { defaultWorkingHours: data.defaultWorkingHours } : {}),
      attendanceRules: JSON.stringify(updatedRules),
    },
    create: {
      id: 'default-settings',
      companyName: data.companyName?.trim() || config.companyName,
      timezone: data.timezone?.trim() || config.companyTimezone,
      defaultWorkingHours: data.defaultWorkingHours || 8.0,
      attendanceRules: JSON.stringify(updatedRules),
    },
  });

  await logAudit({
    actorUserId: adminActor.id,
    actorName: adminActor.name,
    action: 'SETTINGS_UPDATED',
    entityType: 'SETTINGS',
    entityId: 'default-settings',
    reason: 'Updated company attendance parameters and configurations',
    details: { previous: current.settings, updated: data },
  });

  return {
    ...updated,
    rules: updatedRules,
  };
}

export async function createShift(
  data: {
    name: string;
    startTime: string;
    endTime: string;
    gracePeriodMinutes?: number;
    breakDurationMinutes?: number;
    halfDayThresholdHours?: number;
    fullDayThresholdHours?: number;
  },
  adminActor: { id: string; name: string }
) {
  const shift = await prisma.shift.create({
    data: {
      name: data.name.trim(),
      startTime: data.startTime.trim(),
      endTime: data.endTime.trim(),
      gracePeriodMinutes: data.gracePeriodMinutes ?? 15,
      breakDurationMinutes: data.breakDurationMinutes ?? 60,
      halfDayThresholdHours: data.halfDayThresholdHours ?? 4.0,
      fullDayThresholdHours: data.fullDayThresholdHours ?? 8.0,
      isActive: true,
    },
  });

  await logAudit({
    actorUserId: adminActor.id,
    actorName: adminActor.name,
    action: 'SHIFT_CREATED',
    entityType: 'SHIFT',
    entityId: shift.id,
    reason: `Configured shift: ${shift.name} (${shift.startTime} - ${shift.endTime})`,
    details: shift,
  });

  return shift;
}

export async function updateShift(
  id: string,
  data: {
    name?: string;
    startTime?: string;
    endTime?: string;
    gracePeriodMinutes?: number;
    breakDurationMinutes?: number;
    halfDayThresholdHours?: number;
    fullDayThresholdHours?: number;
    isActive?: boolean;
  },
  adminActor: { id: string; name: string }
) {
  const existing = await prisma.shift.findUnique({ where: { id } });
  if (!existing) throw new Error('Shift not found');

  const updated = await prisma.shift.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
      ...(data.startTime ? { startTime: data.startTime.trim() } : {}),
      ...(data.endTime ? { endTime: data.endTime.trim() } : {}),
      ...(data.gracePeriodMinutes !== undefined ? { gracePeriodMinutes: data.gracePeriodMinutes } : {}),
      ...(data.breakDurationMinutes !== undefined ? { breakDurationMinutes: data.breakDurationMinutes } : {}),
      ...(data.halfDayThresholdHours !== undefined ? { halfDayThresholdHours: data.halfDayThresholdHours } : {}),
      ...(data.fullDayThresholdHours !== undefined ? { fullDayThresholdHours: data.fullDayThresholdHours } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });

  await logAudit({
    actorUserId: adminActor.id,
    actorName: adminActor.name,
    action: 'SHIFT_UPDATED',
    entityType: 'SHIFT',
    entityId: id,
    reason: `Updated shift parameters for ${updated.name}`,
    details: { previous: existing, updated },
  });

  return updated;
}

export async function deleteShift(id: string, adminActor: { id: string; name: string }) {
  const existing = await prisma.shift.findUnique({ where: { id } });
  if (!existing) throw new Error('Shift not found');

  // Cascade delete any worker shift allocations
  await prisma.workerShift.deleteMany({ where: { shiftId: id } });

  // Delete the shift
  await prisma.shift.delete({ where: { id } });

  await logAudit({
    actorUserId: adminActor.id,
    actorName: adminActor.name,
    action: 'SHIFT_DELETED',
    entityType: 'SHIFT',
    entityId: id,
    reason: `Deleted factory shift: ${existing.name}`,
    details: existing,
  });

  return { success: true, message: `Shift '${existing.name}' deleted successfully.` };
}

export async function resetAllShifts(adminActor: { id: string; name: string }) {
  await prisma.workerShift.deleteMany({});
  const result = await prisma.shift.deleteMany({});

  await logAudit({
    actorUserId: adminActor.id,
    actorName: adminActor.name,
    action: 'SHIFTS_RESET',
    entityType: 'SHIFT',
    reason: 'Owner reset all factory shifts to empty raw state',
    details: { count: result.count },
  });

  return { success: true, count: result.count, message: 'All factory shifts have been reset.' };
}
