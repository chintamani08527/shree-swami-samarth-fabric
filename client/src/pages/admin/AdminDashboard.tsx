import React, { useState, useEffect, useRef } from 'react';
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
  Search,
  Filter,
  X,
  ExternalLink,
  Phone,
  ChevronDown,
  CheckCircle2,
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
import { reportsApi, overtimeApi } from '../../services/api.ts';
import { DashboardKPIs, DashboardWorkerItem } from '../../types/index.ts';
import { useToast } from '../../context/ToastContext.tsx';

interface AdminDashboardProps {
  onNavigateTab: (tab: string) => void;
}

type WorkerListType = 'registered' | 'present' | 'absent' | 'onFloor' | 'late';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateTab }) => {
  const { showToast } = useToast();
  const [data, setData] = useState<DashboardKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingOvertimeCount, setPendingOvertimeCount] = useState(0);

  // Active Worker List Filter state (Default null or 'present')
  const [activeListType, setActiveListType] = useState<WorkerListType | null>(null);
  const [workerSearch, setWorkerSearch] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');

  const workerListSectionRef = useRef<HTMLDivElement | null>(null);

  const loadDashboard = async (forceSpinner: boolean | any = false) => {
    try {
      if (forceSpinner === true || !data) {
        setLoading(true);
      }
      const [res, otRes] = await Promise.allSettled([
        reportsApi.getDashboard(),
        overtimeApi.list({ status: 'PENDING' }),
      ]);
      if (res.status === 'fulfilled' && res.value.success) {
        setData(res.value.data);
      }
      if (otRes.status === 'fulfilled' && otRes.value.success && otRes.value.data) {
        setPendingOvertimeCount(otRes.value.data.summary?.totalPendingCount || 0);
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

  const handleCardClick = (type: WorkerListType) => {
    setActiveListType(type);
    setWorkerSearch('');
    setSelectedUnit('ALL');

    // Smooth scroll to the worker list drilldown table
    setTimeout(() => {
      workerListSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const kpis = data?.kpis;
  const workerLists = data?.workerLists;

  // Compute filtered workers for active category
  const currentWorkers: DashboardWorkerItem[] = activeListType && workerLists
    ? (workerLists[activeListType] || [])
    : [];

  const filteredWorkers = currentWorkers.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(workerSearch.toLowerCase()) ||
      w.workerId.toLowerCase().includes(workerSearch.toLowerCase()) ||
      (w.phone && w.phone.includes(workerSearch)) ||
      w.department.toLowerCase().includes(workerSearch.toLowerCase());

    const matchesUnit =
      selectedUnit === 'ALL' ||
      (selectedUnit === 'Unit 1' && (w.unit === 'Unit 1' || !w.unit)) ||
      (selectedUnit === 'Unit 2' && w.unit === 'Unit 2');

    return matchesSearch && matchesUnit;
  });

  const getListTitleInfo = () => {
    switch (activeListType) {
      case 'registered':
        return {
          title: 'All Registered Factory Workers',
          description: 'Complete roster of active registered workers at Shree Swami Samarth Fabric',
          color: 'blue',
          count: workerLists?.registered?.length || 0,
          badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
        };
      case 'present':
        return {
          title: 'Present Today Workers',
          description: 'Workers who checked in for today’s manufacturing shifts',
          color: 'emerald',
          count: workerLists?.present?.length || 0,
          badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'absent':
        return {
          title: 'Absent Today Workers',
          description: 'Active staff who have not clocked in for today’s work shifts',
          color: 'rose',
          count: workerLists?.absent?.length || 0,
          badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
        };
      case 'onFloor':
        return {
          title: 'Currently On Floor (Live Checked-In)',
          description: 'Workers actively operating machines on the factory floor right now',
          color: 'teal',
          count: workerLists?.onFloor?.length || 0,
          badgeBg: 'bg-teal-50 text-teal-700 border-teal-200',
        };
      case 'late':
        return {
          title: 'Late Arrivals Today',
          description: 'Workers who arrived after the 15-minute shift grace period',
          color: 'amber',
          count: workerLists?.late?.length || 0,
          badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
        };
      default:
        return {
          title: 'Worker List',
          description: '',
          color: 'slate',
          count: 0,
          badgeBg: 'bg-slate-50 text-slate-700 border-slate-200',
        };
    }
  };

  const listInfo = getListTitleInfo();

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
            onClick={() => loadDashboard(true)}
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

      {/* Overtime Pending Approval Alert Banner */}
      {pendingOvertimeCount > 0 && (
        <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-white border-2 border-amber-400/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm sm:text-base font-bold text-amber-950 flex items-center gap-2">
                <span>{pendingOvertimeCount} Worker Overtime Request{pendingOvertimeCount > 1 ? 's' : ''} Pending Approval</span>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-amber-200 text-amber-900 rounded-full">
                  Action Needed
                </span>
              </div>
              <p className="text-xs text-amber-800/90 mt-0.5">
                Workers logged overtime hours/machines. Approve requests to credit them to regular salary.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('overtime')}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all active:scale-95 shrink-0"
          >
            <span>Review & Approve ({pendingOvertimeCount})</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI METRICS GRID (CLICKABLE TO SHOW WORKER LISTS) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Attendance KPIs • Tap any card to view worker list
          </span>
          {activeListType && (
            <button
              onClick={() => setActiveListType(null)}
              className="text-xs font-semibold text-slate-500 hover:text-navy-950 flex items-center gap-1"
            >
              <span>Collapse List</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          {/* 1. Total Registered Workers */}
          <div
            onClick={() => handleCardClick('registered')}
            className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group active:scale-[0.98] ${
              activeListType === 'registered'
                ? 'bg-blue-50/60 border-blue-500 ring-2 ring-blue-500/40 shadow-md'
                : 'bg-white border-slate-200/80 hover:border-blue-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Registered</span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-navy-950">
              {kpis?.totalRegisteredWorkers ?? '--'}
            </div>
            <div className="flex items-center justify-between text-[11px] mt-1">
              <span className="text-slate-400 font-medium">Active staff</span>
              <span className={`font-bold transition-colors ${
                activeListType === 'registered' ? 'text-blue-700' : 'text-blue-600 opacity-0 group-hover:opacity-100'
              }`}>
                {activeListType === 'registered' ? 'Active view ↓' : 'View list →'}
              </span>
            </div>
          </div>

          {/* 2. Present Today */}
          <div
            onClick={() => handleCardClick('present')}
            className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group active:scale-[0.98] ${
              activeListType === 'present'
                ? 'bg-emerald-50/60 border-emerald-500 ring-2 ring-emerald-500/40 shadow-md'
                : 'bg-white border-slate-200/80 hover:border-emerald-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Present Today</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600">
              {kpis?.presentToday ?? '--'}
            </div>
            <div className="flex items-center justify-between text-[11px] mt-1">
              <span className="text-emerald-700 font-semibold">{kpis?.attendancePercentage ?? 0}% Turnout</span>
              <span className={`font-bold transition-colors ${
                activeListType === 'present' ? 'text-emerald-700' : 'text-emerald-600 opacity-0 group-hover:opacity-100'
              }`}>
                {activeListType === 'present' ? 'Active view ↓' : 'View list →'}
              </span>
            </div>
          </div>

          {/* 3. Absent Today */}
          <div
            onClick={() => handleCardClick('absent')}
            className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group active:scale-[0.98] ${
              activeListType === 'absent'
                ? 'bg-rose-50/60 border-rose-500 ring-2 ring-rose-500/40 shadow-md'
                : 'bg-white border-slate-200/80 hover:border-rose-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Absent Today</span>
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl group-hover:scale-110 transition-transform">
                <UserX className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-rose-600">
              {kpis?.absentToday ?? '--'}
            </div>
            <div className="flex items-center justify-between text-[11px] mt-1">
              <span className="text-slate-400 font-medium">Unmarked staff</span>
              <span className={`font-bold transition-colors ${
                activeListType === 'absent' ? 'text-rose-700' : 'text-rose-600 opacity-0 group-hover:opacity-100'
              }`}>
                {activeListType === 'absent' ? 'Active view ↓' : 'View list →'}
              </span>
            </div>
          </div>

          {/* 4. Currently Checked In / On Floor */}
          <div
            onClick={() => handleCardClick('onFloor')}
            className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group active:scale-[0.98] ${
              activeListType === 'onFloor'
                ? 'bg-teal-50/60 border-teal-500 ring-2 ring-teal-500/40 shadow-md'
                : 'bg-white border-slate-200/80 hover:border-teal-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">On Floor Now</span>
              <div className="p-2 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                </span>
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-teal-700">
              {kpis?.currentlyCheckedIn ?? '--'}
            </div>
            <div className="flex items-center justify-between text-[11px] mt-1">
              <span className="text-teal-700 font-semibold">Live on floor</span>
              <span className={`font-bold transition-colors ${
                activeListType === 'onFloor' ? 'text-teal-700' : 'text-teal-600 opacity-0 group-hover:opacity-100'
              }`}>
                {activeListType === 'onFloor' ? 'Active view ↓' : 'View list →'}
              </span>
            </div>
          </div>

          {/* 5. Late Arrivals */}
          <div
            onClick={() => handleCardClick('late')}
            className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group active:scale-[0.98] ${
              activeListType === 'late'
                ? 'bg-amber-50/60 border-amber-500 ring-2 ring-amber-500/40 shadow-md'
                : 'bg-white border-slate-200/80 hover:border-amber-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Late Arrivals</span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-600">
              {kpis?.lateArrivals ?? '--'}
            </div>
            <div className="flex items-center justify-between text-[11px] mt-1">
              <span className="text-amber-700 font-medium">Grace past 15m</span>
              <span className={`font-bold transition-colors ${
                activeListType === 'late' ? 'text-amber-700' : 'text-amber-600 opacity-0 group-hover:opacity-100'
              }`}>
                {activeListType === 'late' ? 'Active view ↓' : 'View list →'}
              </span>
            </div>
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
            <div className="text-[11px] text-slate-400 font-medium mt-1">Logged net hours</div>
          </div>
        </div>
      </div>

      {/* INTERACTIVE WORKER LIST DRILLDOWN PANEL */}
      {activeListType && (
        <div
          ref={workerListSectionRef}
          className="bg-white rounded-2xl border border-slate-200/80 shadow-md overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-top-3"
        >
          {/* Header with Title and Segmented View Switcher */}
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-navy-950">
                  {listInfo.title}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${listInfo.badgeBg}`}>
                  {listInfo.count} Workers
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{listInfo.description}</p>
            </div>

            {/* Segmented Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => handleCardClick('registered')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeListType === 'registered'
                    ? 'bg-navy-950 text-white shadow-xs'
                    : 'text-slate-600 hover:text-navy-950'
                }`}
              >
                Registered ({workerLists?.registered?.length || 0})
              </button>
              <button
                onClick={() => handleCardClick('present')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeListType === 'present'
                    ? 'bg-navy-950 text-white shadow-xs'
                    : 'text-slate-600 hover:text-navy-950'
                }`}
              >
                Present ({workerLists?.present?.length || 0})
              </button>
              <button
                onClick={() => handleCardClick('absent')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeListType === 'absent'
                    ? 'bg-navy-950 text-white shadow-xs'
                    : 'text-slate-600 hover:text-navy-950'
                }`}
              >
                Absent ({workerLists?.absent?.length || 0})
              </button>
              <button
                onClick={() => handleCardClick('onFloor')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeListType === 'onFloor'
                    ? 'bg-navy-950 text-white shadow-xs'
                    : 'text-slate-600 hover:text-navy-950'
                }`}
              >
                On Floor ({workerLists?.onFloor?.length || 0})
              </button>
              <button
                onClick={() => handleCardClick('late')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeListType === 'late'
                    ? 'bg-navy-950 text-white shadow-xs'
                    : 'text-slate-600 hover:text-navy-950'
                }`}
              >
                Late ({workerLists?.late?.length || 0})
              </button>
            </div>
          </div>

          {/* Search & Unit Filter Toolbar */}
          <div className="p-3 sm:p-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={workerSearch}
                onChange={(e) => setWorkerSearch(e.target.value)}
                placeholder="Search by worker ID, name, department..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {workerSearch && (
                <button
                  onClick={() => setWorkerSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Unit Filter + Close Action */}
            <div className="flex items-center gap-2">
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="ALL">All Units</option>
                <option value="Unit 1">Unit 1</option>
                <option value="Unit 2">Unit 2</option>
              </select>

              <button
                onClick={() => setActiveListType(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                title="Close List View"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Workers Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Worker ID</th>
                  <th className="py-3 px-4">Worker Name</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Shift</th>
                  <th className="py-3 px-4">Attendance Status &amp; Time</th>
                  <th className="py-3 px-4">Machines &amp; Wage Rate</th>
                  <th className="py-3 px-4">Contact Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWorkers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      {workerSearch || selectedUnit !== 'ALL'
                        ? 'No workers match your search filters.'
                        : activeListType === 'absent'
                        ? '🎉 No workers are absent today! 100% factory turnout.'
                        : activeListType === 'onFloor'
                        ? 'No workers currently logged on the floor.'
                        : 'No worker records found in this category.'}
                    </td>
                  </tr>
                ) : (
                  filteredWorkers.map((w) => {
                    const isOnFloor = w.status === 'ON_FLOOR';
                    const isPresent = w.status === 'PRESENT' || isOnFloor;
                    const isAbsent = w.status === 'ABSENT';

                    return (
                      <tr key={w.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Worker ID */}
                        <td className="py-3.5 px-4 font-mono font-bold text-navy-950">
                          <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {w.workerId}
                          </span>
                        </td>

                        {/* Worker Name & Unit */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800">{w.name}</div>
                          <span className="inline-block mt-0.5 px-2 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {w.unit || 'Unit 1'}
                          </span>
                        </td>

                        {/* Department */}
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {w.department}
                        </td>

                        {/* Shift */}
                        <td className="py-3.5 px-4 text-slate-600 text-xs">
                          {w.shift}
                        </td>

                        {/* Status & Timing */}
                        <td className="py-3.5 px-4">
                          {isOnFloor ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                                On Floor (In at {w.checkInTime || '--'})
                              </span>
                              {w.lateMinutes ? (
                                <div className="text-[10px] text-amber-600 font-medium pl-1">
                                  Late by {w.lateMinutes}m
                                </div>
                              ) : null}
                            </div>
                          ) : isPresent ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Completed Shift
                              </span>
                              <div className="text-[11px] text-slate-500 font-mono">
                                In: {w.checkInTime || '--'} • Out: {w.checkOutTime || '--'}
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <UserX className="w-3 h-3 text-rose-600" />
                              Absent (Not Checked In)
                            </span>
                          )}
                        </td>

                        {/* Machines & Wage Rate */}
                        <td className="py-3.5 px-4 text-xs font-mono">
                          {w.wageType === 'CUSTOM' ? (
                            <div>
                              <span className="font-bold text-teal-800">
                                {w.machinesOperated ? `${w.machinesOperated} Machines` : 'Custom Wages'}
                              </span>
                              <div className="text-[11px] text-slate-500">
                                Rate: ₹{w.customWageRate || 29.17}/hr
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span className="font-bold text-slate-700">Fixed Wage</span>
                              <div className="text-[11px] text-slate-500">
                                {w.dailyWage ? `₹${w.dailyWage}/day` : '--'}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Contact Phone */}
                        <td className="py-3.5 px-4 text-xs">
                          {w.phone ? (
                            <a
                              href={`tel:${w.phone}`}
                              className="text-teal-700 hover:text-teal-800 font-mono font-medium flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{w.phone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400">--</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Bar */}
          <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing <strong className="text-slate-800">{filteredWorkers.length}</strong> of{' '}
              <strong className="text-slate-800">{currentWorkers.length}</strong> {listInfo.title.toLowerCase()}
            </span>

            <button
              onClick={() => onNavigateTab('workers')}
              className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
            >
              <span>Manage Workers in Master Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-Day Attendance Trend Area Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-navy-950 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-teal-600" />
                <span>7-Day Attendance &amp; Man-Hours Trend</span>
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
              View workers currently logged in, detect missing checkouts &amp; authorize corrections
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
