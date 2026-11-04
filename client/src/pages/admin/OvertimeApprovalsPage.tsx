import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  CheckCheck,
  User,
  Calendar,
  Layers,
  IndianRupee,
  ShieldCheck,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';
import { overtimeApi } from '../../services/api.ts';
import { OvertimeRequestItem, OvertimeRequestsResponse } from '../../types/index.ts';
import { Modal } from '../../components/common/Modal.tsx';
import { useToast } from '../../context/ToastContext.tsx';

export const OvertimeApprovalsPage: React.FC = () => {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OvertimeRequestsResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Reject Modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingItem, setRejectingItem] = useState<OvertimeRequestItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await overtimeApi.list({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load overtime requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleApprove = async (item: OvertimeRequestItem) => {
    try {
      setProcessingId(item.id);
      const res = await overtimeApi.approve(item.id);
      if (res.success) {
        showToast(`Overtime approved for ${item.workerName}. ₹${item.estimatedOtPay} added to regular salary.`, 'success');
        await loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to approve overtime', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenReject = (item: OvertimeRequestItem) => {
    setRejectingItem(item);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectingItem) return;
    try {
      setProcessingId(rejectingItem.id);
      const res = await overtimeApi.reject(rejectingItem.id, rejectionReason || 'Rejected by Admin');
      if (res.success) {
        showToast(`Overtime request for ${rejectingItem.workerName} rejected.`, 'info');
        setRejectModalOpen(false);
        setRejectingItem(null);
        await loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to reject overtime', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkApprove = async () => {
    const pendingItems = (data?.items || []).filter((i) => i.overtimeStatus === 'PENDING');
    if (pendingItems.length === 0) {
      showToast('No pending overtime requests to approve.', 'info');
      return;
    }

    const confirmMsg = `Are you sure you want to approve all ${pendingItems.length} pending overtime requests?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setBulkProcessing(true);
      const ids = pendingItems.map((i) => i.id);
      const res = await overtimeApi.bulkApprove(ids);
      if (res.success) {
        showToast(`Successfully approved ${res.count} overtime requests! Overtime pay added to regular salary.`, 'success');
        await loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to bulk approve overtime', 'error');
    } finally {
      setBulkProcessing(false);
    }
  };

  const items = data?.items || [];
  const summary = data?.summary || {
    totalPendingCount: 0,
    totalPendingAmount: 0,
    totalApprovedCount: 0,
    totalApprovedAmount: 0,
    totalRejectedCount: 0,
    totalCount: 0,
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.workerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.workerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.departmentName && item.departmentName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.attendanceDate.includes(searchTerm);
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-navy-950">
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Overtime Approvals (ओव्हरटाईम मंजुरी)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review and approve worker overtime submissions. Upon approval, overtime pay is seamlessly added to worker regular wages and weekly salary calculations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {summary.totalPendingCount > 0 && (
            <button
              onClick={handleBulkApprove}
              disabled={bulkProcessing || loading}
              className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <CheckCheck className="w-4 h-4" />
              <span>
                {bulkProcessing
                  ? 'Approving...'
                  : `Bulk Approve All (${summary.totalPendingCount})`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Pending Approvals */}
        <div
          onClick={() => setStatusFilter('PENDING')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group active:scale-[0.98] ${
            statusFilter === 'PENDING'
              ? 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/40 shadow-md'
              : 'bg-white border-slate-200/80 hover:border-amber-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Pending Approvals (बाकी)
            </span>
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl group-hover:scale-110 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-700">
            {summary.totalPendingCount}
          </div>
          <div className="text-[11px] font-semibold text-amber-900 mt-1">
            Pending Pay: ₹ {summary.totalPendingAmount.toLocaleString('en-IN')}
          </div>
        </div>

        {/* 2. Approved Overtime */}
        <div
          onClick={() => setStatusFilter('APPROVED')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group active:scale-[0.98] ${
            statusFilter === 'APPROVED'
              ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/40 shadow-md'
              : 'bg-white border-slate-200/80 hover:border-emerald-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Approved (मंजूर केलेले)
            </span>
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl group-hover:scale-110 transition-transform">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700">
            {summary.totalApprovedCount}
          </div>
          <div className="text-[11px] font-semibold text-emerald-900 mt-1">
            Added to Salary: ₹ {summary.totalApprovedAmount.toLocaleString('en-IN')}
          </div>
        </div>

        {/* 3. Rejected Overtime */}
        <div
          onClick={() => setStatusFilter('REJECTED')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group active:scale-[0.98] ${
            statusFilter === 'REJECTED'
              ? 'bg-rose-50/70 border-rose-500 ring-2 ring-rose-500/40 shadow-md'
              : 'bg-white border-slate-200/80 hover:border-rose-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
              Rejected (नाकारलेले)
            </span>
            <div className="p-2 bg-rose-100 text-rose-700 rounded-xl group-hover:scale-110 transition-transform">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-700">
            {summary.totalRejectedCount}
          </div>
          <div className="text-[11px] font-semibold text-rose-900 mt-1">
            Not added to regular wage
          </div>
        </div>

        {/* 4. Total Records */}
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group active:scale-[0.98] ${
            statusFilter === 'ALL'
              ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/40 shadow-md'
              : 'bg-white border-slate-200/80 hover:border-blue-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
              All Requests (एकूण)
            </span>
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl group-hover:scale-110 transition-transform">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-900">
            {summary.totalCount}
          </div>
          <div className="text-[11px] font-semibold text-blue-700 mt-1">
            Tap to view entire history
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'PENDING'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Pending (बाकी)</span>
            {summary.totalPendingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-amber-500 text-white rounded-full">
                {summary.totalPendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'APPROVED'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            <span>Approved (मंजूर)</span>
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-emerald-100 text-emerald-700 rounded-full font-bold">
              {summary.totalApprovedCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'REJECTED'
                ? 'bg-white text-rose-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>Rejected (नाकारलेले)</span>
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-rose-100 text-rose-700 rounded-full font-bold">
              {summary.totalRejectedCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
              statusFilter === 'ALL'
                ? 'bg-white text-navy-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>All Requests</span>
          </button>
        </div>

        {/* Search Field */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search worker name, ID, date..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Main Overtime Cards / Table */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">Loading overtime records...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
            <Clock className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-navy-950">No Overtime Requests Found</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1">
            {statusFilter === 'PENDING'
              ? 'Great! There are no pending overtime approval requests waiting for action.'
              : 'No overtime records match your current filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {filteredItems.map((item) => {
            const isPending = item.overtimeStatus === 'PENDING';
            const isApproved = item.overtimeStatus === 'APPROVED';
            const isRejected = item.overtimeStatus === 'REJECTED';
            const isProcessing = processingId === item.id;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                  isPending
                    ? 'border-amber-300 shadow-sm hover:shadow-md'
                    : isApproved
                    ? 'border-slate-200 hover:border-emerald-300'
                    : 'border-slate-200 opacity-80'
                }`}
              >
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Left: Worker Info & Shift */}
                  <div className="flex items-start gap-3 sm:gap-4 flex-1">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-navy-900 text-white font-black text-sm sm:text-base flex items-center justify-center shrink-0 shadow-xs">
                      {item.workerName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base sm:text-lg font-bold text-navy-950">
                          {item.workerName}
                        </span>
                        <span className="px-2 py-0.5 text-[11px] font-bold bg-slate-100 text-slate-700 rounded-md">
                          {item.workerId}
                        </span>
                        <span className="px-2 py-0.5 text-[11px] font-semibold bg-teal-50 text-teal-800 rounded-md">
                          {item.departmentName} • {item.unit}
                        </span>
                        <span className={`px-2 py-0.5 text-[11px] font-bold rounded-md ${
                          item.shiftType === 'NIGHT'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {item.shiftType === 'NIGHT' ? '🌙 Night Shift' : '☀️ Day Shift'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-500 mt-1.5 flex-wrap">
                        <div className="flex items-center gap-1 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Date: <strong className="text-slate-800">{item.attendanceDate}</strong></span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Shift In/Out: <strong>{item.checkInTime}</strong> - <strong>{item.checkOutTime}</strong></span>
                        </div>
                        {item.phone && (
                          <span className="text-slate-400">Phone: {item.phone}</span>
                        )}
                      </div>

                      {item.remarks && (
                        <div className="mt-2 text-xs bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200/60 flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Worker Remark: <em>"{item.remarks}"</em></span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle: Overtime Breakdown */}
                  <div className="flex items-center gap-4 sm:gap-6 bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200/70 shrink-0">
                    <div className="text-center">
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        OT Machines
                      </div>
                      <div className="text-base sm:text-lg font-black text-navy-950 mt-0.5">
                        {item.overtimeMachines > 0 ? `${item.overtimeMachines} Mc` : (item.machinesOperated ? `${item.machinesOperated} Mc` : '1 Mc')}
                      </div>
                    </div>

                    <div className="w-px h-8 bg-slate-200" />

                    <div className="text-center">
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        OT Hours
                      </div>
                      <div className="text-base sm:text-lg font-black text-navy-950 mt-0.5">
                        {item.overtimeHours > 0 ? `${item.overtimeHours} hrs` : '--'}
                      </div>
                    </div>

                    <div className="w-px h-8 bg-slate-200" />

                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Calculated OT Pay
                      </div>
                      <div className="text-lg sm:text-xl font-black text-emerald-600 mt-0.5 flex items-center justify-end">
                        <span>₹ {item.estimatedOtPay.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        {item.wageType === 'CUSTOM'
                          ? `Custom @ ₹${item.customWageRate || 0}/mc/hr`
                          : `Fixed @ ₹${item.dailyWage || 1000}/day`}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions / Status */}
                  <div className="flex items-center justify-end gap-2 shrink-0">
                    {isPending ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenReject(item)}
                          disabled={isProcessing}
                          className="px-3.5 py-2 text-xs sm:text-sm font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                        >
                          नाकार (Reject)
                        </button>
                        <button
                          onClick={() => handleApprove(item)}
                          disabled={isProcessing}
                          className="flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>{isProcessing ? 'Saving...' : 'मंजूर करा (Approve)'}</span>
                        </button>
                      </div>
                    ) : isApproved ? (
                      <div className="text-right">
                        <div className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Approved (मंजूर)</span>
                        </div>
                        {item.overtimeApprovedBy && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            By {item.overtimeApprovedBy}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-right">
                        <div className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded-lg border border-rose-200">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Rejected (नाकारलेले)</span>
                        </div>
                        {item.overtimeRejectionReason && (
                          <div className="text-[10px] text-rose-500 mt-1 max-w-44 text-right truncate" title={item.overtimeRejectionReason}>
                            Reason: {item.overtimeRejectionReason}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Overtime Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Overtime Request (ओव्हरटाईम नाकारा)"
      >
        {rejectingItem && (
          <div className="space-y-4">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
              <div className="text-xs font-bold text-rose-900">
                Rejecting Overtime for: <strong className="text-rose-950">{rejectingItem.workerName} ({rejectingItem.workerId})</strong>
              </div>
              <div className="text-xs text-rose-700 mt-1">
                Date: {rejectingItem.attendanceDate} • Overtime: {rejectingItem.overtimeHours} hrs • Amount: ₹ {rejectingItem.estimatedOtPay}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Rejection Reason (नाकारण्याचे कारण)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Overtime hours not verified on floor, duplicate submission, incorrect machine count..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={processingId === rejectingItem.id}
                className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 disabled:opacity-50"
              >
                {processingId === rejectingItem.id ? 'Rejecting...' : 'Confirm Reject (नाकार करा)'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
