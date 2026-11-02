import React, { useState, useEffect } from 'react';
import { ScrollText, Search, Filter, Shield, Eye, Calendar, RefreshCw } from 'lucide-react';
import { auditApi } from '../../services/api.ts';
import { AuditLogItem } from '../../types/index.ts';
import { Modal } from '../../components/common/Modal.tsx';
import { useToast } from '../../context/ToastContext.tsx';

export const AuditLogsPage: React.FC = () => {
  const { showToast } = useToast();

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  // JSON Details Modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const res = await auditApi.list({
        action: actionFilter || undefined,
        entityType: entityFilter || undefined,
        limit: 50,
      });
      if (res.success) {
        setLogs(res.data.logs);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load audit logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [actionFilter, entityFilter]);

  const handleOpenDetails = (log: AuditLogItem) => {
    setSelectedLog(log);
    setDetailsModalOpen(true);
  };

  const formatTimestamp = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-navy-950 tracking-tight">
            Security & Compliance Audit Trail
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Immutable log of all attendance corrections, worker profile updates, and administrative overrides
          </p>
        </div>

        <button
          onClick={loadAuditLogs}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Audit Trail</span>
        </button>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">All Actions</option>
          <option value="CORRECTION">Attendance Corrections</option>
          <option value="WORKER_CREATED">Worker Registrations</option>
          <option value="WORKER_UPDATED">Worker Profile Edits</option>
          <option value="WORKER_DEACTIVATED">Worker Deactivations</option>
          <option value="PIN_RESET">PIN / Credential Resets</option>
          <option value="SETTINGS_UPDATED">Settings & Shift Changes</option>
        </select>

        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">All Entities</option>
          <option value="ATTENDANCE">Attendance Records</option>
          <option value="WORKER">Worker Accounts</option>
          <option value="DEPARTMENT">Departments</option>
          <option value="SETTINGS">Company Settings</option>
          <option value="SHIFT">Shifts</option>
        </select>
      </div>

      {/* AUDIT LOG TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Timestamp (IST)</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Mandatory Reason</th>
                <th className="py-3 px-4 text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No audit records matching criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap text-xs">
                      {formatTimestamp(log.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-navy-950">{log.actorName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {log.actorWorkerId} • {log.actorRole}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200/60">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-semibold">{log.entityType}</td>
                    <td className="py-3 px-4 text-slate-800 max-w-xs truncate leading-relaxed">
                      {log.reason}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleOpenDetails(log)}
                        title="View Audit Details"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-navy-950 hover:bg-slate-100 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON DETAILS MODAL */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title="Audit Log Event Details"
        subtitle={`Action: ${selectedLog?.action} on ${selectedLog?.entityType}`}
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-400 block font-bold uppercase">Actor</span>
              <span className="font-bold text-navy-950 mt-1 block">
                {selectedLog?.actorName} ({selectedLog?.actorWorkerId})
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-400 block font-bold uppercase">Timestamp (IST)</span>
              <span className="font-mono text-navy-950 mt-1 block">
                {selectedLog?.createdAt ? formatTimestamp(selectedLog.createdAt) : ''}
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl text-xs">
            <span className="text-slate-400 block font-bold uppercase mb-1">Mandatory Stated Reason</span>
            <p className="text-slate-800 font-medium leading-relaxed">{selectedLog?.reason}</p>
          </div>

          <div>
            <span className="text-xs font-bold text-slate-700 block mb-1">State Diffs & Metadata</span>
            <pre className="p-4 bg-slate-900 text-teal-300 font-mono text-xs rounded-xl overflow-x-auto max-h-60">
              {JSON.stringify(selectedLog?.details, null, 2) || '// No additional payload'}
            </pre>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setDetailsModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
