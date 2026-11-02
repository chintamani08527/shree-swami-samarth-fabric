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
} from 'lucide-react';
import { Logo } from '../../components/common/Logo.tsx';
import { LiveClock } from '../../components/common/LiveClock.tsx';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
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

  // Load worker today status and attendance history
  const loadData = async () => {
    try {
      setLoading(true);
      const [statusRes, historyRes] = await Promise.all([
        attendanceApi.getMyStatus(),
        attendanceApi.getMyHistory(),
      ]);

      if (statusRes.success) {
        setStatusData(statusRes.data);
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
      const res = await attendanceApi.checkIn();
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

  // Check Out handler
  const handleCheckOut = async () => {
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
            <span>Shift: {statusData?.shift?.name?.split('(')[0]?.trim() || 'General Shift'}</span>
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
                {!isCheckedIn && statusData?.checkInWindow && (
                  <div
                    className={`p-3.5 rounded-xl border mb-1 transition-colors ${
                      statusData.checkInWindow.isOpen
                        ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                        : statusData.checkInWindow.isTooEarly
                        ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                        : 'bg-rose-50/90 border-rose-300 text-rose-950'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Shift Check-In Window (±{statusData.checkInWindow.bandMinutes}m band)</span>
                      </span>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          statusData.checkInWindow.isOpen
                            ? 'bg-emerald-600 text-white'
                            : statusData.checkInWindow.isTooEarly
                            ? 'bg-amber-600 text-white'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {statusData.checkInWindow.isOpen
                          ? 'Window Open'
                          : statusData.checkInWindow.isTooEarly
                          ? 'Not Open Yet'
                          : 'Window Closed'}
                      </span>
                    </div>

                    <div className="text-sm font-black font-mono">
                      Allowed Check-in: {statusData.checkInWindow.windowStart} — {statusData.checkInWindow.windowEnd}
                    </div>

                    <p className="text-[11px] mt-1">
                      {statusData.checkInWindow.isOpen ? (
                        <span className="text-emerald-800 font-semibold">
                          ✅ You are within your shift start band time. Tap below to mark attendance.
                        </span>
                      ) : statusData.checkInWindow.isTooEarly ? (
                        <span className="text-amber-800 font-semibold">
                          ⏳ Shift starts at {statusData.shift?.startTime}. Check-in opens 30 minutes before ({statusData.checkInWindow.windowStart}).
                        </span>
                      ) : (
                        <span className="text-rose-800 font-semibold">
                          ⚠️ Check-in closed at {statusData.checkInWindow.windowEnd}. Contact Owner Vinayak Ginde or Supervisor.
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {!isCheckedIn ? (
                  <button
                    onClick={handleCheckIn}
                    disabled={actionLoading || (statusData?.checkInWindow ? !statusData.checkInWindow.isOpen : false)}
                    className={`w-full py-4 px-6 rounded-2xl text-white font-extrabold text-lg sm:text-xl shadow-lg flex items-center justify-center gap-3 transition-all tap-active disabled:opacity-50 ${
                      statusData?.checkInWindow && !statusData.checkInWindow.isOpen
                        ? statusData.checkInWindow.isTooEarly
                          ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                          : 'bg-rose-700 hover:bg-rose-800 shadow-rose-700/30'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/30'
                    }`}
                  >
                    {actionLoading ? (
                      <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                    ) : statusData?.checkInWindow && !statusData.checkInWindow.isOpen ? (
                      statusData.checkInWindow.isTooEarly ? (
                        <>
                          <Clock className="w-6 h-6" />
                          <span>OPENS AT {statusData.checkInWindow.windowStart}</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-6 h-6" />
                          <span>WINDOW CLOSED</span>
                        </>
                      )
                    ) : (
                      <>
                        <Clock className="w-6 h-6" />
                        <span>TAP TO CHECK IN</span>
                      </>
                    )}
                  </button>
                ) : !isCheckedOut ? (
                  <button
                    onClick={handleCheckOut}
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

      {/* Worker Mobile Bottom Navigation */}
      <WorkerBottomNav currentTab={currentTab} onSelectTab={(tab: any) => setCurrentTab(tab)} />
    </div>
  );
};
