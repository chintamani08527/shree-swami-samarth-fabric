import { describe, it, expect } from 'vitest';
import { getDashboardKPIs, getWeeklyAttendanceReport } from '../src/services/report.service.js';
import { generateWeeklyExcelReport } from '../src/services/excel.service.js';

describe('Reports & Excel Export', () => {
  it('should return live dashboard KPIs with real company metrics', async () => {
    const data = await getDashboardKPIs();

    expect(data).toBeDefined();
    expect(data.kpis.totalRegisteredWorkers).toBeGreaterThan(0);
    expect(data.kpis.presentToday).toBeGreaterThan(0);
    expect(data.trend).toHaveLength(7);
    expect(data.departmentBreakdown.length).toBeGreaterThanOrEqual(1);
  });

  it('should generate weekly report with worker-level breakdown', async () => {
    const report = await getWeeklyAttendanceReport();

    expect(report).toBeDefined();
    expect(report.period.dates).toHaveLength(7);
    expect(report.workers.length).toBeGreaterThan(0);
    expect(report.overall.totalHours).toBeGreaterThanOrEqual(0);
  });

  it('should generate a valid Excel spreadsheet buffer with ExcelJS', async () => {
    const buffer = await generateWeeklyExcelReport(undefined, undefined, 'Test Admin');

    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer) || buffer instanceof Uint8Array || buffer instanceof ArrayBuffer).toBe(true);
    expect(buffer.byteLength).toBeGreaterThan(1000); // realistic xlsx file size > 1KB
  });
});
