import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Building2,
  Users,
  Clock,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  IndianRupee,
} from 'lucide-react';
import { reportsApi, departmentsApi } from '../../services/api.ts';
import { Department } from '../../types/index.ts';
import { useToast } from '../../context/ToastContext.tsx';
import {
  addDays,
  subDays,
  addMonths,
  subMonths,
  addYears,
  subYears,
  format,
} from 'date-fns';

export const ReportsPage: React.FC = () => {
  const { showToast } = useToast();

  const [reportType, setReportType] = useState<'WEEKLY' | 'MONTHLY' | 'YEARLY'>('WEEKLY');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [currentRefDate, setCurrentRefDate] = useState(() => {
    return format(new Date(), 'yyyy-MM-dd');
  });

  const [reportData, setReportData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  // Load departments
  useEffect(() => {
    async function loadDepts() {
      try {
        const res = await departmentsApi.list();
        if (res.success) setDepartments(res.data);
      } catch {}
    }
    loadDepts();
  }, []);

  // Fetch Report Data based on selected reportType
  const loadReport = async () => {
    try {
      setLoading(true);
      let res;
      if (reportType === 'WEEKLY') {
        res = await reportsApi.getWeekly(currentRefDate, selectedDept || undefined);
      } else if (reportType === 'MONTHLY') {
        res = await reportsApi.getMonthly(currentRefDate, selectedDept || undefined);
      } else {
        const year = new Date(currentRefDate).getFullYear();
        res = await reportsApi.getYearly(year, selectedDept || undefined);
      }

      if (res && res.success) {
        setReportData(res.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to generate report', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [currentRefDate, selectedDept, reportType]);

  // Navigate time period
  const handlePrev = () => {
    const d = new Date(currentRefDate);
    if (reportType === 'WEEKLY') {
      setCurrentRefDate(format(subDays(d, 7), 'yyyy-MM-dd'));
    } else if (reportType === 'MONTHLY') {
      setCurrentRefDate(format(subMonths(d, 1), 'yyyy-MM-dd'));
    } else {
      setCurrentRefDate(format(subYears(d, 1), 'yyyy-MM-dd'));
    }
  };

  const handleNext = () => {
    const d = new Date(currentRefDate);
    if (reportType === 'WEEKLY') {
      setCurrentRefDate(format(addDays(d, 7), 'yyyy-MM-dd'));
    } else if (reportType === 'MONTHLY') {
      setCurrentRefDate(format(addMonths(d, 1), 'yyyy-MM-dd'));
    } else {
      setCurrentRefDate(format(addYears(d, 1), 'yyyy-MM-dd'));
    }
  };

  // Download Excel Report (.xlsx)
  const handleDownloadExcel = async () => {
    try {
      setDownloadingExcel(true);
      if (reportType === 'WEEKLY') {
        await reportsApi.downloadWeeklyExcel(currentRefDate, selectedDept || undefined);
        showToast('Weekly Excel attendance report downloaded successfully!', 'success');
      } else if (reportType === 'MONTHLY') {
        await reportsApi.downloadMonthlyExcel(currentRefDate, selectedDept || undefined);
        showToast('Monthly Excel attendance & wage report downloaded successfully!', 'success');
      } else {
        const year = new Date(currentRefDate).getFullYear();
        await reportsApi.downloadYearlyExcel(year, selectedDept || undefined);
        showToast('Yearly Excel attendance report downloaded successfully!', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to download Excel report', 'error');
    } finally {
      setDownloadingExcel(false);
    }
  };

  const period = reportData?.period;
  const overall = reportData?.overall;
  const workers = reportData?.workers || [];

  const getDateDisplay = () => {
    if (!period) return 'Loading Period...';
    if (reportType === 'WEEKLY') {
      return `${period.formattedStart} — ${period.formattedEnd}`;
    }
    if (reportType === 'MONTHLY') {
      return `${period.monthName || 'Month'} (${period.formattedStart} — ${period.formattedEnd})`;
    }
    return `Year ${period.year || new Date(currentRefDate).getFullYear()} (${period.formattedStart} — ${period.formattedEnd})`;
  };

  return (
    <div className="space-y-6">
      {/* Title & Download Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-navy-950 tracking-tight">
            Attendance Reports & Excel Export
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Weekly, monthly and yearly worker attendance summaries, wage calculations & official Excel exports
          </p>
        </div>

        <button
          onClick={handleDownloadExcel}
          disabled={downloadingExcel || loading}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-md shadow-teal-900/10 transition-all tap-active disabled:opacity-50"
        >
          {downloadingExcel ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <FileSpreadsheet className="w-4 h-4" />
              <span>
                Download {reportType === 'WEEKLY' ? 'Weekly' : reportType === 'MONTHLY' ? 'Monthly' : 'Yearly'} Excel (.xlsx)
              </span>
            </>
          )}
        </button>
      </div>

      {/* PERIOD SELECTOR & TOOLBAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: Report Type Tabs + Date Navigator */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Segmented Period Tabs: Weekly | Monthly | Yearly */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setReportType('WEEKLY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                reportType === 'WEEKLY'
                  ? 'bg-navy-950 text-white shadow-xs'
                  : 'text-slate-600 hover:text-navy-950'
              }`}
            >
              Weekly
            </button>
            <button
              type="button"
              onClick={() => setReportType('MONTHLY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                reportType === 'MONTHLY'
                  ? 'bg-navy-950 text-white shadow-xs'
                  : 'text-slate-600 hover:text-navy-950'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setReportType('YEARLY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                reportType === 'YEARLY'
                  ? 'bg-navy-950 text-white shadow-xs'
                  : 'text-slate-600 hover:text-navy-950'
              }`}
            >
              Yearly
            </button>
          </div>

          {/* Navigation Arrows + Date Display */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrev}
              className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors"
              title={`Previous ${reportType === 'WEEKLY' ? 'Week' : reportType === 'MONTHLY' ? 'Month' : 'Year'}`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-navy-950 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-600 shrink-0" />
              <span>{getDateDisplay()}</span>
            </div>

            <button
              onClick={handleNext}
              className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors"
              title={`Next ${reportType === 'WEEKLY' ? 'Week' : reportType === 'MONTHLY' ? 'Month' : 'Year'}`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Department Filter & Refresh */}
        <div className="flex items-center gap-2">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <button
            onClick={loadReport}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition-colors"
            title="Refresh Report"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* OVERALL METRICS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Active Staff</div>
          <div className="text-2xl font-black text-navy-950 mt-1">{overall?.totalWorkers ?? '--'}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Workers evaluated</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Productive Hours</div>
          <div className="text-2xl font-black text-teal-800 font-mono mt-1">{overall?.totalHours ?? '--'}h</div>
          <div className="text-[11px] text-teal-700 mt-0.5">Excludes break deductions</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {reportType === 'WEEKLY' ? 'Overtime Hours' : 'Estimated Payout'}
          </div>
          <div className="text-2xl font-black text-indigo-900 font-mono mt-1">
            {reportType === 'WEEKLY'
              ? `${overall?.totalOvertimeHours ?? '--'}h`
              : `₹${(overall?.totalPayout || 0).toLocaleString('en-IN')}`}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {reportType === 'WEEKLY' ? 'Logged beyond shift' : 'Days present × daily wage'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {reportType === 'YEARLY' ? 'Total Days Worked' : 'Turnout Rate'}
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {reportType === 'YEARLY'
              ? `${overall?.totalDaysPresent ?? 0} days`
              : `${overall?.overallAttendanceRate ?? 0}%`}
          </div>
          <div className="text-[11px] text-emerald-700 mt-0.5">
            {reportType === 'YEARLY' ? 'Cumulative annual shifts' : 'Average turnout percentage'}
          </div>
        </div>
      </div>

      {/* DETAILED WORKER SUMMARY TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-navy-950">
              {reportType === 'WEEKLY'
                ? 'Weekly Worker Attendance Summary'
                : reportType === 'MONTHLY'
                ? 'Monthly Attendance & Wage Statement'
                : 'Annual Attendance & Payout Summary'}
            </h2>
            <p className="text-xs text-slate-500">
              Company: Shree Swami Samarth Fabric • Reporting Period: {getDateDisplay()}
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
            {workers.length} Workers
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Worker ID</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4 text-right">Daily Wage</th>
                {reportType === 'WEEKLY' && <th className="py-3 px-4">Shift</th>}
                {reportType === 'MONTHLY' && <th className="py-3 px-4 text-center">Days in Month</th>}
                <th className="py-3 px-4 text-center">Present</th>
                <th className="py-3 px-4 text-center">Late</th>
                {reportType !== 'YEARLY' && <th className="py-3 px-4 text-center">Absent</th>}
                {reportType === 'WEEKLY' && <th className="py-3 px-4 text-right">Break Mins</th>}
                <th className="py-3 px-4 text-right">Total Hours</th>
                <th className="py-3 px-4 text-right">Overtime</th>
                {reportType === 'WEEKLY' && <th className="py-3 px-4 text-center">Attendance %</th>}
                {reportType !== 'WEEKLY' && <th className="py-3 px-4 text-right font-black text-navy-950">Est. Payout</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workers.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400">
                    No worker records found for this {reportType.toLowerCase()} period.
                  </td>
                </tr>
              ) : (
                workers.map((w: any) => {
                  const pct = Math.round((w.daysPresent / 7) * 100);
                  return (
                    <tr key={w.userId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-navy-950">{w.workerId}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{w.name}</td>
                      <td className="py-3 px-4 text-slate-600">{w.department}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        {w.dailyWage ? `₹${w.dailyWage}` : '--'}
                      </td>
                      {reportType === 'WEEKLY' && <td className="py-3 px-4 text-slate-500 text-xs">{w.shift}</td>}
                      {reportType === 'MONTHLY' && (
                        <td className="py-3 px-4 text-center font-mono text-slate-500">{w.daysInMonth}</td>
                      )}
                      <td className="py-3 px-4 text-center font-bold text-emerald-700">{w.daysPresent}</td>
                      <td className="py-3 px-4 text-center font-bold text-amber-600">{w.daysLate}</td>
                      {reportType !== 'YEARLY' && (
                        <td className="py-3 px-4 text-center font-bold text-slate-400">{w.daysAbsent}</td>
                      )}
                      {reportType === 'WEEKLY' && (
                        <td className="py-3 px-4 text-right font-mono text-slate-500">{w.totalBreakMinutes}m</td>
                      )}
                      <td className="py-3 px-4 text-right font-mono font-bold text-navy-950">
                        {w.totalWorkingHours}h
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-teal-700">
                        {w.totalOvertimeHours > 0 ? `${w.totalOvertimeHours}h` : '-'}
                      </td>
                      {reportType === 'WEEKLY' && (
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded font-bold text-[11px] ${
                              pct >= 80
                                ? 'bg-emerald-50 text-emerald-700'
                                : pct >= 50
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {pct}%
                          </span>
                        </td>
                      )}
                      {reportType !== 'WEEKLY' && (
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800">
                          {w.estimatedPayout > 0 ? `₹${w.estimatedPayout.toLocaleString('en-IN')}` : '--'}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
