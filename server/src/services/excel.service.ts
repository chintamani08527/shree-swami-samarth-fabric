import ExcelJS from 'exceljs';
import { prisma } from '../db/prisma.js';
import {
  getWeekDateRange,
  getMonthDateRange,
  getYearDateRange,
  formatKolkataDate,
  formatKolkataDateTime,
  formatKolkataTime,
  getDayOfWeekName,
} from '../utils/time.js';
import { Roles, config } from '../config/index.js';

export async function generateWeeklyExcelReport(
  weekRefDate?: string,
  departmentId?: string,
  adminName: string = 'System Admin'
): Promise<ExcelJS.Buffer> {
  const week = getWeekDateRange(weekRefDate);

  // Fetch all workers matching filter
  const whereWorker: any = {
    role: Roles.WORKER,
    isActive: true,
  };

  if (departmentId) {
    whereWorker.departmentId = departmentId;
  }

  const workers = await prisma.user.findMany({
    where: whereWorker,
    include: {
      department: true,
      workerShifts: {
        where: { effectiveTo: null },
        include: { shift: true },
        take: 1,
      },
      attendanceRecords: {
        where: {
          attendanceDate: {
            in: week.dates,
          },
        },
        orderBy: { attendanceDate: 'asc' },
      },
    },
    orderBy: { workerId: 'asc' },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Shree Swami Samarth Fabric Attendance System';
  workbook.created = new Date();

  const brandNavy = 'FF1B3A5D';
  const brandTeal = 'FF0D9488';
  const lightGray = 'FFF1F5F9';
  const headerFont = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };

  // ==========================================
  // SHEET 1: SALARY CALCULATION (CLEAN 6 COLUMNS)
  // Worker ID | Name | Present or Absent | Machines Operated | How Many Days | Salary (₹)
  // ==========================================
  const summarySheet = workbook.addWorksheet('Salary Calculation', {
    views: [{ showGridLines: true }],
  });

  // Title Banner
  summarySheet.mergeCells('A1:F1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'SHREE SWAMI SAMARTH FABRIC — WEEKLY SALARY CALCULATION';
  titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandNavy } };
  summarySheet.getRow(1).height = 36;

  // Subtitle
  summarySheet.mergeCells('A2:F2');
  const subCell = summarySheet.getCell('A2');
  subCell.value = `Weekly Period: ${formatKolkataDate(week.startOfWeek)} to ${formatKolkataDate(week.endOfWeek)} | Units: Unit 1 & Unit 2`;
  subCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1E293B' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  summarySheet.getRow(2).height = 24;

  // Metadata Row
  summarySheet.mergeCells('A3:F3');
  const metaCell = summarySheet.getCell('A3');
  metaCell.value = `Report Generated: ${formatKolkataDateTime(new Date())} | Authorized By: ${adminName} | Total Active Workers: ${workers.length}`;
  metaCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
  metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
  summarySheet.getRow(3).height = 18;

  // Empty spacer
  summarySheet.addRow([]);

  // Exact 6 core columns requested: Worker ID, Name, Present or Absent, Machines Operated, How Many Days, Salary
  const summaryHeaders = [
    'Worker ID',
    'Worker Name',
    'Present or Absent',
    'Machines Operated',
    'How Many Days',
    'Salary (₹)',
  ];

  const headerRow = summarySheet.addRow(summaryHeaders);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandTeal } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      bottom: { style: 'medium', color: { argb: brandNavy } },
    };
  });

  let grandTotalDaysPresent = 0;
  let grandTotalMachines = 0;
  let grandTotalSalary = 0;
  let totalPresentCount = 0;
  let totalAbsentCount = 0;

  workers.forEach((w, idx) => {
    let presentCount = 0;
    let totalMinutes = 0;
    let totalOvertimeMinutes = 0;
    let totalMachinesLogged = 0;
    let customEarnings = 0;

    const isCustom = w.wageType === 'CUSTOM' || Boolean(w.hasCustomWageAccess);
    const customRate = w.customWageRate || 0;
    const dailyWage = w.dailyWage || 0;

    w.attendanceRecords.forEach((r) => {
      if (r.checkInAt) {
        presentCount += 1;
        totalMinutes += r.workingMinutes;
        totalOvertimeMinutes += (r.overtimeMinutes || 0);
        if (r.machinesOperated) totalMachinesLogged += r.machinesOperated;

        if (isCustom && customRate > 0) {
          const m = r.machinesOperated ?? (r.workingMinutes > 0 ? 1 : 0);
          const h = r.hoursOperated ?? (r.workingMinutes / 60);
          const otM = r.overtimeMachines ?? 0;
          const otH = r.overtimeHours ?? (r.overtimeMinutes ? r.overtimeMinutes / 60 : 0);
          const shiftPay = m * h * customRate;
          const otPay = otM > 0 && otH > 0 ? otM * otH * customRate : otH * (customRate * (m || 1));
          customEarnings += (shiftPay + otPay);
        }
      }
    });

    const totalOtHours = Number((totalOvertimeMinutes / 60).toFixed(2));
    const operatedDays = w.attendanceRecords.filter((r) => (r.machinesOperated || 0) > 0);
    const machinesOperated = operatedDays.length > 0
      ? Math.round(totalMachinesLogged / operatedDays.length)
      : (isCustom ? 2 : (totalMachinesLogged > 0 ? totalMachinesLogged : 0));

    const daysAbsent = 7 - presentCount;
    if (presentCount > 0) totalPresentCount += 1;
    else totalAbsentCount += 1;

    let statusText = 'Absent';
    if (presentCount > 0) {
      statusText = daysAbsent > 0 ? `Present (${presentCount}d) / Absent (${daysAbsent}d)` : 'Present';
    }

    const calculatedSalary = isCustom
      ? Math.round(customEarnings)
      : Math.round((presentCount * dailyWage) + (totalOtHours * (dailyWage / 8)));

    grandTotalDaysPresent += presentCount;
    grandTotalMachines += machinesOperated;
    grandTotalSalary += calculatedSalary;

    const row = summarySheet.addRow([
      w.workerId,
      w.name,
      statusText,
      machinesOperated > 0 ? `${machinesOperated} Machines` : (isCustom ? '2 Machines' : '--'),
      presentCount,
      calculatedSalary,
    ]);

    row.height = 22;

    // Zebra striping
    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGray } };
      });
    }

    // Alignments
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).alignment = { horizontal: 'left' };
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(4).alignment = { horizontal: 'center' };
    row.getCell(5).alignment = { horizontal: 'center' };
    row.getCell(6).alignment = { horizontal: 'right' };
    row.getCell(6).font = { bold: true };
    row.getCell(6).numFmt = '"₹"#,##0';

    if (presentCount > 0) {
      row.getCell(3).font = { color: { argb: 'FF16A34A' }, bold: true };
    } else {
      row.getCell(3).font = { color: { argb: 'FFDC2626' }, bold: true };
    }

    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  // Totals Row
  const totalsRow = summarySheet.addRow([
    'TOTAL',
    `${workers.length} Workers`,
    `${totalPresentCount} Present / ${totalAbsentCount} Absent`,
    `${grandTotalMachines} Machines`,
    grandTotalDaysPresent,
    grandTotalSalary,
  ]);

  totalsRow.height = 26;
  totalsRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandNavy } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  totalsRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  totalsRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
  totalsRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
  totalsRow.getCell(6).numFmt = '"₹"#,##0';

  // Set column widths
  summarySheet.columns = [
    { width: 16 }, // Worker ID
    { width: 28 }, // Worker Name
    { width: 26 }, // Present or Absent
    { width: 22 }, // Machines Operated
    { width: 18 }, // How Many Days
    { width: 24 }, // Salary (₹)
  ];

  summarySheet.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5, column: 6 },
  };

  // ==========================================
  // SHEET 2: DETAILED DAILY LOGS
  // ==========================================
  const detailsSheet = workbook.addWorksheet('Detailed Daily Logs', {
    views: [{ showGridLines: true }],
  });

  // Title Banner
  detailsSheet.mergeCells('A1:L1');
  const dTitle = detailsSheet.getCell('A1');
  dTitle.value = 'SHREE SWAMI SAMARTH FABRIC — DAILY ATTENDANCE & TIMESTAMPS';
  dTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  dTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  dTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandNavy } };
  detailsSheet.getRow(1).height = 32;

  // Subtitle
  detailsSheet.mergeCells('A2:L2');
  const dSub = detailsSheet.getCell('A2');
  dSub.value = `Week: ${formatKolkataDate(week.startOfWeek)} to ${formatKolkataDate(week.endOfWeek)} | Timestamps recorded in Asia/Kolkata`;
  dSub.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
  dSub.alignment = { horizontal: 'center', vertical: 'middle' };
  detailsSheet.getRow(2).height = 20;

  detailsSheet.addRow([]);

  const detailHeaders = [
    'Worker ID',
    'Worker Name',
    'Department',
    'Attendance Date',
    'Day of Week',
    'Check-In Time',
    'Check-Out Time',
    'Break (Mins)',
    'Working Hours',
    'Attendance Status',
    'Late / Exception Indicator',
    'Remarks / Source',
  ];

  const dHeaderRow = detailsSheet.addRow(detailHeaders);
  dHeaderRow.height = 24;
  dHeaderRow.eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandTeal } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0F766E' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  let rowCount = 0;
  for (const dateStr of week.dates) {
    for (const w of workers) {
      const rec = w.attendanceRecords.find((r) => r.attendanceDate === dateStr);
      const isCheckedIn = Boolean(rec && rec.checkInAt);
      const isLate = Boolean(rec && rec.lateMinutes > 0);
      const isMissingCheckout = Boolean(rec && rec.isMissingCheckOut);

      let lateOrExceptionText = 'On-Time';
      if (!isCheckedIn) {
        lateOrExceptionText = 'Absent';
      } else if (isMissingCheckout) {
        lateOrExceptionText = 'Missing Check-Out';
      } else if (isLate) {
        lateOrExceptionText = `Late by ${rec?.lateMinutes}m`;
      }

      const row = detailsSheet.addRow([
        w.workerId,
        w.name,
        w.department?.name || 'Unassigned',
        dateStr,
        getDayOfWeekName(dateStr),
        rec?.checkInAt ? formatKolkataTime(rec.checkInAt) : '--:--',
        rec?.checkOutAt ? formatKolkataTime(rec.checkOutAt) : '--:--',
        rec?.breakMinutes || 0,
        rec ? Number((rec.workingMinutes / 60).toFixed(2)) : 0,
        rec?.status || 'ABSENT',
        lateOrExceptionText,
        rec?.remarks || rec?.source || '',
      ]);

      row.height = 19;
      rowCount++;

      if (rowCount % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGray } };
        });
      }

      // Status color highlights
      const statusCell = row.getCell(10);
      if (rec?.status === 'PRESENT') {
        statusCell.font = { color: { argb: 'FF16A34A' }, bold: true };
      } else if (rec?.status === 'LATE') {
        statusCell.font = { color: { argb: 'FFD97706' }, bold: true };
      } else if (rec?.status === 'HALF_DAY') {
        statusCell.font = { color: { argb: 'FFEA580C' }, bold: true };
      } else if (!isCheckedIn || rec?.status === 'ABSENT') {
        statusCell.font = { color: { argb: 'FFDC2626' } };
      }

      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'center' };
      row.getCell(6).alignment = { horizontal: 'center' };
      row.getCell(7).alignment = { horizontal: 'center' };
      row.getCell(8).alignment = { horizontal: 'right' };
      row.getCell(9).alignment = { horizontal: 'right' };
      row.getCell(10).alignment = { horizontal: 'center' };
      row.getCell(11).alignment = { horizontal: 'center' };

      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
    }
  }

  detailsSheet.columns = [
    { width: 14 }, // Worker ID
    { width: 24 }, // Worker Name
    { width: 20 }, // Department
    { width: 16 }, // Date
    { width: 14 }, // Day
    { width: 15 }, // Check-In
    { width: 15 }, // Check-Out
    { width: 14 }, // Break
    { width: 16 }, // Hours
    { width: 18 }, // Status
    { width: 24 }, // Indicator
    { width: 24 }, // Remarks
  ];

  detailsSheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: 12 },
  };

  return await workbook.xlsx.writeBuffer();
}

