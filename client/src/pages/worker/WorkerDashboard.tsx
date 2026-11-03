import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Clock,
  CheckCircle2,
  LogOut,
  CalendarCheck,
  Building2,
  Calendar,
  AlertCircle,
  Timer,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Cpu,
  Layers,
  Edit3,
} from 'lucide-react';
import { Logo } from '../../components/common/Logo.tsx';
import { LiveClock } from '../../components/common/LiveClock.tsx';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { WorkerBottomNav } from '../../components/layout/WorkerBottomNav.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { attendanceApi } from '../../services/api.ts';
import { WorkerTodayStatus } from '../../types/index.ts';

export const WorkerDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const [currentTab, setCurrentTab] = useState<'home' | 'history' | 'profile'>('home');
  const [statusData, setStatusData] = useState<WorkerTodayStatus | null>(null);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTimerSeconds, setActiveTimerSeconds] = useState<number>(0);

  // Custom wage & machine logging state
  const [customWageModalOpen, setCustomWageModalOpen] = useState(false);
  const [checkOutPromptOpen, setCheckOutPromptOpen] = useState(false);
  const [hasOvertime, setHasOvertime] = useState(false);
  const [machinesOperated, setMachinesOperated] = useState<string>('');
  const [hoursOperated, setHoursOperated] = useState<string>('');
  const [customWorkRemarks, setCustomWorkRemarks] = useState<string>('');
  const [savingCustomWork, setSavingCustomWork] = useState(false);

  // Day Shift vs Night Shift selection (asked directly to worker)
  const currentHour = new Date().getHours();
  const [selectedShift, setSelectedShift] = useState<'DAY' | 'NIGHT'>(
    (currentHour >= 18 || currentHour < 6) ? 'NIGHT' : 'DAY'
  );

  // Check if worker has custom wage access granted by admin
  const hasCustomWageAccess = Boolean(
    statusData?.worker?.hasCustomWageAccess ??
    (user?.hasCustomWageAccess || user?.wageType === 'CUSTOM' || statusData?.worker?.wageType === 'CUSTOM')
  );

  // Load worker today status and attendance history
  const loadData = async (forceSpinner: boolean | any = false) => {
    try {
      if (forceSpinner === true || !statusData) {
        setLoading(true);
      }
      const [statusRes, historyRes] = await Promise.all([
        attendanceApi.getMyStatus(),
        attendanceApi.getMyHistory(),
      ]);

      if (statusRes.success) {
        setStatusData(statusRes.data);
        if (statusRes.data.today.machinesOperated != null) {
          setMachinesOperated(String(statusRes.data.today.machinesOperated));
        }
        if (statusRes.data.today.hoursOperated != null) {
          setHoursOperated(String(statusRes.data.today.hoursOperated));
        }
      }
      if (historyRes.success) {
        setHistoryRecords(historyRes.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to refresh attendance data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Live timer for active working duration
  useEffect(() => {
    if (!statusData?.today.isCheckedIn || statusData.today.isCheckedOut) {
      setActiveTimerSeconds(0);
      return;
    }

    const checkInTime = new Date(statusData.today.checkInAt!).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const elapsedSec = Math.max(0, Math.floor((now - checkInTime) / 1000));
      setActiveTimerSeconds(elapsedSec);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [statusData?.today.isCheckedIn, statusData?.today.isCheckedOut, statusData?.today.checkInAt]);

  const formatSecondsToHms = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Check In handler
  const handleCheckIn = async () => {
    try {
      setActionLoading(true);
      const res = await attendanceApi.checkIn({ shiftType: selectedShift });
      if (res.success) {
        // Confetti celebration
        try {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.7 },
          });
        } catch {}

        showToast(res.message, 'success');
        await loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Check-in failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Check Out initiator
  const handleInitiateCheckOut = () => {
    // Pre-fill hours operated with live duration if not filled
    if (!hoursOperated && activeTimerSeconds > 0) {
      const liveHrs = (activeTimerSeconds / 3600).toFixed(1);
      setHoursOperated(liveHrs);
    }
    if (hasCustomWageAccess || machinesOperated) {
      setHasOvertime(true);
    }
    setCheckOutPromptOpen(true);
  };

  // Direct Check Out handler (fallback)
  const handleDirectCheckOut = async () => {
    try {
      setActionLoading(true);
      const res = await attendanceApi.checkOut();
      if (res.success) {
        showToast(res.message, 'success');
        await loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Check-out failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Check Out with Overtime / Custom Wage Machines & Hours
  const handleConfirmCheckOutWithCustomDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const isLoggingWork = hasOvertime || hasCustomWageAccess;
      const res = await attendanceApi.checkOut({
        machinesOperated: isLoggingWork && machinesOperated ? parseInt(machinesOperated, 10) : undefined,
        hoursOperated: isLoggingWork && hoursOperated ? parseFloat(hoursOperated) : undefined,
      });
      if (res.success) {
        showToast(res.message, 'success');
        setCheckOutPromptOpen(false);
        await loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Check-out failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Save or Update Custom Work without checking out
  const handleSaveCustomWork = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingCustomWork(true);
      const res = await attendanceApi.logCustomWageWork({
        machinesOperated: machinesOperated ? parseInt(machinesOperated, 10) : undefined,
        hoursOperated: hoursOperated ? parseFloat(hoursOperated) : undefined,
        remarks: customWorkRemarks.trim() || undefined,
      });
      if (res.success) {
        showToast(res.message || 'Custom work details updated successfully', 'success');
        setCustomWageModalOpen(false);
        await loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update work details', 'error');
    } finally {
      setSavingCustomWork(false);
    }
  };

  const isCheckedIn = statusData?.today.isCheckedIn || false;
  const isCheckedOut = statusData?.today.isCheckedOut || false;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col pb-20 sm:pb-8 relative overflow-hidden">
      {/* Shree Swami Samarth Background - fitted in frame */}
      <div
        className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center p-4 select-none"
        aria-hidden="true"
      >
        <img
          src="/swami-samarth-bg.jpg"
          alt="Shree Swami Samarth"
          className="max-h-[85vh] max-w-[90vw] object-contain object-center opacity-[0.16] filter contrast-105"
        />
      </div>

      {/* Top Header */}
      <header className="bg-navy-950 text-white shadow-md sticky top-0 z-20">
        <div className="max-w-md sm:max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo size="sm" light={true} showSubtitle={false} />
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs font-semibold text-rose-300 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 px-3 py-1.5 rounded-xl transition-all tap-active"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-md sm:max-w-xl w-full mx-auto px-4 pt-4 pb-6 space-y-4">
        {/* Worker Greeting Banner */}
        <div className="bg-gradient-to-r from-navy-900 to-navy-800 text-white rounded-2xl p-5 shadow-lg border border-navy-700/50 relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-teal-500/10 transform rotate-12 translate-x-8 pointer-events-none" />

          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-teal-400">
              Textile Factory Floor
            </span>
            <button
              onClick={loadData}
              disabled={loading}
              className="text-slate-300 hover:text-white p-1 rounded-lg transition-colors"
              title="Refresh status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            Namaste, {user?.name}!
          </h1>

          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-300">
            <span className="font-mono bg-navy-950/80 px-2 py-0.5 rounded-md border border-navy-700">
              ID: {user?.workerId}
            </span>
            <span>•</span>
            <span>Dept: {user?.department?.name || 'Textile Floor'}</span>
            <span>•</span>
            <span>
              Shift:{' '}
              {statusData?.today.shiftType
                ? statusData.today.shiftType === 'NIGHT'
                  ? '🌙 Night Shift'
                  : '☀️ Day Shift'
                : selectedShift === 'NIGHT'
                ? '🌙 Night Shift'
                : '☀️ Day Shift'}
            </span>
          </div>

          {/* Live Clock Card */}
          <div className="mt-4 pt-3 border-t border-navy-700/60 flex items-center justify-between">
            <div className="text-xs text-slate-300 font-medium">Factory Local Time:</div>
            <LiveClock showDate={false} />
          </div>
        </div>

        {/* TAB 1: HOME (ATTENDANCE ACTIONS) */}
        {currentTab === 'home' && (
          <div className="space-y-4">
            {/* Today's Status Card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-700">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-navy-950">Today's Attendance</h2>
                    <p className="text-xs text-slate-500">{statusData?.today.formattedDate || 'Loading...'}</p>
                  </div>
                </div>

                {statusData && (
                  <StatusBadge
                    status={
                      isCheckedOut
                        ? statusData.today.status
                        : isCheckedIn
                        ? 'PRESENT'
                        : 'NOT_MARKED'
                    }
                  />
                )}
              </div>

              {/* Timings Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">
                    Check In Time
                  </span>
                  <div className="text-base sm:text-lg font-black text-navy-950 mt-1 font-mono">
                    {statusData?.today.formattedCheckInTime || '--:--'}
                  </div>
                  {statusData?.today.lateMinutes ? (
                    <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">
                      Late by {statusData.today.lateMinutes} mins
                    </span>
                  ) : null}
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">
                    Check Out Time
                  </span>
                  <div className="text-base sm:text-lg font-black text-navy-950 mt-1 font-mono">
                    {statusData?.today.formattedCheckOutTime || '--:--'}
                  </div>
                  {isCheckedOut && (
                    <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
                      Shift Completed
                    </span>
                  )}
                </div>
              </div>

              {/* Active Working Timer (When Checked In but not Checked Out) */}
              {isCheckedIn && !isCheckedOut && (
                <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 p-4 rounded-xl mb-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-teal-800 uppercase tracking-wide">
                    <Timer className="w-4 h-4 animate-spin" />
                    <span>Currently Working • Live Duration</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-teal-950 mt-1 font-mono tracking-tight">
                    {formatSecondsToHms(activeTimerSeconds)}
                  </div>
                  <div className="text-[11px] text-teal-700 mt-1">
                    Please remember to tap Check Out when your shift concludes.
                  </div>
                </div>
              )}

              {/* Completed Working Hours */}
              {isCheckedOut && (
                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl mb-4 flex items-center justify-between">
                  <div className="text-xs font-bold text-emerald-900">
                    Total Logged Working Hours:
                  </div>
                  <div className="text-base font-black text-emerald-950 font-mono">
                    {statusData?.today.workingHours} hrs
                  </div>
                </div>
              )}

              {/* BIG TOUCH TARGET ACTION BUTTONS */}
              <div className="space-y-3 pt-2">
                {/* Asking Day Shift or Night Shift directly on worker portal */}
                {!isCheckedIn && (
                  <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span>🏭 Which shift are you working today?</span>
                      </label>
                      <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200/60">
                        Tap to Choose
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setSelectedShift('DAY')}
                        className={`py-3 px-3.5 rounded-xl text-xs sm:text-sm font-extrabold border flex items-center justify-center gap-2 transition-all tap-active ${
                          selectedShift === 'DAY'
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20 scale-[1.02]'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-lg">☀️</span>
                        <span>Day Shift</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedShift('NIGHT')}
                        className={`py-3 px-3.5 rounded-xl text-xs sm:text-sm font-extrabold border flex items-center justify-center gap-2 transition-all tap-active ${
                          selectedShift === 'NIGHT'
                            ? 'bg-gradient-to-r from-indigo-700 to-navy-950 text-white border-navy-950 shadow-md shadow-navy-900/30 scale-[1.02]'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-lg">🌙</span>
                        <span>Night Shift</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-500 text-center font-medium">
                      Selected Shift:{' '}
                      <strong className="text-navy-950">
                        {selectedShift === 'DAY' ? '☀️ Day Shift' : '🌙 Night Shift'}
                      </strong>
                    </p>
                  </div>
                )}

                {isCheckedIn && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Today's Shift:</span>
                    <span className="font-bold text-navy-950">
                      {statusData?.today.shiftType === 'NIGHT' ? '🌙 Night Shift' : '☀️ Day Shift'}
                    </span>
                  </div>
                )}

                {!isCheckedIn ? (
                  <button
                    onClick={handleCheckIn}
                    disabled={actionLoading}
                    className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-lg sm:text-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-3 transition-all tap-active disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Clock className="w-6 h-6" />
                        <span>TAP TO CHECK IN ({selectedShift === 'DAY' ? 'DAY ☀️' : 'NIGHT 🌙'})</span>
                      </>
                    )}
                  </button>
                ) : !isCheckedOut ? (
                  <button
                    onClick={handleInitiateCheckOut}
                    disabled={actionLoading}
                    className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-extrabold text-lg sm:text-xl shadow-lg shadow-amber-600/30 flex items-center justify-center gap-3 transition-all tap-active disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <LogOut className="w-6 h-6" />
                        <span>TAP TO CHECK OUT</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="w-full py-3.5 px-4 rounded-xl bg-slate-100 text-slate-500 font-bold text-center text-sm border border-slate-200 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Today's Attendance Fully Recorded</span>
                  </div>
                )}
              </div>
            </div>

            {/* Custom Wage Worker Section: Machine & Operating Hours */}
            {hasCustomWageAccess && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-amber-200/80 bg-gradient-to-br from-white to-amber-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-navy-950 flex items-center gap-1.5">
                        <span>Custom Wage Work Log</span>
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold uppercase">
                          Access Granted
                        </span>
                      </h2>
                      <p className="text-xs text-slate-500">How many machines &amp; hours you operated</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setCustomWageModalOpen(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all tap-active shadow-sm"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{statusData?.today.machinesOperated != null ? 'Update' : 'Log Work'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl">
                    <span className="text-[11px] font-bold text-amber-800 block uppercase tracking-wider">
                      Machines Operated
                    </span>
                    <div className="text-xl sm:text-2xl font-black text-amber-950 mt-1 font-mono">
                      {statusData?.today.machinesOperated != null ? (
                        <span>
                          {statusData.today.machinesOperated}{' '}
                          <span className="text-xs font-normal text-amber-700">Machines</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm italic font-sans">Not logged</span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl">
                    <span className="text-[11px] font-bold text-amber-800 block uppercase tracking-wider">
                      Hours Operated
                    </span>
                    <div className="text-xl sm:text-2xl font-black text-amber-950 mt-1 font-mono">
                      {statusData?.today.hoursOperated != null ? (
                        <span>
                          {statusData.today.hoursOperated}{' '}
                          <span className="text-xs font-normal text-amber-700">Hours</span>
                        </span>
                      ) : isCheckedIn && !isCheckedOut ? (
                        <span>
                          {(activeTimerSeconds / 3600).toFixed(1)}{' '}
                          <span className="text-xs font-normal text-teal-700">Live hrs</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm italic font-sans">Not logged</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-amber-100/60 rounded-xl p-2.5 text-[11px] text-amber-900 leading-snug flex items-center gap-2">
                  <span className="text-base">💡</span>
                  <span>
                    Your daily wage is determined by machines operated and total hours. You can update this log anytime or during check-out.
                  </span>
                </div>
              </div>
            )}

            {/* Weekly Summary Card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
              <h3 className="text-sm font-bold text-navy-950 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-600" />
                <span>This Week's Summary</span>
              </h3>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Days Present
                  </span>
                  <div className="text-lg font-black text-navy-950 mt-1">
                    {statusData?.weeklySummary.daysPresent || 0} / 7
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Late Days
                  </span>
                  <div className="text-lg font-black text-amber-600 mt-1">
                    {statusData?.weeklySummary.daysLate || 0}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Total Hours
                  </span>
                  <div className="text-lg font-black text-teal-700 mt-1 font-mono">
                    {statusData?.weeklySummary.totalHours || 0}h
                  </div>
                </div>
              </div>
            </div>

            {/* Shift Rules Quick Info */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-slate-600 space-y-1.5">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <span>Factory Attendance Guidelines:</span>
              </div>
              <p>• Grace period is 15 minutes from scheduled shift start time.</p>
              <p>• Standard 60-minute break is automatically accounted for shifts over 5 hours.</p>
              <p>• Only factory server timestamps are recorded for anti-tamper security.</p>
            </div>
          </div>
        )}

        {/* TAB 2: MY ATTENDANCE HISTORY */}
        {currentTab === 'history' && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-navy-950">My Attendance History</h2>
                <p className="text-xs text-slate-500">Your recent factory check-in & check-out logs</p>
              </div>
              <button
                onClick={loadData}
                className="p-1.5 rounded-lg text-slate-500 hover:text-navy-950 border border-slate-200"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {historyRecords.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No past attendance records found.
              </div>
            ) : (
              <div className="space-y-2.5">
                {historyRecords.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 bg-slate-50 hover:bg-slate-100/70 rounded-xl border border-slate-200/80 flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-navy-950">{r.formattedDate}</span>
                        <span className="text-[11px] text-slate-500 font-medium">({r.dayOfWeek})</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          r.shiftType === 'NIGHT'
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {r.shiftType === 'NIGHT' ? '🌙 Night' : '☀️ Day'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-600 mt-1 font-mono">
                        <span>In: {r.checkInTime}</span>
                        <span>•</span>
                        <span>Out: {r.checkOutTime}</span>
                        {r.workingHours > 0 && (
                          <>
                            <span>•</span>
                            <span className="font-bold text-teal-700">{r.workingHours}h</span>
                          </>
                        )}
                      </div>
                      {(r.machinesOperated != null || r.hoursOperated != null) && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 bg-amber-50 text-amber-900 border border-amber-200/70 text-[11px] font-semibold px-2 py-0.5 rounded-md">
                          <Cpu className="w-3 h-3 text-amber-600" />
                          <span>{r.machinesOperated ?? '--'} Machines</span>
                          <span>•</span>
                          <span>{r.hoursOperated ?? '--'} hrs operated</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={r.status} size="sm" />
                      {r.lateMinutes > 0 && (
                        <span className="text-[10px] text-amber-600 font-semibold">
                          Late {r.lateMinutes}m
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PROFILE */}
        {currentTab === 'profile' && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-base font-bold text-navy-950">My Worker Profile</h2>

            <div className="space-y-3 text-sm">
              <div className="p-3 bg-slate-50 rounded-xl flex justify-between items-center">
                <span className="text-slate-500 font-medium">Full Name</span>
                <span className="font-bold text-navy-950">{user?.name}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl flex justify-between items-center">
                <span className="text-slate-500 font-medium">Worker ID</span>
                <span className="font-mono font-bold text-navy-950">{user?.workerId}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl flex justify-between items-center">
                <span className="text-slate-500 font-medium">Wage Model</span>
                <span className="font-bold text-navy-950">
                  {hasCustomWageAccess ? (
                    <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-xs font-semibold">
                      Custom (Machines &amp; Hours Operated)
                    </span>
                  ) : (
                    <span>Fixed Daily Wage {user?.dailyWage ? `(₹${user.dailyWage}/day)` : ''}</span>
                  )}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl flex justify-between items-center">
                <span className="text-slate-500 font-medium">Custom Wage Access</span>
                <span className="font-bold">
                  {hasCustomWageAccess ? (
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-xs">
                      Granted by Admin
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">Disabled</span>
                  )}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl flex justify-between items-center">
                <span className="text-slate-500 font-medium">Department</span>
                <span className="font-bold text-navy-950">{user?.department?.name || 'Textile Department'}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl flex justify-between items-center">
                <span className="text-slate-500 font-medium">Assigned Shift</span>
                <span className="font-bold text-navy-950">
                  {statusData?.shift?.name || 'General Shift (8:30 AM - 5:30 PM)'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl flex justify-between items-center">
                <span className="text-slate-500 font-medium">Role</span>
                <span className="font-bold text-teal-700 uppercase text-xs">{user?.role}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl flex justify-between items-center">
                <span className="text-slate-500 font-medium">Company</span>
                <span className="font-bold text-navy-950">Shree Swami Samarth Fabric</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <button
                onClick={logout}
                className="w-full py-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-sm flex items-center justify-center gap-2 transition-colors tap-active"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out of System</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* UPDATE CUSTOM WORK MODAL */}
      <Modal
        isOpen={customWageModalOpen}
        onClose={() => setCustomWageModalOpen(false)}
        title="Custom Wage Work Details"
        subtitle="Log how many machines and hours you operated today"
        maxWidth="md"
      >
        <form onSubmit={handleSaveCustomWork} className="space-y-4">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
            <Cpu className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              Admin has given you access for custom wage entry. Enter the exact count of machines and hours worked.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              How Many Machines Operated? *
            </label>
            <input
              type="number"
              min="0"
              required
              placeholder="e.g. 4 (Number of looms / machines)"
              value={machinesOperated}
              onChange={(e) => setMachinesOperated(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-amber-500"
            />
            <span className="text-[10px] text-slate-400">Total number of textile machines operated by you.</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              How Many Hours Operated? *
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              required
              placeholder="e.g. 8.5"
              value={hoursOperated}
              onChange={(e) => setHoursOperated(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-amber-500"
            />
            <span className="text-[10px] text-slate-400">Operating time spent on the machines.</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Remarks / Loom Numbers (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Looms #1, #2, #5, #6"
              value={customWorkRemarks}
              onChange={(e) => setCustomWorkRemarks(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCustomWageModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingCustomWork}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
            >
              {savingCustomWork ? 'Saving...' : 'Save Work Details'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CHECK OUT CONFIRMATION MODAL WITH OVERTIME & MACHINE LOG */}
      <Modal
        isOpen={checkOutPromptOpen}
        onClose={() => setCheckOutPromptOpen(false)}
        title="Shift Check-Out & Summary"
        subtitle="Confirm shift completion and record overtime or operated machines"
        maxWidth="md"
      >
        <form onSubmit={handleConfirmCheckOutWithCustomDetails} className="space-y-4">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 font-medium">Shift Start:</span>{' '}
              <strong className="text-navy-950 font-mono">{statusData?.today.formattedCheckInTime || '--'}</strong>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Shift Type:</span>{' '}
              <span className="font-bold text-teal-700">{statusData?.today.shiftType === 'NIGHT' ? '🌙 Night Shift' : '☀️ Day Shift'}</span>
            </div>
          </div>

          {/* OVERTIME / MACHINE SECTION */}
          <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasOvertime || hasCustomWageAccess}
                  onChange={(e) => setHasOvertime(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                <span className="text-xs font-bold text-amber-950">
                  Overtime / Machine Operations Section
                </span>
              </label>
              {(hasOvertime || hasCustomWageAccess) && (
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                  Overtime / Machines Active
                </span>
              )}
            </div>

            {(hasOvertime || hasCustomWageAccess) ? (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    How Many Machines Operated? *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 2 (Number of machines)"
                    value={machinesOperated}
                    onChange={(e) => setMachinesOperated(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[10px] text-slate-500">Number of machines operated during shift or overtime</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    How Many Hours Operated? *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    placeholder="e.g. 8.5 (Hours operated)"
                    value={hoursOperated}
                    onChange={(e) => setHoursOperated(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[10px] text-slate-400">Pre-calculated from your shift timer. Adjust if needed.</span>
                </div>

                {statusData?.worker?.customWageRate && machinesOperated && hoursOperated && (
                  <div className="p-2.5 bg-slate-900 text-white rounded-lg flex items-center justify-between text-xs">
                    <span className="text-slate-300">Projected Wage (@ ₹{statusData.worker.customWageRate}/mc/hr):</span>
                    <strong className="text-amber-400 font-mono text-sm">
                      ₹{Math.round(parseInt(machinesOperated, 10) * parseFloat(hoursOperated) * statusData.worker.customWageRate).toLocaleString('en-IN')}
                    </strong>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Check the box above if you worked overtime or operated machines to report machine counts and hours.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCheckOutPromptOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-navy-900 hover:from-teal-700 hover:to-navy-950 text-white rounded-xl text-xs font-bold shadow-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span>{actionLoading ? 'Recording Check-Out...' : 'Confirm & Check Out'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Worker Mobile Bottom Navigation */}
      <WorkerBottomNav currentTab={currentTab} onSelectTab={(tab: any) => setCurrentTab(tab)} />
    </div>
  );
};
