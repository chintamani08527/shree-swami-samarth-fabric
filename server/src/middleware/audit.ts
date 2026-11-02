import { prisma } from '../db/prisma.js';

export interface AuditLogParams {
  actorUserId?: string | null;
  actorName?: string | null;
  action: string;
  entityType: 'ATTENDANCE' | 'WORKER' | 'DEPARTMENT' | 'SETTINGS' | 'SHIFT' | 'AUTH';
  entityId?: string | null;
  reason: string;
  details?: Record<string, any> | string;
}

export async function logAudit(params: AuditLogParams) {
  try {
    const detailsStr = typeof params.details === 'object' ? JSON.stringify(params.details) : params.details;

    return await prisma.auditLog.create({
      data: {
        actorUserId: params.actorUserId || null,
        actorName: params.actorName || (params.actorUserId ? 'Authorized User' : 'System'),
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        reason: params.reason,
        details: detailsStr || null,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}