/**
 * Generate Official Monthly Excel Attendance & Wage Statement (.xlsx)
 */
export async function generateMonthlyExcelReport(
  monthRefDate?: string,
  departmentId?: string,
  adminName: string = 'Owner Vinayak Ginde'
): Promise<ExcelJS.Buffer> {
  const month = getMonthDateRange(monthRefDate);

  const whereWorker: any = {
    role: Roles.WORKER,
    isActive: true,
  };

  if (departmentId) {
    whereWorker.departmentId = departmentId;
  }

  const workers = await prisma.user.findMany({
    where: whereWorker,
    include: {
      department: true,
      workerShifts: {
        where: { effectiveTo: null },
        include: { shift: true },
        take: 1,
      },
      attendanceRecords: {
        where: {
          attendanceDate: {
            gte: month.startOfMonth,
            lte: month.endOfMonth,
          },
        },
        orderBy: { attendanceDate: 'asc' },
      },
    },
    orderBy: { workerId: 'asc' },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Shree Swami Samarth Fabric Attendance System';
  workbook.created = new Date();

  const brandNavy = 'FF1B3A5D';
  const brandTeal = 'FF0D9488';
  const lightGray = 'FFF8FAFC';
  const headerFont = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };

  // ==========================================
  // SHEET 1: SALARY CALCULATION (CLEAN 6 COLUMNS)
  // Worker ID | Name | Present or Absent | Machines Operated | How Many Days | Salary (₹)
  // ==========================================
  const sheet = workbook.addWorksheet('Salary Calculation', {
    views: [{ showGridLines: true }],
  });

  // Title Banner
  sheet.mergeCells('A1:F1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'SHREE SWAMI SAMARTH FABRIC — WORKER SALARY CALCULATION';
  titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandNavy } };
  sheet.getRow(1).height = 36;

  // Subtitle
  sheet.mergeCells('A2:F2');
  const subCell = sheet.getCell('A2');
  subCell.value = `Monthly Statement | Month: ${month.monthName} (${formatKolkataDate(month.startOfMonth)} to ${formatKolkataDate(month.endOfMonth)})`;
  subCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1E293B' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  sheet.getRow(2).height = 24;

  // Metadata Row
  sheet.mergeCells('A3:F3');
  const metaCell = sheet.getCell('A3');
  metaCell.value = `Generated: ${formatKolkataDateTime(new Date())} | Authorized By: ${adminName} | Total Active Workers: ${workers.length}`;
  metaCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
  metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(3).height = 18;

  // Spacer
  sheet.addRow([]);

  // Exact 6 core columns requested: Worker ID, Name, Present or Absent, Machines Operated, How Many Days, Salary
  const headers = [
    'Worker ID',
    'Worker Name',
    'Present or Absent',
    'Machines Operated',
    'How Many Days',
    'Salary (₹)',
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandTeal } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      bottom: { style: 'medium', color: { argb: brandNavy } },
    };
  });

  let totalPayoutAll = 0;
  let totalDaysPresentAll = 0;
  let totalMachinesAll = 0;
  let totalPresentCount = 0;
  let totalAbsentCount = 0;

  workers.forEach((w, idx) => {
    let daysPresent = 0;
    let daysLate = 0;
    let overtimeMinutes = 0;
    let totalMinutes = 0;
    let totalMachinesLogged = 0;
    let customEarnings = 0;

    const isCustom = w.wageType === 'CUSTOM' || Boolean(w.hasCustomWageAccess);
    const customRate = w.customWageRate || 0;
    const dailyWage = w.dailyWage || 0;

    w.attendanceRecords.forEach((r) => {
      if (r.checkInAt) {
        daysPresent += 1;
        totalMinutes += r.workingMinutes;
        overtimeMinutes += (r.overtimeMinutes || 0);
        if (r.lateMinutes > 0) daysLate += 1;
        if (r.machinesOperated) totalMachinesLogged += r.machinesOperated;

        if (isCustom && customRate > 0) {
          const m = r.machinesOperated ?? (r.workingMinutes > 0 ? 1 : 0);
          const h = r.hoursOperated ?? (r.workingMinutes / 60);
          const otM = r.overtimeMachines ?? 0;
          const otH = r.overtimeHours ?? (r.overtimeMinutes ? r.overtimeMinutes / 60 : 0);
          const shiftPay = m * h * customRate;
          const otPay = otM > 0 && otH > 0 ? otM * otH * customRate : otH * (customRate * (m || 1));
          customEarnings += (shiftPay + otPay);
        }
      }
    });

    const totalOtHours = Number((overtimeMinutes / 60).toFixed(2));
    const daysAbsent = Math.max(0, month.totalDays - daysPresent);
    if (daysPresent > 0) totalPresentCount += 1;
    else totalAbsentCount += 1;

    // Determine machines operated
    const operatedDays = w.attendanceRecords.filter((r) => (r.machinesOperated || 0) > 0);
    const machinesOperated = operatedDays.length > 0
      ? Math.round(totalMachinesLogged / operatedDays.length)
      : (isCustom ? 2 : (totalMachinesLogged > 0 ? totalMachinesLogged : 0));

    // Attendance status column
    let statusText = 'Absent';
    if (daysPresent > 0) {
      statusText = daysAbsent > 0 ? `Present (${daysPresent}d) / Absent (${daysAbsent}d)` : 'Present';
    }

    // Accurate salary calculation
    const calculatedSalary = isCustom
      ? Math.round(customEarnings)
      : Math.round((daysPresent * dailyWage) + (totalOtHours * (dailyWage / 8)));

    totalPayoutAll += calculatedSalary;
    totalDaysPresentAll += daysPresent;
    totalMachinesAll += machinesOperated;

    const row = sheet.addRow([
      w.workerId,
      w.name,
      statusText,
      machinesOperated > 0 ? `${machinesOperated} Machines` : (isCustom ? '2 Machines' : '--'),
      daysPresent,
      calculatedSalary,
    ]);

    row.height = 22;
    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGray } };
      });
    }

    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).alignment = { horizontal: 'left' };
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(4).alignment = { horizontal: 'center' };
    row.getCell(5).alignment = { horizontal: 'center' };
    row.getCell(6).alignment = { horizontal: 'right' };
    row.getCell(6).font = { bold: true };
    row.getCell(6).numFmt = '"₹"#,##0';

    if (daysPresent > 0) {
      row.getCell(3).font = { color: { argb: 'FF16A34A' }, bold: true };
    } else {
      row.getCell(3).font = { color: { argb: 'FFDC2626' }, bold: true };
    }

    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  // Total Summary Row
  const totalRow = sheet.addRow([
    'TOTAL',
    `${workers.length} Workers`,
    `${totalPresentCount} Present / ${totalAbsentCount} Absent`,
    `${totalMachinesAll} Machines`,
    totalDaysPresentAll,
    totalPayoutAll,
  ]);
  totalRow.height = 26;
  totalRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandNavy } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  totalRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  totalRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
  totalRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
  totalRow.getCell(6).numFmt = '"₹"#,##0';

  sheet.columns = [
    { width: 16 }, // Worker ID
    { width: 28 }, // Worker Name
    { width: 26 }, // Present or Absent
    { width: 22 }, // Machines Operated
    { width: 18 }, // How Many Days
    { width: 24 }, // Salary (₹)
  ];

  sheet.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5, column: 6 },
  };

  // ==========================================
  // SHEET 2: DETAILED WAGE & ATTENDANCE STATEMENT
  // ==========================================
  const detailSheet = workbook.addWorksheet('Detailed Breakdown', {
    views: [{ showGridLines: true }],
  });

  detailSheet.mergeCells('A1:K1');
  const dTitle = detailSheet.getCell('A1');
  dTitle.value = 'SHREE SWAMI SAMARTH FABRIC — MONTHLY DETAILED WAGE BREAKDOWN';
  dTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  dTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  dTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandNavy } };
  detailSheet.getRow(1).height = 32;

  detailSheet.addRow([]);

  const detailHeaders = [
    'Worker ID',
    'Worker Name',
    'Department',
    'Unit',
    'Wage Model',
    'Base Rate / Wage',
    'Days Present',
    'Days Absent',
    'Total Hours',
    'Overtime (Hrs)',
    'Calculated Salary (₹)',
  ];

  const dHeaderRow = detailSheet.addRow(detailHeaders);
  dHeaderRow.height = 26;
  dHeaderRow.eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandTeal } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  workers.forEach((w, idx) => {
    let daysPresent = 0;
    let overtimeMinutes = 0;
    let totalMinutes = 0;
    let customEarnings = 0;

    const isCustom = w.wageType === 'CUSTOM' || Boolean(w.hasCustomWageAccess);
    const customRate = w.customWageRate || 0;
    const dailyWage = w.dailyWage || 0;

    w.attendanceRecords.forEach((r) => {
      if (r.checkInAt) {
        daysPresent += 1;
        totalMinutes += r.workingMinutes;
        overtimeMinutes += (r.overtimeMinutes || 0);

        if (isCustom && customRate > 0) {
          const m = r.machinesOperated ?? (r.workingMinutes > 0 ? 1 : 0);
          const h = r.hoursOperated ?? (r.workingMinutes / 60);
          const otM = r.overtimeMachines ?? 0;
          const otH = r.overtimeHours ?? (r.overtimeMinutes ? r.overtimeMinutes / 60 : 0);
          const shiftPay = m * h * customRate;
          const otPay = otM > 0 && otH > 0 ? otM * otH * customRate : otH * (customRate * (m || 1));
          customEarnings += (shiftPay + otPay);
        }
      }
    });

    const hours = Number((totalMinutes / 60).toFixed(2));
    const otHours = Number((overtimeMinutes / 60).toFixed(2));
    const daysAbsent = Math.max(0, month.totalDays - daysPresent);
    const calculatedSalary = isCustom
      ? Math.round(customEarnings)
      : Math.round((daysPresent * dailyWage) + (otHours * (dailyWage / 8)));

    const row = detailSheet.addRow([
      w.workerId,
      w.name,
      w.department?.name || 'Unassigned',
      w.unit || 'Unit 1',
      isCustom ? 'Custom (Per Mc/Hr)' : 'Fixed Daily Wage',
      isCustom ? `₹${customRate}/mc/hr` : (dailyWage > 0 ? `₹${dailyWage}/day` : '--'),
      daysPresent,
      daysAbsent,
      hours,
      otHours,
      calculatedSalary,
    ]);

    row.height = 20;
    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGray } };
      });
    }

    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(4).alignment = { horizontal: 'center' };
    row.getCell(5).alignment = { horizontal: 'center' };
    row.getCell(6).alignment = { horizontal: 'right' };
    row.getCell(7).alignment = { horizontal: 'center' };
    row.getCell(8).alignment = { horizontal: 'center' };
    row.getCell(9).alignment = { horizontal: 'right' };
    row.getCell(10).alignment = { horizontal: 'right' };
    row.getCell(11).alignment = { horizontal: 'right' };
    row.getCell(11).font = { bold: true };
    row.getCell(11).numFmt = '"₹"#,##0';
  });

  detailSheet.columns = [
    { width: 14 },
    { width: 26 },
    { width: 18 },
    { width: 12 },
    { width: 22 },
    { width: 18 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 22 },
  ];

  return await workbook.xlsx.writeBuffer();
}

