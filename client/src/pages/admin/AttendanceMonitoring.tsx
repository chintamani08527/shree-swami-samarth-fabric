import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  Clock,
  Edit3,
  Calendar,
  Building2,
  RefreshCw,
  AlertCircle,
  Check,
} from 'lucide-react';
import { attendanceApi, departmentsApi } from '../../services/api.ts';
import { AttendanceRecord, Department } from '../../types/index.ts';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

export const AttendanceMonitoring: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.workerId === 'VINAYAK4501';

  // State
  const [activeTab, setActiveTab] = useState<'all' | 'live'>('all');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [liveWorkers, setLiveWorkers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showMissingOnly, setShowMissingOnly] = useState(false);

  // Correction Modal State
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [correctionCheckIn, setCorrectionCheckIn] = useState('');
  const [correctionCheckOut, setCorrectionCheckOut] = useState('');
  const [correctionMachinesOperated, setCorrectionMachinesOperated] = useState('');
  const [correctionHoursOperated, setCorrectionHoursOperated] = useState('');
  const [correctionShiftType, setCorrectionShiftType] = useState<string>('DAY');
  const [correctionStatus, setCorrectionStatus] = useState<string>('PRESENT');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionRemarks, setCorrectionRemarks] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

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

  // Fetch Attendance records
  const loadRecords = async () => {
    try {
      setLoading(true);
      if (activeTab === 'live') {
        const res = await attendanceApi.getLiveWorkers(selectedDept || undefined);
        if (res.success) {
          setLiveWorkers(res.data);
        }
      } else {
        const res = await attendanceApi.listRecords({
          date: selectedDate || undefined,
          workerId: search || undefined,
          departmentId: selectedDept || undefined,
          status: selectedStatus || undefined,
          isMissingCheckOut: showMissingOnly ? true : undefined,
          limit: 100,
        });
        if (res.success) {
          setRecords(res.data.records);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch attendance records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [activeTab, selectedDate, selectedDept, selectedStatus, showMissingOnly]);

  // Open correction modal
  const handleOpenCorrection = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    // Format checkIn & checkOut for datetime-local input
    setCorrectionCheckIn(
      record.checkInAt ? new Date(record.checkInAt).toISOString().slice(0, 16) : ''
    );
    setCorrectionCheckOut(
      record.checkOutAt ? new Date(record.checkOutAt).toISOString().slice(0, 16) : ''
    );
    setCorrectionMachinesOperated(
      record.machinesOperated != null ? String(record.machinesOperated) : ''
    );
    setCorrectionHoursOperated(
      record.hoursOperated != null ? String(record.hoursOperated) : ''
    );
    setCorrectionShiftType(record.shiftType === 'NIGHT' ? 'NIGHT' : 'DAY');
    setCorrectionStatus(record.status);
    setCorrectionReason('');
    setCorrectionRemarks(record.remarks || '');
    setCorrectionModalOpen(true);
  };

  // Submit correction
  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    if (!correctionReason.trim() || correctionReason.trim().length < 5) {
      showToast('A mandatory reason (minimum 5 characters) is required for audit logging', 'error');
      return;
    }

    try {
      setSubmittingCorrection(true);
      const res = await attendanceApi.correctRecord(selectedRecord.id, {
        reason: correctionReason.trim(),
        checkInAt: correctionCheckIn ? new Date(correctionCheckIn).toISOString() : null,
        checkOutAt: correctionCheckOut ? new Date(correctionCheckOut).toISOString() : null,
        status: correctionStatus,
        shiftType: correctionShiftType,
        machinesOperated: correctionMachinesOperated ? parseInt(correctionMachinesOperated, 10) : null,
        hoursOperated: correctionHoursOperated ? parseFloat(correctionHoursOperated) : null,
        remarks: correctionRemarks.trim() || undefined,
      });

      if (res.success) {
        showToast('Record corrected successfully & audit logged', 'success');
        setCorrectionModalOpen(false);
        await loadRecords();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update attendance record', 'error');
    } finally {
      setSubmittingCorrection(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-navy-950 tracking-tight">
            Attendance Monitoring & Audit
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time worker presence, late arrival detection & authorized administrative corrections
          </p>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-white text-navy-950 shadow-xs'
                : 'text-slate-600 hover:text-navy-950'
            }`}
          >
            All Logs & History
          </button>
          <button
            onClick={() => setActiveTab('live')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'live'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-navy-950'
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
            </span>
            <span>Currently Checked In</span>
          </button>
        </div>
      </div>

      {/* FILTERS TOOLBAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Worker ID / Name Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search Worker ID or Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadRecords()}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Date Picker (for All tab) */}
          {activeTab === 'all' && (
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          )}

          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-700"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Status Filter (for All tab) */}
          {activeTab === 'all' && (
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-700"
            >
              <option value="">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="LATE">Late Arrival</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="ABSENT">Absent</option>
            </select>
          )}
        </div>

        {/* Quick Filter Checkboxes & Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-4">
            {activeTab === 'all' && (
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={showMissingOnly}
                  onChange={(e) => setShowMissingOnly(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-amber-700 font-semibold">Highlight Missing Check-Outs Only</span>
              </label>
            )}
          </div>

          <button
            onClick={loadRecords}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Apply Filters</span>
          </button>
        </div>
      </div>

      {/* LIVE VIEW TAB: Currently Checked In Workers */}
      {activeTab === 'live' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-teal-50/50">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-600"></span>
              </span>
              <span className="text-sm font-bold text-navy-950">
                Workers Currently On Factory Floor ({liveWorkers.length})
              </span>
            </div>
            <span className="text-xs text-slate-500">Live duration counts in real-time</span>
          </div>

          {liveWorkers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No workers currently checked in for the selected department.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {liveWorkers.map((w) => (
                <div key={w.recordId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-600 text-white font-bold flex items-center justify-center shrink-0">
                      {w.workerName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-navy-950">{w.workerName}</span>
                        <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded-md text-slate-600">
                          {w.workerId}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{w.department}</span>
                        <span>•</span>
                        <span>{w.shiftName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-auto">
                    <div className="text-right">
                      <div className="text-xs text-slate-400 font-medium">Checked In At</div>
                      <div className="text-sm font-bold text-navy-950 font-mono">{w.checkInTime}</div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-teal-700 font-bold">Floor Duration</div>
                      <div className="text-sm font-black text-teal-900 font-mono">{w.elapsedHours} hrs</div>
                    </div>

                    {w.lateMinutes > 0 && (
                      <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg font-bold">
                        Late by {w.lateMinutes}m
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ALL LOGS TABLE TAB */}
      {activeTab === 'all' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Worker ID</th>
                  <th className="py-3 px-4">Worker Name</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-center">Shift</th>
                  <th className="py-3 px-4">Check-In</th>
                  <th className="py-3 px-4">Check-Out</th>
                  <th className="py-3 px-4 text-right">Break</th>
                  <th className="py-3 px-4 text-right">Work Hours</th>
                  <th className="py-3 px-4 text-center">Custom Work</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Indicator</th>
                  {isAdmin && <th className="py-3 px-4 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-8 text-center text-slate-400">
                      No attendance records found matching filters.
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-navy-950">{r.workerId}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{r.workerName}</td>
                      <td className="py-3 px-4 text-slate-600">{r.department}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {r.formattedDate} <span className="text-[11px] text-slate-400">({r.dayOfWeek.slice(0, 3)})</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${
                          r.shiftType === 'NIGHT'
                            ? 'bg-indigo-50 text-indigo-900 border-indigo-200'
                            : 'bg-amber-50 text-amber-900 border-amber-200'
                        }`}>
                          {r.shiftType === 'NIGHT' ? '🌙 Night' : '☀️ Day'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-800">{r.checkInTime}</td>
                      <td className="py-3 px-4 font-mono text-slate-800">
                        {r.checkOutTime !== '--:--' ? r.checkOutTime : (
                          <span className="text-amber-600 font-bold text-xs bg-amber-50 px-2 py-0.5 rounded">
                            Open
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">{r.breakMinutes}m</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-navy-950">
                        {r.workingHours}h
                      </td>
                      <td className="py-3 px-4 text-center">
                        {r.machinesOperated != null || r.hoursOperated != null ? (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md whitespace-nowrap">
                            ⚙️ {r.machinesOperated ?? '--'} mc / {r.hoursOperated ?? '--'}h
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs font-mono">--</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={r.status} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-center text-xs">
                        {r.isMissingCheckOut ? (
                          <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            Missing Check-Out
                          </span>
                        ) : r.lateMinutes > 0 ? (
                          <span className="text-amber-700 font-semibold">
                            Late +{r.lateMinutes}m
                          </span>
                        ) : (
                          <span className="text-slate-400">Normal</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleOpenCorrection(r)}
                            title="Authorized Correction"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AUTHORIZED CORRECTION MODAL */}
      <Modal
        isOpen={correctionModalOpen}
        onClose={() => setCorrectionModalOpen(false)}
        title="Authorized Attendance Correction"
        subtitle={`Editing record for ${selectedRecord?.workerName} (${selectedRecord?.workerId}) on ${selectedRecord?.formattedDate}`}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveCorrection} className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              All modifications are permanent and logged to the official compliance audit log with your administrative user identity.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Check-In Timestamp</label>
              <input
                type="datetime-local"
                value={correctionCheckIn}
                onChange={(e) => setCorrectionCheckIn(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Check-Out Timestamp</label>
              <input
                type="datetime-local"
                value={correctionCheckOut}
                onChange={(e) => setCorrectionCheckOut(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Attendance Status</label>
              <select
                value={correctionStatus}
                onChange={(e) => setCorrectionStatus(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
              >
                <option value="PRESENT">PRESENT</option>
                <option value="LATE">LATE</option>
                <option value="HALF_DAY">HALF_DAY</option>
                <option value="ABSENT">ABSENT</option>
                <option value="ON_LEAVE">ON_LEAVE</option>
                <option value="HOLIDAY">HOLIDAY</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Shift Type</label>
              <select
                value={correctionShiftType}
                onChange={(e) => setCorrectionShiftType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
              >
                <option value="DAY">☀️ Day Shift</option>
                <option value="NIGHT">🌙 Night Shift</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/50 rounded-xl border border-amber-200/60">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Machines Operated (Custom)</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 4"
                value={correctionMachinesOperated}
                onChange={(e) => setCorrectionMachinesOperated(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Hours Operated (Custom)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                placeholder="e.g. 8.5"
                value={correctionHoursOperated}
                onChange={(e) => setCorrectionHoursOperated(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mandatory Correction Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              placeholder="e.g. Worker forgot phone at machine station, supervisor verified presence at loom #4."
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
            />
            <span className="text-[10px] text-slate-400">Minimum 5 characters required for compliance.</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Remarks / Note (Optional)</label>
            <input
              type="text"
              placeholder="Optional notes shown in reports"
              value={correctionRemarks}
              onChange={(e) => setCorrectionRemarks(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCorrectionModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingCorrection}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
            >
              {submittingCorrection ? 'Logging Correction...' : 'Save & Audit Log'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
