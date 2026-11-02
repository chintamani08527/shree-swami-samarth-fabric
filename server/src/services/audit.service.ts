import { prisma } from '../db/prisma.js';

export async function listAuditLogs(params: {
  action?: string;
  entityType?: string;
  actorUserId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 25));
  const skip = (page - 1) * limit;

  const where: any = {};

  if (params.action) {
    where.action = params.action;
  }

  if (params.entityType) {
    where.entityType = params.entityType;
  }

  if (params.actorUserId) {
    where.actorUserId = params.actorUserId;
  }

  if (params.startDate && params.endDate) {
    where.createdAt = {
      gte: new Date(params.startDate),
      lte: new Date(params.endDate + 'T23:59:59.999Z'),
    };
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        actorUser: {
          select: {
            id: true,
            name: true,
            workerId: true,
            role: true,
          },
        },
      },
    }),
  ]);

  const formatted = logs.map((log) => ({
    id: log.id,
    actorUserId: log.actorUserId,
    actorName: log.actorName || log.actorUser?.name || 'System',
    actorRole: log.actorUser?.role || 'SYSTEM',
    actorWorkerId: log.actorUser?.workerId || 'SYSTEM',
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    reason: log.reason,
    details: log.details ? (typeof log.details === 'string' ? safeJsonParse(log.details) : log.details) : null,
    createdAt: log.createdAt,
  }));

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    logs: formatted,
  };
}

function safeJsonParse(str: string) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
