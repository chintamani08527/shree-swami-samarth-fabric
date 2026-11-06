import React, { useState, useEffect } from 'react';
import {
  IndianRupee,
  PlusCircle,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  User,
  Calendar,
  AlertCircle,
  FileCheck,
  Trash2,
  RotateCcw,
  CreditCard,
  Banknote,
  Receipt,
  Check,
  Scissors,
  History,
} from 'lucide-react';
import { advanceApi, workersApi } from '../../services/api.ts';
import { AdvanceRecord, AdvanceStats, User as WorkerUser } from '../../types/index.ts';
import { Modal } from '../../components/common/Modal.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

export const AdvanceManagement: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  // Main state
  const [loading, setLoading] = useState(true);
  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);
  const [stats, setStats] = useState<AdvanceStats>({
    totalActive: 0,
    totalDeducted: 0,
    totalRepaid: 0,
    totalDisbursed: 0,
    countActive: 0,
    countPendingRequests: 0,
    totalRecords: 0,
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Workers for modal dropdown
  const [workersList, setWorkersList] = useState<WorkerUser[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);

  // Disburse Advance Modal
  const [disburseModalOpen, setDisburseModalOpen] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER'>('CASH');
  const [advanceReason, setAdvanceReason] = useState('');
  const [submittingDisburse, setSubmittingDisburse] = useState(false);

  // Reject Request Modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingAdvanceId, setRejectingAdvanceId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  // Custom Cutting Modal
  const [cutModalOpen, setCutModalOpen] = useState(false);
  const [cuttingAdvance, setCuttingAdvance] = useState<AdvanceRecord | null>(null);
  const [cutAmount, setCutAmount] = useState('');
  const [cutDate, setCutDate] = useState(new Date().toISOString().split('T')[0]);
  const [cutNotes, setCutNotes] = useState('');
  const [submittingCut, setSubmittingCut] = useState(false);

  // Cutting History Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyAdvance, setHistoryAdvance] = useState<AdvanceRecord | null>(null);
  const [revertingDeductionId, setRevertingDeductionId] = useState<string | null>(null);

  // Action loading state
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Load advances and stats
  const loadAdvances = async () => {
    try {
      setLoading(true);
      const res = await advanceApi.getAllAdvances({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        unit: unitFilter === 'ALL' ? undefined : unitFilter,
        search: searchTerm.trim() || undefined,
      });

      if (res.success && res.data) {
        setAdvances(res.data.advances || []);
        setStats(res.data.stats || {
          totalActive: 0,
          totalDeducted: 0,
          totalRepaid: 0,
          totalDisbursed: 0,
          countActive: 0,
          countPendingRequests: 0,
          totalRecords: 0,
        });
      }
    } catch (err: any) {
      showToast(err.message || 'उचल यादी आणण्यात त्रुटी आली / Failed to fetch advances', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Load workers for disburse dropdown
  const loadWorkers = async () => {
    try {
      setLoadingWorkers(true);
      const res = await workersApi.list({ isActive: true, limit: 200 });
      if (res.success && res.data) {
        const list = Array.isArray(res.data) ? res.data : (res.data.workers || []);
        // Only include workers and supervisors who can receive advances
        const filtered = list.filter((w: WorkerUser) => w.role === 'WORKER' || w.role === 'SUPERVISOR');
        setWorkersList(filtered);
      }
    } catch (err) {
      // Non-blocking
    } finally {
      setLoadingWorkers(false);
    }
  };

  useEffect(() => {
    loadAdvances();
  }, [statusFilter, unitFilter]);

  useEffect(() => {
    loadWorkers();
  }, []);

  // Handle Search submit / debounce
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadAdvances();
  };

  // Disburse Advance Form Submission
  const handleDisburseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(advanceAmount);
    if (!selectedWorkerId) {
      showToast('कृपया कामगार निवडा / Please select a worker', 'error');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      showToast('कृपया योग्य उचल रक्कम टाका / Please enter a valid amount', 'error');
      return;
    }

    try {
      setSubmittingDisburse(true);
      const res = await advanceApi.createAdvance({
        userId: selectedWorkerId,
        amount: amt,
        advanceDate,
        paymentMode,
        reason: advanceReason.trim() || 'Worker advance (उचल)',
      });

      if (res.success) {
        showToast(res.message || 'उचल यशस्वीरीत्या नोंदवली! / Advance recorded successfully', 'success');
        setDisburseModalOpen(false);
        // Reset form
        setSelectedWorkerId('');
        setAdvanceAmount('');
        setAdvanceReason('');
        setPaymentMode('CASH');
        await loadAdvances();
      }
    } catch (err: any) {
      showToast(err.message || 'उचल नोंदवण्यात त्रुटी / Failed to record advance', 'error');
    } finally {
      setSubmittingDisburse(false);
    }
  };

  // Status updates: Approve request (mark ACTIVE), Mark DEDUCTED, Mark REPAID, Revert ACTIVE
  const handleUpdateStatus = async (advanceId: string, newStatus: string, successMsg: string) => {
    try {
      setActionLoadingId(advanceId);
      const res = await advanceApi.updateStatus(advanceId, newStatus);
      if (res.success) {
        showToast(successMsg, 'success');
        await loadAdvances();
      }
    } catch (err: any) {
      showToast(err.message || 'स्थिती बदलण्यात त्रुटी / Status update failed', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Reject Modal
  const handleOpenReject = (advanceId: string) => {
    setRejectingAdvanceId(advanceId);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  // Confirm Reject
  const handleConfirmReject = async () => {
    if (!rejectingAdvanceId) return;
    try {
      setSubmittingReject(true);
      const res = await advanceApi.updateStatus(
        rejectingAdvanceId,
        'REJECTED',
        rejectionReason.trim() || 'Admin rejected advance request'
      );
      if (res.success) {
        showToast('उचल मागणी नाकारली / Advance request rejected', 'info');
        setRejectModalOpen(false);
        setRejectingAdvanceId(null);
        await loadAdvances();
      }
    } catch (err: any) {
      showToast(err.message || 'मागणी नाकारण्यात त्रुटी / Failed to reject', 'error');
    } finally {
      setSubmittingReject(false);
    }
  };

  // Delete Advance Record (Admin only)
  const handleDeleteAdvance = async (advance: AdvanceRecord) => {
    if (!window.confirm(`खरोखर ही ₹${advance.amount} उचल नोंद काढून टाकायची आहे का? (${advance.user?.name || advance.workerId})`)) {
      return;
    }
    try {
      setActionLoadingId(advance.id);
      const res = await advanceApi.deleteAdvance(advance.id);
      if (res.success) {
        showToast('उचल नोंद हटवली / Advance record deleted', 'success');
        await loadAdvances();
      }
    } catch (err: any) {
      showToast(err.message || 'नोंद हटवण्यात त्रुटी / Failed to delete advance', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Custom Cut Modal
  const handleOpenCutModal = (adv: AdvanceRecord) => {
    setCuttingAdvance(adv);
    setCutAmount('');
    setCutNotes('');
    setCutDate(new Date().toISOString().split('T')[0]);
    setCutModalOpen(true);
  };

  // Submit Custom Cutting
  const handleCutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cuttingAdvance) return;
    const amountNum = parseFloat(cutAmount);
    const maxBalance = cuttingAdvance.balanceAmount != null ? cuttingAdvance.balanceAmount : cuttingAdvance.amount;
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('कृपया वैध कपात रक्कम प्रविष्ट करा / Enter valid cutting amount', 'error');
      return;
    }
    if (amountNum > maxBalance) {
      showToast(`कपात रक्कम शिल्लक उचलीपेक्षा (₹${maxBalance}) जास्त असू शकत नाही`, 'error');
      return;
    }

    try {
      setSubmittingCut(true);
      const res = await advanceApi.recordCustomDeduction(
        cuttingAdvance.id,
        amountNum,
        cutDate,
        cutNotes.trim() || undefined
      );
      if (res.success) {
        showToast(res.message || 'कपात यशस्वीरीत्या नोंदवली / Deduction recorded successfully', 'success');
        setCutModalOpen(false);
        setCuttingAdvance(null);
        await loadAdvances();
      }
    } catch (err: any) {
      showToast(err.message || 'कपात नोंदवण्यात त्रुटी आली / Failed to record deduction', 'error');
    } finally {
      setSubmittingCut(false);
    }
  };

  // Open History Modal
  const handleOpenHistoryModal = (adv: AdvanceRecord) => {
    setHistoryAdvance(adv);
    setHistoryModalOpen(true);
  };

  // Revert / Delete Deduction
  const handleRevertDeduction = async (deductionId: string) => {
    if (!window.confirm('ही कपात नोंद खरोखर रद्द करायची आहे का? (Are you sure you want to revert this deduction?)')) {
      return;
    }
    try {
      setRevertingDeductionId(deductionId);
      const res = await advanceApi.deleteDeduction(deductionId);
      if (res.success) {
        showToast('कपात नोंद रद्द केली व रक्कम उचलीत पुन्हा जमा झाली / Deduction reverted', 'success');
        await loadAdvances();
        if (res.data) {
          setHistoryAdvance(res.data);
        } else {
          setHistoryModalOpen(false);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'कपात रद्द करण्यात त्रुटी आली / Failed to revert deduction', 'error');
    } finally {
      setRevertingDeductionId(null);
    }
  };

  // Separate pending requests from settled/active advances
  const pendingRequests = advances.filter((a) => a.status === 'REQUESTED');
  const regularAdvances = advances.filter((a) => a.status !== 'REQUESTED');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse" />
            Active • शिल्लक उचल
          </span>
        );
      case 'DEDUCTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <Check className="w-3 h-3 text-slate-600" />
            Deducted • पगारातून वजा
          </span>
        );
      case 'REPAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            Repaid • परतफेड
          </span>
        );
      case 'REQUESTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
            <Clock className="w-3 h-3 text-amber-600" />
            Requested • मागणी
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-500" />
            Rejected • नाकारले
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  const getPaymentModeBadge = (mode: string) => {
    switch (mode) {
      case 'CASH':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            <Banknote className="w-3 h-3 text-emerald-600" />
            Cash
          </span>
        );
      case 'UPI':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
            <CreditCard className="w-3 h-3 text-indigo-600" />
            UPI
          </span>
        );
      case 'BANK_TRANSFER':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
            <Building2 className="w-3 h-3 text-sky-600" />
            Bank Transfer
          </span>
        );
      default:
        return <span className="text-[11px] text-slate-600">{mode}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold shadow-xs">
              ₹
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-navy-950 tracking-tight">
                Advance Management • कामगार उचल
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                कामगारांची उचल नोंदवा, मागणी मंजूर करा आणि आठवड्याच्या पगारातील वजावट मॉनिटर करा.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadAdvances}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-navy-950 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setDisburseModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm shadow-md shadow-teal-700/25 transition-all tap-active"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Give Advance • उचल नोंदवा</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Total Active Outstanding Advance */}
        <div className="bg-gradient-to-br from-teal-50 via-white to-teal-50/30 p-4 rounded-2xl border border-teal-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-teal-800">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Active Advance • शिल्लक उचल
            </span>
            <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700 font-bold">
              ₹
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-teal-950">
            ₹{stats.totalActive.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-teal-700 font-medium">
            {(stats.countActive ?? advances.filter((a) => a.status === 'ACTIVE').length)} active worker {((stats.countActive ?? advances.filter((a) => a.status === 'ACTIVE').length) === 1 ? 'balance' : 'balances')}
          </div>
        </div>

        {/* 2. Pending Requests */}
        <div
          className={`p-4 rounded-2xl border shadow-xs space-y-1 transition-all ${
            stats.countPendingRequests > 0
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/20'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Pending Requests • प्रलंबित मागण्या
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-950">
            {stats.countPendingRequests}
          </div>
          <div className="text-[11px] text-amber-700 font-medium">
            {stats.countPendingRequests > 0
              ? 'कामगारांच्या मंजुरीच्या प्रतीक्षेत'
              : 'सर्व मागण्या मंजूर / निरंक'}
          </div>
        </div>

        {/* 3. Total Deducted */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Deducted • पगारातून वजा
            </span>
            <CheckCircle2 className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">
            ₹{stats.totalDeducted.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Wages settled via deduction
          </div>
        </div>

        {/* 4. Total Disbursed */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Total Disbursed • एकूण दिलेली उचल
            </span>
            <Receipt className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">
            ₹{stats.totalDisbursed.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Lifetime recorded advances
          </div>
        </div>
      </div>

      {/* PENDING WORKER ADVANCE REQUESTS SECTION (Highlight when items exist) */}
      {pendingRequests.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-50 to-white rounded-2xl p-5 border-2 border-amber-300 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-amber-950">
                  Worker Advance Requests • कामगारांच्या उचल मागण्या ({pendingRequests.length})
                </h2>
                <p className="text-xs text-amber-800">
                  कामगारांनी ॲपवरून उचल मागणी पाठवली आहे. तपासून मंजूर किंवा नाकारा.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold bg-amber-200/80 text-amber-900 px-3 py-1 rounded-full animate-pulse">
              Action Required • तात्काळ निर्णय
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white rounded-xl p-4 border border-amber-200 shadow-2xs space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-extrabold text-navy-950 text-sm">
                        {req.user?.name || req.workerId}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        ID: {req.workerId} • {req.user?.unit || 'Unit 1'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-teal-800">
                        ₹{req.amount.toLocaleString('en-IN')}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {new Date(req.advanceDate).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {req.reason && (
                    <div className="mt-2.5 p-2 bg-slate-50 rounded-lg text-xs text-slate-700 border border-slate-100">
                      <span className="font-semibold text-slate-500 text-[10px] uppercase block">
                        Reason • कारण:
                      </span>
                      {req.reason}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() =>
                      handleUpdateStatus(
                        req.id,
                        'ACTIVE',
                        `उचल मंजूर केली! ₹${req.amount} कामगाराच्या खात्यावर नोंदवली गेली.`
                      )
                    }
                    disabled={actionLoadingId === req.id}
                    className="flex-1 py-2 px-3 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
                  >
                    {actionLoadingId === req.id ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve • मंजूर करा</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleOpenReject(req.id)}
                    disabled={actionLoadingId === req.id}
                    className="py-2 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          {/* Search box */}
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by worker name, ID or reason..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/30 transition-all"
            />
          </form>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
              <span className="px-2 text-slate-400 text-[10px] uppercase font-bold">Status:</span>
              {(['ALL', 'ACTIVE', 'DEDUCTED', 'REPAID', 'REQUESTED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    statusFilter === st
                      ? 'bg-white text-navy-950 shadow-xs font-bold'
                      : 'hover:text-navy-950'
                  }`}
                >
                  {st === 'ALL'
                    ? 'All'
                    : st === 'ACTIVE'
                    ? 'Active'
                    : st === 'DEDUCTED'
                    ? 'Deducted'
                    : st === 'REPAID'
                    ? 'Repaid'
                    : 'Requests'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
              <span className="px-2 text-slate-400 text-[10px] uppercase font-bold">Unit:</span>
              {['ALL', 'Unit 1', 'Unit 2'].map((u) => (
                <button
                  key={u}
                  onClick={() => setUnitFilter(u)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    unitFilter === u
                      ? 'bg-white text-navy-950 shadow-xs font-bold'
                      : 'hover:text-navy-950'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ALL ADVANCES TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-navy-950 text-sm">
              All Advance Records • उचल नोंदी
            </h3>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono font-bold">
              {regularAdvances.length + pendingRequests.length}
            </span>
          </div>
          <span className="text-xs text-slate-500">
            Sorted by most recent advance date
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium">Loading advance records...</p>
          </div>
        ) : advances.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-600">कोणतीही उचल नोंद आढळली नाही</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No advances match the current filters. Click "Give Advance" above to register an advance.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Worker • कामगार</th>
                  <th className="py-3 px-3">Date • तारीख</th>
                  <th className="py-3 px-3">Amount • रक्कम</th>
                  <th className="py-3 px-3">Mode</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                  <th className="py-3 px-3">Status • स्थिती</th>
                  <th className="py-3 px-3 text-right">Actions • कृती</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {advances.map((adv) => {
                  const isActionLoading = actionLoadingId === adv.id;
                  return (
                    <tr key={adv.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Worker info */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-navy-950 text-sm">
                          {adv.user?.name || adv.workerId}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-[10px]">
                            {adv.workerId}
                          </span>
                          <span>•</span>
                          <span>{adv.user?.unit || 'Unit 1'}</span>
                          {adv.user?.department?.name && (
                            <>
                              <span>•</span>
                              <span>{adv.user.department.name}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                        {new Date(adv.advanceDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-sm font-black text-navy-950 block">
                          ₹{adv.amount.toLocaleString('en-IN')}
                        </span>
                        {adv.status === 'ACTIVE' && (
                          <div className="text-[10px] space-y-0.5 mt-0.5">
                            <span className="text-rose-700 font-bold block">
                              शिल्लक: ₹{(adv.balanceAmount ?? adv.amount).toLocaleString('en-IN')}
                            </span>
                            {(adv.deductedAmount || 0) > 0 && (
                              <span className="text-slate-500 font-medium block">
                                कपात: ₹{(adv.deductedAmount || 0).toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                        )}
                        {adv.status === 'DEDUCTED' && (
                          <span className="text-[10px] text-slate-500 block">
                            पूर्ण कपात (Deducted)
                          </span>
                        )}
                      </td>

                      {/* Payment Mode */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {getPaymentModeBadge(adv.paymentMode)}
                      </td>

                      {/* Reason */}
                      <td className="py-3 px-4 max-w-xs">
                        <span className="text-slate-800 font-medium block truncate" title={adv.reason || ''}>
                          {adv.reason || '—'}
                        </span>
                        {adv.deductions && adv.deductions.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenHistoryModal(adv)}
                            className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded border border-teal-200 transition-colors"
                          >
                            <History className="w-3 h-3 text-teal-600" />
                            <span>कपात नोंदी ({adv.deductions.length})</span>
                          </button>
                        )}
                        {adv.rejectionReason && (
                          <span className="text-[10px] text-rose-600 block mt-0.5">
                            Rejection Note: {adv.rejectionReason}
                          </span>
                        )}
                        {adv.deductedAt && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Deducted on {new Date(adv.deductedAt).toLocaleDateString('en-IN')}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {getStatusBadge(adv.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* If ACTIVE: Cut Advance is primary, plus history, full deduction and repayment */}
                          {adv.status === 'ACTIVE' && (
                            <>
                              <button
                                onClick={() => handleOpenCutModal(adv)}
                                disabled={isActionLoading}
                                className="px-2.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition-colors flex items-center gap-1 shadow-xs"
                                title="कस्टम उचल कपात नोंदवा (Record custom advance cutting)"
                              >
                                <Scissors className="w-3 h-3" />
                                <span>कपात नोंदवा</span>
                              </button>

                              {adv.deductions && adv.deductions.length > 0 && (
                                <button
                                  onClick={() => handleOpenHistoryModal(adv)}
                                  className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center gap-1"
                                  title="कपात इतिहास पहा (View deduction history)"
                                >
                                  <History className="w-3 h-3 text-slate-600" />
                                  <span className="hidden sm:inline">इतिहास ({adv.deductions.length})</span>
                                </button>
                              )}

                              <button
                                onClick={() =>
                                  handleUpdateStatus(
                                    adv.id,
                                    'DEDUCTED',
                                    `₹${adv.balanceAmount ?? adv.amount} पूर्ण पगारातून वजा म्हणून नोंदवले! / Marked as Deducted from salary.`
                                  )
                                }
                                disabled={isActionLoading}
                                className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs transition-colors flex items-center gap-1"
                                title="पूर्ण शिल्लक पगारातून वजा करा"
                              >
                                <Check className="w-3 h-3 text-slate-500" />
                                <span className="hidden sm:inline">पूर्ण वजा</span>
                              </button>

                              <button
                                onClick={() =>
                                  handleUpdateStatus(
                                    adv.id,
                                    'REPAID',
                                    `₹${adv.balanceAmount ?? adv.amount} रोख परतफेड म्हणून नोंदवले! / Marked as Repaid.`
                                  )
                                }
                                disabled={isActionLoading}
                                className="px-2 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs transition-colors flex items-center gap-1"
                                title="रोख परतफेड (Mark as Repaid in cash)"
                              >
                                <RotateCcw className="w-3 h-3 text-blue-600" />
                                <span className="hidden sm:inline">परतफेड</span>
                              </button>
                            </>
                          )}

                          {/* If REQUESTED: Approve or Reject */}
                          {adv.status === 'REQUESTED' && (
                            <>
                              <button
                                onClick={() =>
                                  handleUpdateStatus(
                                    adv.id,
                                    'ACTIVE',
                                    `उचल मंजूर केली! ₹${adv.amount} कामगाराच्या खात्यावर नोंदवली गेली.`
                                  )
                                }
                                disabled={isActionLoading}
                                className="px-2.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition-colors flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                <span>Approve</span>
                              </button>

                              <button
                                onClick={() => handleOpenReject(adv.id)}
                                disabled={isActionLoading}
                                className="px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {/* If DEDUCTED or REPAID: Can revert to ACTIVE if clicked accidentally */}
                          {(adv.status === 'DEDUCTED' || adv.status === 'REPAID') && (
                            <button
                              onClick={() =>
                                handleUpdateStatus(
                                  adv.id,
                                  'ACTIVE',
                                  `पुन्हा शिल्लक उचल म्हणून सक्रिय केले / Reverted to Active advance.`
                                )
                              }
                              disabled={isActionLoading}
                              className="px-2 py-1 rounded-lg text-slate-400 hover:text-teal-700 hover:bg-teal-50 transition-colors text-[11px]"
                              title="Revert back to Active balance (पुन्हा सक्रिय करा)"
                            >
                              Revert to Active
                            </button>
                          )}

                          {/* Delete Action (Admin Only) */}
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteAdvance(adv)}
                              disabled={isActionLoading}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete advance record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: DISBURSE ADVANCE (नवीन उचल नोंदवा) */}
      <Modal
        isOpen={disburseModalOpen}
        onClose={() => !submittingDisburse && setDisburseModalOpen(false)}
        title="Give Advance to Worker • कामगारास उचल नोंदवा"
      >
        <form onSubmit={handleDisburseSubmit} className="space-y-4">
          <p className="text-xs text-slate-500">
            कामगारास रोख किंवा बँक/UPI द्वारे उचल दिल्यास येथे नोंद करा. ही रक्कम त्यांच्या आगामी पगारातून वजा केली जाईल.
          </p>

          {/* Worker Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Select Worker • कामगार निवडा *
            </label>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/40 font-medium"
            >
              <option value="">-- कामगार निवडा / Select Worker --</option>
              {workersList.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.workerId}) — {w.unit || 'Unit 1'}
                </option>
              ))}
            </select>
          </div>

          {/* Advance Amount */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Advance Amount • उचल रक्कम (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">
                ₹
              </span>
              <input
                type="number"
                min="1"
                step="any"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="उदा. 30000 किंवा 2000"
                required
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-base font-black text-navy-950 focus:outline-none focus:ring-2 focus:ring-teal-600/40 font-mono"
              />
            </div>
            {/* Quick Amount Suggestion Chips */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {[1000, 2000, 5000, 10000, 20000, 30000].map((quick) => (
                <button
                  type="button"
                  key={quick}
                  onClick={() => setAdvanceAmount(String(quick))}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 border border-slate-200 transition-colors"
                >
                  ₹{quick.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>

          {/* Advance Date & Payment Mode Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Date • तारीख *
              </label>
              <input
                type="date"
                value={advanceDate}
                onChange={(e) => setAdvanceDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-600/40"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Payment Mode • माध्यम *
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/40 font-medium"
              >
                <option value="CASH">💵 Cash (रोख)</option>
                <option value="UPI">📱 UPI (PhonePe / GPay)</option>
                <option value="BANK_TRANSFER">🏦 Bank Transfer (बँक)</option>
              </select>
            </div>
          </div>

          {/* Reason / Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Reason / Remarks • उचल देण्याचे कारण
            </label>
            <input
              type="text"
              value={advanceReason}
              onChange={(e) => setAdvanceReason(e.target.value)}
              placeholder="उदा. सण, वैद्यकीय खर्च, घरगुती गरज..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/40"
            />
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setDisburseModalOpen(false)}
              disabled={submittingDisburse}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingDisburse}
              className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs shadow-md shadow-teal-700/25 flex items-center gap-2 tap-active disabled:opacity-50"
            >
              {submittingDisburse ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>नोंद होत आहे...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Save Advance • उचल नोंदवा</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: REJECT ADVANCE REQUEST (उचल मागणी नाकारा) */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => !submittingReject && setRejectModalOpen(false)}
        title="Reject Advance Request • उचल मागणी नाकारा"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            कामगारास ही उचल मागणी नाकारण्याचे कारण कळवण्यासाठी खालील कारण प्रविष्ट करा.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Reason for Rejection • नाकारण्याचे कारण
            </label>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="उदा. मागील उचल शिल्लक आहे, महिन्याचा कोटा संपला..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setRejectModalOpen(false)}
              disabled={submittingReject}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs"
            >
              रद्द करा / Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmReject}
              disabled={submittingReject}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/25 flex items-center gap-1.5 tap-active disabled:opacity-50"
            >
              {submittingReject ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              <span>Reject Request • मागणी नाकारा</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: CUSTOM CUT ADVANCE (कस्टम उचल कपात) */}
      <Modal
        isOpen={cutModalOpen}
        onClose={() => !submittingCut && setCutModalOpen(false)}
        title="Cut Advance • उचल कपात नोंदवा"
      >
        {cuttingAdvance && (() => {
          const currentBalance = cuttingAdvance.balanceAmount != null ? cuttingAdvance.balanceAmount : cuttingAdvance.amount;
          const deductedSoFar = cuttingAdvance.deductedAmount || 0;
          return (
            <form onSubmit={handleCutSubmit} className="space-y-4">
              {/* Worker info card */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 font-medium">कामगार (Worker):</span>
                    <strong className="text-sm font-bold text-navy-950 block">
                      {cuttingAdvance.user?.name || cuttingAdvance.workerId}
                    </strong>
                    <span className="text-[11px] font-mono text-slate-500">
                      ID: {cuttingAdvance.workerId} • {cuttingAdvance.user?.unit || 'Unit 1'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Advance</span>
                    <span className="text-sm font-mono font-bold text-navy-950">
                      ₹{cuttingAdvance.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-200 text-xs">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <span className="text-slate-500 text-[11px] block">Already Cut (कपात झालेली):</span>
                    <strong className="text-slate-700 font-mono font-bold">
                      ₹{deductedSoFar.toLocaleString('en-IN')}
                    </strong>
                  </div>
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg">
                    <span className="text-rose-700 text-[11px] font-bold block">Remaining Balance (शिल्लक):</span>
                    <strong className="text-rose-900 font-mono font-black text-sm">
                      ₹{currentBalance.toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Cut Amount Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Cutting Amount • कपात रक्कम (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="1"
                    max={currentBalance}
                    step="any"
                    value={cutAmount}
                    onChange={(e) => setCutAmount(e.target.value)}
                    placeholder={`उदा. 2000 (जास्तीत जास्त ₹${currentBalance})`}
                    required
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-base font-black text-navy-950 focus:outline-none focus:ring-2 focus:ring-teal-600/40 font-mono"
                  />
                </div>
                {/* Quick Cutting Chips */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setCutAmount(String(currentBalance))}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition-colors"
                  >
                    पूर्ण शिल्लक (₹{currentBalance})
                  </button>
                  {[500, 1000, 2000, 3000, 5000].filter((q) => q < currentBalance).map((quick) => (
                    <button
                      type="button"
                      key={quick}
                      onClick={() => setCutAmount(String(quick))}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 border border-slate-200 transition-colors"
                    >
                      ₹{quick.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cut Date & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    Cut Date • कपात तारीख *
                  </label>
                  <input
                    type="date"
                    value={cutDate}
                    onChange={(e) => setCutDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/40 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    Notes / Reason • कपातीची नोंद
                  </label>
                  <input
                    type="text"
                    value={cutNotes}
                    onChange={(e) => setCutNotes(e.target.value)}
                    placeholder="उदा. हप्ता १ / आठवडा पगार कपात"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/40"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCutModalOpen(false)}
                  disabled={submittingCut}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs"
                >
                  रद्द करा (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={submittingCut}
                  className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>{submittingCut ? 'कपात नोंदवत आहे...' : 'कपात लागू करा (Apply Cutting)'}</span>
                </button>
              </div>
            </form>
          );
        })()}
      </Modal>

      {/* MODAL 4: CUTTING HISTORY (कपात इतिहास) */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title="Cutting History • उचल कपात इतिहास"
        maxWidth="md"
      >
        {historyAdvance && (
          <div className="space-y-4">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <strong className="text-sm font-bold text-navy-950 block">
                  {historyAdvance.user?.name || historyAdvance.workerId}
                </strong>
                <span className="text-slate-500 font-mono">
                  {historyAdvance.workerId} • मूळ उचल: ₹{historyAdvance.amount.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">शिल्लक रक्कम</span>
                <span className="text-sm font-mono font-black text-rose-900">
                  ₹{(historyAdvance.balanceAmount ?? (historyAdvance.status === 'DEDUCTED' ? 0 : historyAdvance.amount)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {(!historyAdvance.deductions || historyAdvance.deductions.length === 0) ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                या उचलीतून अद्याप कोणतीही कपात झालेली नाही.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {historyAdvance.deductions.map((d) => (
                  <div key={d.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-rose-800 text-sm">
                          - ₹{d.amount.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(d.cutDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="text-slate-600 text-[11px] mt-0.5">
                        {d.notes || 'उचल कपात'}
                      </div>
                      {d.cutBy && (
                        <div className="text-[10px] text-slate-400">
                          नोंद: {d.cutBy}
                        </div>
                      )}
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => handleRevertDeduction(d.id)}
                        disabled={revertingDeductionId === d.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors text-[11px] flex items-center gap-1 font-semibold"
                        title="Revert this deduction (कपात रद्द करा)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">रद्द करा</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 text-right">
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                बंद करा (Close)
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
