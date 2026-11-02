import { prisma } from '../db/prisma.js';
import { logAudit } from '../middleware/audit.js';

export async function listDepartments() {
  const departments = await prisma.department.findMany({
    include: {
      _count: {
        select: {
          users: {
            where: { isActive: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return departments.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    isActive: d.isActive,
    workerCount: d._count.users,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
}

export async function createDepartment(
  data: { name: string; description?: string },
  adminActor: { id: string; name: string }
) {
  const name = data.name.trim();

  const existing = await prisma.department.findUnique({ where: { name } });
  if (existing) {
    throw new Error(`Department "${name}" already exists.`);
  }

  const dept = await prisma.department.create({
    data: {
      name,
      description: data.description?.trim() || null,
      isActive: true,
    },
  });

  await logAudit({
    actorUserId: adminActor.id,
    actorName: adminActor.name,
    action: 'DEPARTMENT_CREATED',
    entityType: 'DEPARTMENT',
    entityId: dept.id,
    reason: `Created department: ${dept.name}`,
    details: { name: dept.name, description: dept.description },
  });

  return dept;
}

export async function updateDepartment(
  id: string,
  data: { name?: string; description?: string; isActive?: boolean },
  adminActor: { id: string; name: string }
) {
  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) throw new Error('Department not found');

  if (data.name && data.name.trim() !== existing.name) {
    const duplicate = await prisma.department.findUnique({ where: { name: data.name.trim() } });
    if (duplicate && duplicate.id !== id) {
      throw new Error(`Department with name "${data.name.trim()}" already exists.`);
    }
  }

  const updated = await prisma.department.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description ? data.description.trim() : null } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });

  await logAudit({
    actorUserId: adminActor.id,
    actorName: adminActor.name,
    action: 'DEPARTMENT_UPDATED',
    entityType: 'DEPARTMENT',
    entityId: id,
    reason: `Updated department: ${updated.name}`,
    details: { previous: existing, updated },
  });

  return updated;
}
