import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  Clock,
  Building2,
  AlertTriangle,
  RefreshCw,
  Search,
} from 'lucide-react';
import { attendanceApi, reportsApi } from '../../services/api.ts';
import { AttendanceRecord } from '../../types/index.ts';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';

export const SupervisorDashboard: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [liveWorkers, setLiveWorkers] = useState<any[]>([]);
  const [departmentRecords, setDepartmentRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'live' | 'today'>('live');
  const [search, setSearch] = useState('');

  const loadSupervisorData = async () => {
    try {
      setLoading(true);
      const [liveRes, listRes] = await Promise.all([
        attendanceApi.getLiveWorkers(user?.department?.id || undefined),
        attendanceApi.listRecords({
          departmentId: user?.department?.id || undefined,
          limit: 50,
        }),
      ]);

      if (liveRes.success) setLiveWorkers(liveRes.data);
      if (listRes.success) setDepartmentRecords(listRes.data.records);
    } catch (err: any) {
      showToast(err.message || 'Failed to load supervisor data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSupervisorData();
  }, []);

  const filteredRecords = departmentRecords.filter(
    (r) =>
      r.workerName.toLowerCase().includes(search.toLowerCase()) ||
      r.workerId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
              Floor Supervisor View
            </span>
            <span className="text-xs font-semibold text-slate-500 font-mono">
              Dept: {user?.department?.name || 'All Assigned Floors'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-navy-950 tracking-tight mt-1">
            Department Attendance Monitoring
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Monitor floor presence, check-in times & exceptions for your assigned textile operations
          </p>
        </div>

        <button
          onClick={loadSupervisorData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Floor</span>
        </button>
      </div>

      {/* KPI METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Checked In On Floor</div>
          <div className="text-2xl font-black text-teal-700 mt-1">{liveWorkers.length}</div>
          <div className="text-[11px] text-teal-700 font-medium mt-0.5">Currently active on floor</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today's Total Logs</div>
          <div className="text-2xl font-black text-navy-950 mt-1">{departmentRecords.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">In assigned department</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs col-span-2 sm:col-span-1">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Late Arrivals</div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {departmentRecords.filter((r) => r.lateMinutes > 0).length}
          </div>
          <div className="text-[11px] text-amber-700 font-medium mt-0.5">Past grace period</div>
        </div>
      </div>

      {/* TABS & SEARCH */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'live' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600'
            }`}
          >
            Live Floor Staff ({liveWorkers.length})
          </button>
          <button
            onClick={() => setActiveTab('today')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'today' ? 'bg-white text-navy-950 shadow-xs' : 'text-slate-600'
            }`}
          >
            Today's Full Records
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search worker name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* LIVE WORKERS VIEW */}
      {activeTab === 'live' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-teal-50/40 flex items-center justify-between">
            <span className="text-sm font-bold text-navy-950">Active Department Workers on Shift</span>
            <span className="text-xs text-slate-500 font-medium">Auto-updated</span>
          </div>

          {liveWorkers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No workers currently checked in for your department.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {liveWorkers.map((w) => (
                <div key={w.recordId} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-teal-600 text-white font-bold flex items-center justify-center">
                      {w.workerName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-navy-950">{w.workerName}</div>
                      <div className="text-xs text-slate-500 font-mono">
                        {w.workerId} • {w.department}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-navy-950">In: {w.checkInTime}</div>
                    <div className="text-xs font-bold text-teal-700">{w.elapsedHours}h on floor</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FULL LOGS VIEW */}
      {activeTab === 'today' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Worker ID</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Check-In</th>
                  <th className="py-3 px-4">Check-Out</th>
                  <th className="py-3 px-4 text-right">Work Hours</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No records found for your department.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-navy-950">{r.workerId}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{r.workerName}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">{r.checkInTime}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">{r.checkOutTime}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-navy-950">
                        {r.workingHours}h
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={r.status} size="sm" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
