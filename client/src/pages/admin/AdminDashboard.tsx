import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  AlertTriangle,
  Timer,
  TrendingUp,
  Building2,
  FileSpreadsheet,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { reportsApi } from '../../services/api.ts';
import { DashboardKPIs } from '../../types/index.ts';
import { useToast } from '../../context/ToastContext.tsx';

interface AdminDashboardProps {
  onNavigateTab: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateTab }) => {
  const { showToast } = useToast();
  const [data, setData] = useState<DashboardKPIs | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async (forceSpinner: boolean | any = false) => {
    try {
      if (forceSpinner === true || !data) {
        setLoading(true);
      }
      const res = await reportsApi.getDashboard();
      if (res.success) {
        setData(res.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load dashboard metrics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const kpis = data?.kpis;

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-navy-950 tracking-tight">
            Factory Attendance Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time biometric & mobile check-in monitoring • {kpis?.formattedTargetDate || 'Today'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadDashboard}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => onNavigateTab('reports')}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Weekly Excel</span>
          </button>
        </div>
      </div>

      {/* KPI METRICS GRID (6 CARDS) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {/* 1. Total Registered Workers */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Registered</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-navy-950">
            {kpis?.totalRegisteredWorkers ?? '--'}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">Active factory staff</div>
        </div>

        {/* 2. Present Today */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Present Today</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">
            {kpis?.presentToday ?? '--'}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1">
            {kpis?.attendancePercentage ?? 0}% Turnout rate
          </div>
        </div>

        {/* 3. Absent Today */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Absent Today</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-600">
            {kpis?.absentToday ?? '--'}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">Unmarked active staff</div>
        </div>

        {/* 4. Currently Checked In */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">On Floor Now</span>
            <div className="p-2 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
              </span>
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-teal-700">
            {kpis?.currentlyCheckedIn ?? '--'}
          </div>
          <div className="text-[11px] text-teal-700 font-semibold mt-1">Currently checked in</div>
        </div>

        {/* 5. Late Arrivals */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Late Arrivals</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600">
            {kpis?.lateArrivals ?? '--'}
          </div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">Past 15m grace period</div>
        </div>

        {/* 6. Total Working Hours Today */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Hours Today</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Timer className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-indigo-900 font-mono">
            {kpis?.totalWorkingHoursToday ?? '--'}h
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">Net logged productive hours</div>
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-Day Attendance Trend Area Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-navy-950 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-teal-600" />
                <span>7-Day Attendance & Man-Hours Trend</span>
              </h2>
              <p className="text-xs text-slate-500">Daily present workers and aggregate hours worked</p>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.trend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1e4f85" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1e4f85" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="present"
                  name="Present Workers"
                  stroke="#0d9488"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorPresent)"
                />
                <Area
                  type="monotone"
                  dataKey="hours"
                  name="Total Hours"
                  stroke="#1e4f85"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorHours)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department-wise Turnout Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="mb-4">
            <h2 className="text-base font-bold text-navy-950 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-teal-600" />
              <span>Department Attendance</span>
            </h2>
            <p className="text-xs text-slate-500">Live floor presence by manufacturing unit</p>
          </div>

          <div className="space-y-3.5 flex-1 overflow-y-auto">
            {data?.departmentBreakdown?.map((dept) => (
              <div key={dept.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">{dept.name}</span>
                  <span className="font-mono text-slate-500">
                    <span className="font-bold text-navy-950">{dept.present}</span>/{dept.totalWorkers} ({dept.attendanceRate}%)
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-navy-700 rounded-full transition-all duration-500"
                    style={{ width: `${dept.attendanceRate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => onNavigateTab('departments')}
            className="mt-4 pt-3 border-t border-slate-100 w-full flex items-center justify-between text-xs font-bold text-teal-700 hover:text-teal-800 transition-colors"
          >
            <span>Manage All Departments</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* QUICK ACTIONS BANNER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          onClick={() => onNavigateTab('attendance')}
          className="p-5 bg-gradient-to-r from-navy-900 to-navy-800 text-white rounded-2xl shadow-sm hover:shadow-md cursor-pointer transition-all flex items-center justify-between group"
        >
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
              Live Monitoring
            </span>
            <h3 className="text-base font-black mt-1">Review Active Factory Floor Check-Ins</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              View workers currently logged in, detect missing checkouts & authorize corrections
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-teal-500 transition-colors">
            <ArrowRight className="w-5 h-5 text-white" />
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('reports')}
          className="p-5 bg-gradient-to-r from-teal-800 to-teal-700 text-white rounded-2xl shadow-sm hover:shadow-md cursor-pointer transition-all flex items-center justify-between group"
        >
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-teal-200">
              Excel Export
            </span>
            <h3 className="text-base font-black mt-1">Download Weekly Excel Attendance Report</h3>
            <p className="text-xs text-teal-100 mt-0.5">
              Production-formatted .xlsx with breaks, overtime, working hours, and totals
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-navy-900 transition-colors">
            <FileSpreadsheet className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
};