/**
 * Generate Official Yearly Excel Attendance Summary (.xlsx)
 */
export async function generateYearlyExcelReport(
  yearRef?: number | string,
  departmentId?: string,
  adminName: string = 'Owner Vinayak Ginde'
): Promise<ExcelJS.Buffer> {
  const yearInfo = getYearDateRange(yearRef);

  const whereWorker: any = {
    role: Roles.WORKER,
    isActive: true,
  };

  if (departmentId) {
    whereWorker.departmentId = departmentId;
  }

  const workers = await prisma.user.findMany({
    where: whereWorker,
    include: {
      department: true,
      workerShifts: {
        where: { effectiveTo: null },
        include: { shift: true },
        take: 1,
      },
      attendanceRecords: {
        where: {
          attendanceDate: {
            gte: yearInfo.startOfYear,
            lte: yearInfo.endOfYear,
          },
        },
        orderBy: { attendanceDate: 'asc' },
      },
    },
    orderBy: { workerId: 'asc' },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Shree Swami Samarth Fabric Attendance System';
  workbook.created = new Date();

  const brandNavy = 'FF1B3A5D';
  const brandTeal = 'FF0D9488';
  const headerFont = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };

  const sheet = workbook.addWorksheet('Yearly Summary', {
    views: [{ showGridLines: true }],
  });

  // Title Banner
  sheet.mergeCells('A1:S1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'SHREE SWAMI SAMARTH FABRIC — ANNUAL ATTENDANCE SUMMARY';
  titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandNavy } };
  sheet.getRow(1).height = 36;

  // Subtitle
  sheet.mergeCells('A2:S2');
  const subCell = sheet.getCell('A2');
  subCell.value = `Annual Report for Year ${yearInfo.year} (${formatKolkataDate(yearInfo.startOfYear)} to ${formatKolkataDate(yearInfo.endOfYear)})`;
  subCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1E293B' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  sheet.getRow(2).height = 24;

  // Metadata Row
  sheet.mergeCells('A3:S3');
  const metaCell = sheet.getCell('A3');
  metaCell.value = `Generated: ${formatKolkataDateTime(new Date())} | Authorized By: ${adminName} | Total Active Workers: ${workers.length}`;
  metaCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
  metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(3).height = 18;

  // Spacer
  sheet.addRow([]);

  // Table Headers
  const headers = [
    'Worker ID',
    'Worker Name',
    'Department',
    'Daily Wage (₹)',
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
    'Total Days',
    'Total Hours',
    'Est. Annual Payout (₹)',
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandTeal } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      bottom: { style: 'medium', color: { argb: brandNavy } },
    };
  });

  workers.forEach((w, idx) => {
    let totalMinutes = 0;
    let daysPresent = 0;
    let overtimeMinutes = 0;
    let customEarnings = 0;
    const monthlyCounts = Array.from({ length: 12 }, () => 0);

    const isCustom = w.wageType === 'CUSTOM' || Boolean(w.hasCustomWageAccess);
    const customRate = w.customWageRate || 0;
    const dailyWage = isCustom ? 0 : (w.dailyWage || 0);

    w.attendanceRecords.forEach((r) => {
      if (r.checkInAt) {
        daysPresent += 1;
        totalMinutes += r.workingMinutes;
        overtimeMinutes += (r.overtimeMinutes || 0);
        const m = parseInt(r.attendanceDate.split('-')[1], 10) - 1;
        if (m >= 0 && m < 12) {
          monthlyCounts[m] += 1;
        }

        if (isCustom && customRate > 0) {
          const mach = r.machinesOperated ?? (r.workingMinutes > 0 ? 1 : 0);
          const hrs = r.hoursOperated ?? (r.workingMinutes / 60);
          const otM = r.overtimeMachines ?? 0;
          const otH = r.overtimeHours ?? (r.overtimeMinutes ? r.overtimeMinutes / 60 : 0);
          const shiftPay = mach * hrs * customRate;
          const otPay = otM > 0 && otH > 0 ? otM * otH * customRate : otH * (customRate * (mach || 1));
          customEarnings += (shiftPay + otPay);
        }
      }
    });

    const hours = Number((totalMinutes / 60).toFixed(2));
    const otHours = Number((overtimeMinutes / 60).toFixed(2));
    const payout = isCustom
      ? Math.round(customEarnings)
      : Math.round((daysPresent * dailyWage) + (otHours * (dailyWage / 8)));

    const row = sheet.addRow([
      w.workerId,
      w.name,
      w.department?.name || 'Unassigned',
      dailyWage > 0 ? dailyWage : '--',
      ...monthlyCounts,
      daysPresent,
      hours,
      payout,
    ]);

    row.height = 22;
    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }

    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(4).alignment = { horizontal: 'right' };
    for (let c = 5; c <= 17; c++) {
      row.getCell(c).alignment = { horizontal: 'center' };
    }
    row.getCell(18).alignment = { horizontal: 'right' };
    row.getCell(19).alignment = { horizontal: 'right' };
    row.getCell(19).font = { bold: true };
  });

  sheet.columns = [
    { width: 14 },
    { width: 24 },
    { width: 18 },
    { width: 14 },
    { width: 7 },
    { width: 7 },
    { width: 7 },
    { width: 7 },
    { width: 7 },
    { width: 7 },
    { width: 7 },
    { width: 7 },
    { width: 7 },
    { width: 7 },
    { width: 7 },
    { width: 7 },
    { width: 12 },
    { width: 14 },
    { width: 22 },
  ];

  return await workbook.xlsx.writeBuffer();
}

/**
 * Dedicated Salary Calculation Excel Export
 * Exactly 6 core columns: Worker ID, Worker Name, Present or Absent, Machines Operated, How Many Days, Salary (₹)
 */
export async function generateSalaryExcelReport(
  refDate?: string,
  periodType: 'MONTHLY' | 'WEEKLY' = 'MONTHLY',
  departmentId?: string,
  adminName: string = 'Owner Vinayak Ginde'
): Promise<ExcelJS.Buffer> {
  if (periodType === 'WEEKLY') {
    return generateWeeklyExcelReport(refDate, departmentId, adminName);
  }
  return generateMonthlyExcelReport(refDate, departmentId, adminName);
}
