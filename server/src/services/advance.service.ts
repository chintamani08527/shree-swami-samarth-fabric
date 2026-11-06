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
      include: {
        deductions: {
          orderBy: { createdAt: 'desc' },
        },
      },
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
    .reduce((sum, a) => sum + (a.balanceAmount != null ? a.balanceAmount : a.amount), 0);

  const totalDeducted = advances.reduce(
    (sum, a) => sum + (a.deductedAmount ?? (a.status === 'DEDUCTED' ? a.amount : 0)),
    0
  );

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
  const roundedAmount = Math.round(amount);

  const advance = await prisma.advance.create({
    data: {
      userId,
      workerId: user.workerId,
      amount: roundedAmount,
      balanceAmount: roundedAmount,
      deductedAmount: 0,
      advanceDate: todayDate,
      paymentMode: 'CASH',
      status: 'REQUESTED',
      reason: reason?.trim() || null,
    },
    include: {
      deductions: true,
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

  const [advances, allActiveRecords, allDeductionsAggregate, legacyDeductedAggregate, allRepaid, pendingCount] = await Promise.all([
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
        deductions: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [{ advanceDate: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.advance.findMany({
      where: { status: 'ACTIVE' },
      select: { amount: true, balanceAmount: true, deductedAmount: true },
    }),
    prisma.advanceDeduction.aggregate({
      _sum: { amount: true },
    }),
    prisma.advance.findMany({
      where: { status: 'DEDUCTED' },
      select: { amount: true, deductedAmount: true },
    }),
    prisma.advance.aggregate({
      _sum: { amount: true },
      where: { status: 'REPAID' },
    }),
    prisma.advance.count({
      where: { status: 'REQUESTED' },
    }),
  ]);

  const totalActive = allActiveRecords.reduce(
    (sum, a) => sum + (a.balanceAmount != null ? a.balanceAmount : a.amount),
    0
  );
  const allDeductionsSum = allDeductionsAggregate._sum?.amount || 0;
  const legacyDeductedSum = legacyDeductedAggregate.reduce((sum, a) => {
    if (!a.deductedAmount) return sum + a.amount;
    return sum;
  }, 0);
  const totalDeducted = allDeductionsSum + legacyDeductedSum;
  const totalRepaid = allRepaid._sum?.amount || 0;
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
  const roundedAmount = Math.round(data.amount);

  const advance = await prisma.advance.create({
    data: {
      userId: user.id,
      workerId: user.workerId,
      amount: roundedAmount,
      balanceAmount: roundedAmount,
      deductedAmount: 0,
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
      deductions: {
        orderBy: { createdAt: 'desc' },
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

  if (status === 'ACTIVE') {
    if (existing.status === 'REQUESTED') {
      updateData.approvedAt = new Date();
      updateData.approvedBy = options?.actorName || 'Admin';
      updateData.balanceAmount = existing.balanceAmount ?? existing.amount;
      updateData.deductedAmount = existing.deductedAmount ?? 0;
    }
  } else if (status === 'REJECTED') {
    updateData.rejectionReason = options?.rejectionReason || 'Rejected by Admin';
    updateData.approvedBy = options?.actorName || 'Admin';
    updateData.balanceAmount = 0;
  } else if (status === 'DEDUCTED') {
    updateData.deductedAt = new Date();
    updateData.deductedAmount = existing.amount;
    updateData.balanceAmount = 0;
  } else if (status === 'REPAID') {
    updateData.balanceAmount = 0;
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
      deductions: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return updated;
}

export async function recordCustomDeduction(data: {
  advanceId: string;
  amount: number;
  cutDate?: string;
  notes?: string;
  cutBy?: string;
}) {
  const advance = await prisma.advance.findUnique({
    where: { id: data.advanceId },
    include: { deductions: true, user: true },
  });
  if (!advance) {
    throw new Error('उचल नोंद आढळली नाही (Advance record not found)');
  }

  if (advance.status !== 'ACTIVE') {
    throw new Error('केवळ सक्रिय उचलीतूनच कपात करता येईल (Can only cut from an ACTIVE advance)');
  }

  const cutAmount = Math.round(data.amount);
  if (!cutAmount || cutAmount <= 0) {
    throw new Error('कृपया वैध कपात रक्कम प्रविष्ट करा (Valid cutting amount required)');
  }

  const currentBalance = advance.balanceAmount != null ? advance.balanceAmount : advance.amount;
  if (cutAmount > currentBalance) {
    throw new Error(
      `कपात रक्कम शिल्लक उचलीपेक्षा (₹${currentBalance.toLocaleString('en-IN')}) जास्त असू शकत नाही (Cutting amount cannot exceed remaining balance).`
    );
  }

  const newBalance = Math.max(0, currentBalance - cutAmount);
  const newDeducted = (advance.deductedAmount || 0) + cutAmount;
  const newStatus = newBalance === 0 ? 'DEDUCTED' : 'ACTIVE';
  const cutDate = data.cutDate || getKolkataDateString(new Date());

  const [deduction, updatedAdvance] = await prisma.$transaction([
    prisma.advanceDeduction.create({
      data: {
        advanceId: advance.id,
        userId: advance.userId,
        amount: cutAmount,
        cutDate,
        notes: data.notes?.trim() || 'उचल कपात (Advance Deduction)',
        cutBy: data.cutBy || 'Admin',
      },
    }),
    prisma.advance.update({
      where: { id: advance.id },
      data: {
        balanceAmount: newBalance,
        deductedAmount: newDeducted,
        status: newStatus,
        deductedAt: newBalance === 0 ? new Date() : advance.deductedAt,
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
        deductions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    }),
  ]);

  return { deduction, advance: updatedAdvance };
}

export async function deleteAdvanceDeduction(deductionId: string) {
  const deduction = await prisma.advanceDeduction.findUnique({
    where: { id: deductionId },
    include: { advance: true },
  });
  if (!deduction) {
    throw new Error('कपात नोंद आढळली नाही (Deduction record not found)');
  }

  const advance = deduction.advance;
  const currentBalance = advance.balanceAmount != null ? advance.balanceAmount : 0;
  const restoredBalance = currentBalance + deduction.amount;
  const restoredDeducted = Math.max(0, (advance.deductedAmount || 0) - deduction.amount);

  const [, updatedAdvance] = await prisma.$transaction([
    prisma.advanceDeduction.delete({
      where: { id: deductionId },
    }),
    prisma.advance.update({
      where: { id: advance.id },
      data: {
        balanceAmount: restoredBalance,
        deductedAmount: restoredDeducted,
        status: 'ACTIVE',
        deductedAt: null,
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
        deductions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    }),
  ]);

  return updatedAdvance;
}

export async function deleteAdvance(id: string) {
  return prisma.advance.delete({ where: { id } });
}
