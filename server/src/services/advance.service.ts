import { prisma } from '../db/prisma.js';
import { getKolkataDateString } from '../utils/time.js';

export interface AdvanceFilters {
  workerId?: string;
  userId?: string;
  status?: string;
  unit?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export async function getWorkerAdvances(userId: string) {
  const [advances, user] = await Promise.all([
    prisma.advance.findMany({
      where: { userId },
      orderBy: [{ advanceDate: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, workerId: true, name: true, unit: true },
    }),
  ]);

  if (!user) throw new Error('Worker not found');

  const totalActive = advances
    .filter((a) => a.status === 'ACTIVE')
    .reduce((sum, a) => sum + a.amount, 0);

  const totalDeducted = advances
    .filter((a) => a.status === 'DEDUCTED')
    .reduce((sum, a) => sum + a.amount, 0);

  const totalRepaid = advances
    .filter((a) => a.status === 'REPAID')
    .reduce((sum, a) => sum + a.amount, 0);

  const totalRequested = advances
    .filter((a) => a.status === 'REQUESTED')
    .reduce((sum, a) => sum + a.amount, 0);

  return {
    worker: user,
    totalActive,
    totalDeducted,
    totalRepaid,
    totalRequested,
    advances,
  };
}

export async function requestAdvance(
  userId: string,
  amount: number,
  reason?: string
) {
  if (!amount || amount <= 0) {
    throw new Error('कृपया वैध उचल रक्कम प्रविष्ट करा (Enter a valid advance amount).');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('Worker not found');

  const todayDate = getKolkataDateString(new Date());

  const advance = await prisma.advance.create({
    data: {
      userId,
      workerId: user.workerId,
      amount: Math.round(amount),
      advanceDate: todayDate,
      paymentMode: 'CASH',
      status: 'REQUESTED',
      reason: reason?.trim() || null,
    },
  });

  return advance;
}

export async function listAllAdvances(filters: AdvanceFilters) {
  const where: any = {};

  if (filters.status && filters.status !== 'ALL') {
    where.status = filters.status;
  }

  if (filters.workerId) {
    where.workerId = { contains: filters.workerId };
  }

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.startDate || filters.endDate) {
    where.advanceDate = {};
    if (filters.startDate) where.advanceDate.gte = filters.startDate;
    if (filters.endDate) where.advanceDate.lte = filters.endDate;
  }

  if (filters.unit && filters.unit !== 'ALL') {
    where.user = { unit: filters.unit };
  }

  const [advances, allActive, allDeducted, allRepaid, pendingCount] = await Promise.all([
    prisma.advance.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            workerId: true,
            name: true,
            phone: true,
            unit: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ advanceDate: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.advance.aggregate({
      _sum: { amount: true },
      where: { status: 'ACTIVE' },
    }),
    prisma.advance.aggregate({
      _sum: { amount: true },
      where: { status: 'DEDUCTED' },
    }),
    prisma.advance.aggregate({
      _sum: { amount: true },
      where: { status: 'REPAID' },
    }),
    prisma.advance.count({
      where: { status: 'REQUESTED' },
    }),
  ]);

  const totalActive = allActive._sum.amount || 0;
  const totalDeducted = allDeducted._sum.amount || 0;
  const totalRepaid = allRepaid._sum.amount || 0;
  const totalDisbursed = totalActive + totalDeducted + totalRepaid;

  return {
    stats: {
      totalActive,
      totalDeducted,
      totalRepaid,
      totalDisbursed,
      countPendingRequests: pendingCount,
      totalRecords: advances.length,
    },
    advances,
  };
}

export async function createAdvance(data: {
  userId: string;
  amount: number;
  advanceDate?: string;
  paymentMode?: string;
  reason?: string;
  approvedBy: string;
}) {
  if (!data.amount || data.amount <= 0) {
    throw new Error('कृपया वैध रक्कम प्रविष्ट करा (Valid advance amount required).');
  }

  const user = await prisma.user.findUnique({ where: { id: data.userId } });
  if (!user) throw new Error('Worker not found');

  const advanceDate = data.advanceDate || getKolkataDateString(new Date());

  const advance = await prisma.advance.create({
    data: {
      userId: user.id,
      workerId: user.workerId,
      amount: Math.round(data.amount),
      advanceDate,
      paymentMode: data.paymentMode || 'CASH',
      status: 'ACTIVE',
      reason: data.reason?.trim() || null,
      approvedBy: data.approvedBy,
      approvedAt: new Date(),
    },
    include: {
      user: {
        select: {
          id: true,
          workerId: true,
          name: true,
          unit: true,
        },
      },
    },
  });

  return advance;
}

export async function updateAdvanceStatus(
  id: string,
  status: 'ACTIVE' | 'DEDUCTED' | 'REPAID' | 'REJECTED',
  options?: {
    rejectionReason?: string;
    actorName?: string;
  }
) {
  const existing = await prisma.advance.findUnique({ where: { id } });
  if (!existing) throw new Error('Advance record not found');

  const updateData: any = { status };

  if (status === 'ACTIVE' && existing.status === 'REQUESTED') {
    updateData.approvedAt = new Date();
    updateData.approvedBy = options?.actorName || 'Admin';
  } else if (status === 'REJECTED') {
    updateData.rejectionReason = options?.rejectionReason || 'Rejected by Admin';
    updateData.approvedBy = options?.actorName || 'Admin';
  } else if (status === 'DEDUCTED') {
    updateData.deductedAt = new Date();
  }

  const updated = await prisma.advance.update({
    where: { id },
    data: updateData,
    include: {
      user: {
        select: {
          id: true,
          workerId: true,
          name: true,
          unit: true,
        },
      },
    },
  });

  return updated;
}

export async function deleteAdvance(id: string) {
  return prisma.advance.delete({ where: { id } });
}
