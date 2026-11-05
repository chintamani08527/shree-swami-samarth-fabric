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
  User as UserIcon,
  Sparkles,
  Zap,
  XCircle,
} from 'lucide-react';
import { Logo } from '../../components/common/Logo.tsx';
import { LiveClock } from '../../components/common/LiveClock.tsx';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { WorkerBottomNav } from '../../components/layout/WorkerBottomNav.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { attendanceApi } from '../../services/api.ts';
import { WorkerTodayStatus, ShiftEarnings } from '../../types/index.ts';
import { FactoryLocationMap } from '../../components/common/FactoryLocationMap.tsx';
import { getCurrentGPSPosition, GPSPosition } from '../../utils/geo.ts';

export const WorkerDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const [currentTab, setCurrentTab] = useState<'home' | 'overtime' | 'history' | 'profile'>('home');
  const [statusData, setStatusData] = useState<WorkerTodayStatus | null>(null);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTimerSeconds, setActiveTimerSeconds] = useState<number>(0);

  // Location & Geofencing state
  const [currentGPS, setCurrentGPS] = useState<GPSPosition | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'granted' | 'denied' | 'outside'>('idle');
  const [distanceToUnit1, setDistanceToUnit1] = useState<number | null>(null);
  const [distanceToUnit2, setDistanceToUnit2] = useState<number | null>(null);
  const [isWithinPremises, setIsWithinPremises] = useState<boolean>(false);
  const [detectedUnit, setDetectedUnit] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Check-Out Celebration & Rupees Animation state
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [celebrationEarnings, setCelebrationEarnings] = useState<ShiftEarnings | null>(null);
  const [animatedRupees, setAnimatedRupees] = useState<number>(0);

  // Custom wage & machine logging state
  const [customWageModalOpen, setCustomWageModalOpen] = useState(false);
  const [checkOutPromptOpen, setCheckOutPromptOpen] = useState(false);
  const [hasOvertime, setHasOvertime] = useState(false);
  const [machinesOperated, setMachinesOperated] = useState<string>('');
  const [hoursOperated, setHoursOperated] = useState<string>('');
  const [customWorkRemarks, setCustomWorkRemarks] = useState<string>('');
  const [savingCustomWork, setSavingCustomWork] = useState(false);

  // Overtime Portal dedicated state
  const [overtimeMachines, setOvertimeMachines] = useState<string>('');
  const [overtimeHours, setOvertimeHours] = useState<string>('');
  const [overtimeRemarks, setOvertimeRemarks] = useState<string>('');
  const [savingOvertime, setSavingOvertime] = useState(false);
  const [overtimeSavedMessage, setOvertimeSavedMessage] = useState<string>('');

  // Day Shift vs Night Shift selection (asked directly to worker: 8 AM-8 PM vs 8 PM-8 AM)
  const currentHour = new Date().getHours();
  const [selectedShift, setSelectedShift] = useState<'DAY' | 'NIGHT'>(
    (currentHour >= 19 || currentHour < 7) ? 'NIGHT' : 'DAY'
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
        if (statusRes.data.today.overtimeMachines != null) {
          setOvertimeMachines(String(statusRes.data.today.overtimeMachines));
        }
        if (statusRes.data.today.overtimeHours != null) {
          setOvertimeHours(String(statusRes.data.today.overtimeHours));
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

  // Refresh GPS Location and verify with factory geofences
  const refreshGPSLocation = async (silent: boolean = false): Promise<GPSPosition | null> => {
    try {
      setLocationStatus('locating');
      setLocationError(null);
      const pos = await getCurrentGPSPosition(10000);
      setCurrentGPS(pos);

      const verifyRes = await attendanceApi.verifyLocation(pos.latitude, pos.longitude);
      if (verifyRes.success) {
        const d = verifyRes.data;
        setDistanceToUnit1(d.distanceToUnit1);
        setDistanceToUnit2(d.distanceToUnit2);
        setIsWithinPremises(d.isWithinPremises);
        setDetectedUnit(d.detectedUnit);
        setLocationStatus(d.isWithinPremises ? 'granted' : 'outside');
        if (!silent) {
          if (d.isWithinPremises) {
            showToast(`✅ ${d.detectedUnit} आवारात आहात (${d.nearestDistance}m अंतर)`, 'success');
          } else {
            showToast(`❌ फॅक्टरी आवाराबाहेर (${d.nearestDistance}m अंतर). कृपया आवारात या.`, 'error');
          }
        }
      }
      return pos;
    } catch (err: any) {
      setLocationStatus('denied');
      const msg = err.message || 'लोकेशन मिळवता आले नाही.';
      setLocationError(msg);
      if (!silent) {
        showToast(msg, 'error');
      }
      return null;
    }
  };

  useEffect(() => {
    loadData();
    refreshGPSLocation(true);
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

      // Verify and acquire GPS position
      let pos = currentGPS;
      if (!pos || locationStatus === 'denied' || locationStatus === 'idle') {
        pos = await refreshGPSLocation(false);
      }

      if (!pos) {
        showToast('📍 कृपया आपल्या फोनचे लोकेशन (GPS) चालू करा आणि पुन्हा प्रयत्न करा.', 'error');
        return;
      }

      if (statusData?.geofenceConfig?.enabled && !isWithinPremises) {
        showToast('❌ तुम्ही फॅक्टरी आवारात नाही आहात. कृपया फॅक्टरी आवारात येऊन हजेरी नोंदवा.', 'error');
        return;
      }

      const res = await attendanceApi.checkIn({
        shiftType: selectedShift,
        latitude: pos.latitude,
        longitude: pos.longitude,
      });

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

  // Web Audio API Celebratory Chime
  const playCelebrationChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Uplifting celebratory chime progression: C5 -> E5 -> G5 -> C6
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);

        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.12 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.65);
      });
    } catch {}
  };

  // Multi-Cannon Colorful Confetti Explosion
  const triggerMultiConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6'],
      });
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: ['#F59E0B', '#FBBF24', '#10B981', '#34D399'],
        });
      }, 200);
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: ['#F59E0B', '#FBBF24', '#10B981', '#34D399'],
        });
      }, 400);
    } catch {}
  };

  // Trigger celebration modal with animated counter, chime & confetti
  const triggerCelebration = (earnings: ShiftEarnings) => {
    setCelebrationEarnings(earnings);
    setShowCelebrationModal(true);
    playCelebrationChime();
    triggerMultiConfetti();
    if (navigator && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([100, 50, 100, 50, 200]);
      } catch {}
    }
  };

  // Animated Rupee Count-Up from 0 to totalEarned
  useEffect(() => {
    if (!showCelebrationModal || !celebrationEarnings) {
      setAnimatedRupees(0);
      return;
    }

    const target = celebrationEarnings.totalEarned || 0;
    if (target <= 0) {
      setAnimatedRupees(0);
      return;
    }

    const duration = 1200; // ms
    const startTime = performance.now();

    let animationFrameId: number;
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const currentVal = Math.round(easedProgress * target);
      setAnimatedRupees(currentVal);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [showCelebrationModal, celebrationEarnings]);

  // Direct Check Out handler (fallback)
  const handleDirectCheckOut = async () => {
    try {
      setActionLoading(true);

      let pos = currentGPS;
      if (!pos || locationStatus === 'denied' || locationStatus === 'idle') {
        pos = await refreshGPSLocation(false);
      }

      if (!pos) {
        showToast('📍 कृपया आपल्या फोनचे लोकेशन (GPS) चालू करा आणि पुन्हा प्रयत्न करा.', 'error');
        return;
      }

      if (statusData?.geofenceConfig?.enabled && !isWithinPremises) {
        showToast('❌ तुम्ही फॅक्टरी आवारात नाही आहात. कृपया फॅक्टरी आवारात येऊन चेक आऊट करा.', 'error');
        return;
      }

      const res = await attendanceApi.checkOut({
        latitude: pos.latitude,
        longitude: pos.longitude,
      });
      if (res.success) {
        showToast(res.message, 'success');
        const dailyRate = statusData?.worker?.dailyWage || user?.dailyWage || 1000;
        const earningsObj = res.earnings || {
          totalEarned: dailyRate,
          baseEarned: dailyRate,
          overtimeEarned: 0,
          wageType: hasCustomWageAccess ? 'CUSTOM' : 'FIXED',
          dailyWage: dailyRate,
          machinesOperated: 0,
          hoursOperated: 12,
          overtimeMachines: 0,
          overtimeHours: 0,
          shiftType: statusData?.today?.shiftType || selectedShift,
          status: 'PRESENT',
        };
        triggerCelebration(earningsObj);
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

      let pos = currentGPS;
      if (!pos || locationStatus === 'denied' || locationStatus === 'idle') {
        pos = await refreshGPSLocation(false);
      }

      if (!pos) {
        showToast('📍 कृपया आपल्या फोनचे लोकेशन (GPS) चालू करा आणि पुन्हा प्रयत्न करा.', 'error');
        return;
      }

      if (statusData?.geofenceConfig?.enabled && !isWithinPremises) {
        showToast('❌ तुम्ही फॅक्टरी आवारात नाही आहात. कृपया फॅक्टरी आवारात येऊन चेक आऊट करा.', 'error');
        return;
      }

      const isLoggingWork = hasCustomWageAccess || Boolean(machinesOperated);
      const isLoggingOT = hasOvertime || Boolean(overtimeMachines) || Boolean(overtimeHours);
      const res = await attendanceApi.checkOut({
        machinesOperated: isLoggingWork && machinesOperated ? parseInt(machinesOperated, 10) : undefined,
        hoursOperated: isLoggingWork && hoursOperated ? parseFloat(hoursOperated) : undefined,
        overtimeMachines: isLoggingOT && overtimeMachines ? parseInt(overtimeMachines, 10) : undefined,
        overtimeHours: isLoggingOT && overtimeHours ? parseFloat(overtimeHours) : undefined,
        latitude: pos.latitude,
        longitude: pos.longitude,
      });
      if (res.success) {
        showToast(res.message, 'success');
        setCheckOutPromptOpen(false);

        const dailyRate = statusData?.worker?.dailyWage || user?.dailyWage || 1000;
        const isCustom = hasCustomWageAccess || Boolean(statusData?.worker?.customWageRate);
        const rate = statusData?.worker?.customWageRate || 29.17;
        const m = machinesOperated ? parseInt(machinesOperated, 10) : 1;
        const h = hoursOperated ? parseFloat(hoursOperated) : 12;
        const otH = overtimeHours ? parseFloat(overtimeHours) : 0;
        const otM = overtimeMachines ? parseInt(overtimeMachines, 10) : 0;

        const customBase = Math.round(m * h * rate);
        const customOT = otM > 0 && otH > 0 ? Math.round(otM * otH * rate) : Math.round(otH * rate * m);
        const fixedOT = Math.round(otH * (dailyRate / 12));

        const fallbackEarnings: ShiftEarnings = {
          totalEarned: isCustom ? customBase + customOT : dailyRate + fixedOT,
          baseEarned: isCustom ? customBase : dailyRate,
          overtimeEarned: isCustom ? customOT : fixedOT,
          wageType: isCustom ? 'CUSTOM' : 'FIXED',
          customRate: rate,
          dailyWage: dailyRate,
          machinesOperated: isCustom ? m : 0,
          hoursOperated: h,
          overtimeMachines: otM,
          overtimeHours: otH,
          shiftType: statusData?.today?.shiftType || selectedShift,
          status: 'PRESENT',
        };

        triggerCelebration(res.earnings || fallbackEarnings);
        await loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Check-out failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Save or Update Overtime Work via Overtime Portal
  const handleSaveOvertimeWork = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingOvertime(true);
      const res = await attendanceApi.logOvertimeWork({
        overtimeMachines: overtimeMachines ? parseInt(overtimeMachines, 10) : undefined,
        overtimeHours: overtimeHours ? parseFloat(overtimeHours) : undefined,
        remarks: overtimeRemarks.trim() || undefined,
      });
      if (res.success) {
        showToast(res.message || 'Overtime details recorded successfully in Overtime Portal', 'success');
        setOvertimeSavedMessage('Overtime details saved successfully!');
        setTimeout(() => setOvertimeSavedMessage(''), 3500);
        await loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to record overtime details', 'error');
    } finally {
      setSavingOvertime(false);
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
            <span className="bg-teal-900/60 text-teal-300 border border-teal-700/60 px-2 py-0.5 rounded-md font-bold">
              🏭 {statusData?.worker?.unit || user?.unit || 'Unit 1'}
            </span>
            <span>•</span>
            <span>Dept: {user?.department?.name || 'Textile Floor'}</span>
            <span>•</span>
            <span>
              Shift:{' '}
              {statusData?.today.shiftType
                ? statusData.today.shiftType === 'NIGHT'
                  ? '🌙 Night Shift (8:00 PM - 8:00 AM)'
                  : '☀️ Day Shift (8:00 AM - 8:00 PM)'
                : selectedShift === 'NIGHT'
                ? '🌙 Night Shift (8:00 PM - 8:00 AM)'
                : '☀️ Day Shift (8:00 AM - 8:00 PM)'}
            </span>
          </div>

          {/* Live Clock Card */}
          <div className="mt-4 pt-3 border-t border-navy-700/60 flex items-center justify-between">
            <div className="text-xs text-slate-300 font-medium">Factory Local Time:</div>
            <LiveClock showDate={false} />
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="bg-white rounded-2xl p-1.5 shadow-sm border border-slate-200/90 grid grid-cols-4 gap-1 text-xs font-bold">
          <button
            onClick={() => setCurrentTab('home')}
            className={`py-2 px-1 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              currentTab === 'home'
                ? 'bg-navy-950 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Shift</span>
          </button>
          <button
            onClick={() => setCurrentTab('overtime')}
            className={`py-2 px-1 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              currentTab === 'overtime'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            <span>Overtime</span>
          </button>
          <button
            onClick={() => setCurrentTab('history')}
            className={`py-2 px-1 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              currentTab === 'history'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>History</span>
          </button>
          <button
            onClick={() => setCurrentTab('profile')}
            className={`py-2 px-1 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              currentTab === 'profile'
                ? 'bg-navy-950 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Profile</span>
          </button>
        </div>

        {/* TAB 1: HOME (ATTENDANCE ACTIONS) */}
        {currentTab === 'home' && (
          <div className="space-y-4">
            {/* Interactive Factory Geofence Map & Live Radar */}
            <FactoryLocationMap
              geofenceConfig={statusData?.geofenceConfig}
              currentPosition={currentGPS}
              locationStatus={locationStatus}
              distanceToUnit1={distanceToUnit1}
              distanceToUnit2={distanceToUnit2}
              detectedUnit={detectedUnit}
              isWithinPremises={isWithinPremises}
              errorMessage={locationError}
              onRefreshLocation={() => refreshGPSLocation(false)}
              onRequestPermission={() => refreshGPSLocation(false)}
            />

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
                        className={`py-3 px-3 rounded-xl text-xs sm:text-sm font-extrabold border flex items-center justify-center gap-2 transition-all tap-active ${
                          selectedShift === 'DAY'
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20 scale-[1.02]'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-xl">☀️</span>
                        <div className="text-left">
                          <div>Day Shift</div>
                          <div className="text-[10px] opacity-90 font-mono font-normal">8:00 AM - 8:00 PM</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedShift('NIGHT')}
                        className={`py-3 px-3 rounded-xl text-xs sm:text-sm font-extrabold border flex items-center justify-center gap-2 transition-all tap-active ${
                          selectedShift === 'NIGHT'
                            ? 'bg-gradient-to-r from-indigo-700 to-navy-950 text-white border-navy-950 shadow-md shadow-navy-900/30 scale-[1.02]'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-xl">🌙</span>
                        <div className="text-left">
                          <div>Night Shift</div>
                          <div className="text-[10px] opacity-90 font-mono font-normal">8:00 PM - 8:00 AM</div>
                        </div>
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-500 text-center font-medium">
                      Selected Shift:{' '}
                      <strong className="text-navy-950">
                        {selectedShift === 'DAY' ? '☀️ Day Shift (8:00 AM - 8:00 PM)' : '🌙 Night Shift (8:00 PM - 8:00 AM)'}
                      </strong>
                    </p>
                  </div>
                )}

                {isCheckedIn && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Active Shift:</span>
                    <span className="font-bold text-navy-950">
                      {statusData?.today.shiftType === 'NIGHT' ? '🌙 Night Shift (8:00 PM - 8:00 AM)' : '☀️ Day Shift (8:00 AM - 8:00 PM)'}
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
                  <div className="space-y-3">
                    <div className="w-full py-3 px-4 rounded-xl bg-slate-100 text-slate-600 font-bold text-center text-xs sm:text-sm border border-slate-200 flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                      <span>Shift Completed & Attendance Recorded</span>
                    </div>

                    {/* Persistent Today's Shift Earnings Card */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 via-emerald-500/10 to-teal-500/15 border-2 border-amber-300/80 shadow-md">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-amber-500/30 flex-shrink-0">
                            ₹
                          </div>
                          <div>
                            <div className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                              Today's Shift Earnings • आजची कमाई
                            </div>
                            <div className="text-2xl sm:text-3xl font-black text-navy-950 flex items-center gap-2">
                              <span>
                                ₹ {(statusData?.today?.earnings?.totalEarned ?? (statusData?.worker?.dailyWage || user?.dailyWage || 1000)).toLocaleString('en-IN')}
                              </span>
                              {statusData?.today?.overtimeStatus === 'APPROVED' ? (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-0.5">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  OT Added
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wide">
                                  Verified
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (statusData?.today?.earnings) {
                              triggerCelebration(statusData.today.earnings);
                            } else {
                              const hours = statusData?.today?.workingHours || 12;
                              const isCustom = statusData?.worker?.wageType === 'CUSTOM' || Boolean(statusData?.worker?.hasCustomWageAccess);
                              const rate = statusData?.worker?.customWageRate || 29.17;
                              const daily = statusData?.worker?.dailyWage || user?.dailyWage || 1000;
                              const m = statusData?.today?.machinesOperated || 1;
                              const base = isCustom ? Math.round(m * hours * rate) : daily;
                              triggerCelebration({
                                totalEarned: base,
                                baseEarned: base,
                                overtimeEarned: 0,
                                wageType: isCustom ? 'CUSTOM' : 'FIXED',
                                customRate: rate,
                                dailyWage: daily,
                                machinesOperated: isCustom ? m : 0,
                                hoursOperated: hours,
                                overtimeMachines: 0,
                                overtimeHours: 0,
                                shiftType: statusData?.today?.shiftType || 'DAY',
                                status: statusData?.today?.status || 'PRESENT',
                              });
                            }
                          }}
                          className="py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs shadow-md shadow-amber-500/25 transition-all flex items-center gap-1.5 tap-active flex-shrink-0"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Celebration 🎉</span>
                        </button>
                      </div>

                      {/* Overtime Approval Salary Addition Notice */}
                      {statusData?.today?.overtimeStatus === 'APPROVED' && (statusData?.today?.earnings?.overtimeEarned || 0) > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-amber-300/60 flex items-center justify-between text-xs flex-wrap gap-1 bg-white/70 p-2.5 rounded-xl">
                          <span className="text-slate-600 font-medium">
                            Regular Base: <strong>₹{(statusData.today.earnings?.baseEarned ?? statusData.worker?.dailyWage ?? 1000).toLocaleString('en-IN')}</strong>
                          </span>
                          <span className="text-emerald-800 font-bold bg-emerald-100 px-2.5 py-1 rounded-lg flex items-center gap-1 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Approved OT Added: + ₹{(statusData.today.earnings?.overtimeEarned || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      )}

                      {statusData?.today?.overtimeStatus === 'PENDING' && (statusData?.today?.earnings?.overtimePendingAmount || statusData?.today?.earnings?.overtimeEarned || 0) > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-amber-300/60 flex items-center justify-between text-xs flex-wrap gap-1 bg-white/70 p-2.5 rounded-xl">
                          <span className="text-slate-600 font-medium">
                            Current Base Wage: <strong>₹{(statusData.today.earnings?.baseEarned ?? statusData.worker?.dailyWage ?? 1000).toLocaleString('en-IN')}</strong>
                          </span>
                          <span className="text-amber-900 font-bold bg-amber-100/90 px-2.5 py-1 rounded-lg flex items-center gap-1 border border-amber-300 animate-pulse">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            OT ₹{(statusData.today.earnings?.overtimePendingAmount || statusData.today.earnings?.overtimeEarned || 0).toLocaleString('en-IN')} (Pending Admin Approval)
                          </span>
                        </div>
                      )}
                    </div>
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

            {/* Overtime Portal Quick Card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-orange-200/90 bg-gradient-to-br from-white to-orange-50/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-800 flex items-center justify-center">
                    <Timer className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-navy-950 flex items-center gap-1.5 flex-wrap">
                      <span>Overtime Portal</span>
                      {statusData?.today.overtimeStatus === 'APPROVED' ? (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold uppercase flex items-center gap-0.5">
                          ✓ Approved
                        </span>
                      ) : statusData?.today.overtimeStatus === 'REJECTED' ? (
                        <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-bold uppercase">
                          ✗ Rejected
                        </span>
                      ) : (statusData?.today.overtimeHours || Number(statusData?.today.overtimeMachines || 0) > 0) ? (
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">
                          ⏳ Approval Pending
                        </span>
                      ) : (
                        <span className="text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded font-bold uppercase">
                          OT Hub
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-500">Log extra machines &amp; overtime hours</p>
                  </div>
                </div>

                <button
                  onClick={() => setCurrentTab('overtime')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all tap-active shadow-sm"
                >
                  <span>Open Portal</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-orange-50/70 border border-orange-200/60 rounded-xl">
                  <span className="text-[11px] font-bold text-orange-800 block uppercase tracking-wider">
                    Overtime Machines
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-orange-950 mt-1 font-mono">
                    {statusData?.today.overtimeMachines != null ? (
                      <span>
                        {statusData.today.overtimeMachines}{' '}
                        <span className="text-xs font-normal text-orange-700">Machines</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-sm italic font-sans">0 Machines</span>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-orange-50/70 border border-orange-200/60 rounded-xl">
                  <span className="text-[11px] font-bold text-orange-800 block uppercase tracking-wider">
                    Overtime Hours
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-orange-950 mt-1 font-mono">
                    {statusData?.today.overtimeHours != null ? (
                      <span>
                        {statusData.today.overtimeHours}{' '}
                        <span className="text-xs font-normal text-orange-700">Hours</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-sm italic font-sans">0 Hours</span>
                    )}
                  </div>
                </div>
              </div>

              {statusData?.worker?.customWageRate && statusData.today.overtimeMachines && statusData.today.overtimeHours ? (
                <div className="p-2.5 bg-slate-900 text-white rounded-xl flex items-center justify-between text-xs">
                  <span className="text-slate-300">
                    Estimated OT Wage (@ ₹{statusData.worker.customWageRate}/mc/hr):
                  </span>
                  <strong className="text-amber-400 font-mono text-sm font-black">
                    ₹{Math.round(statusData.today.overtimeMachines * statusData.today.overtimeHours * statusData.worker.customWageRate).toLocaleString('en-IN')}
                  </strong>
                </div>
              ) : null}
            </div>

            {/* Weekly Summary Card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-3">
              <h3 className="text-sm font-bold text-navy-950 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-600" />
                  <span>This Week's Summary • आठवड्याचा सारांश</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 font-mono">
                  {statusData?.weeklySummary?.startDate} - {statusData?.weeklySummary?.endDate}
                </span>
              </h3>

              {/* Weekly Earnings Box with Approved Overtime */}
              <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-white rounded-xl border border-emerald-200/90 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block">
                      Weekly Salary • आठवड्याचा एकूण पगार
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-emerald-900 mt-0.5">
                      ₹ {(statusData?.weeklySummary?.totalWeeklyEarnings ?? 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="text-right text-xs space-y-1">
                    <div className="text-slate-600 font-medium">
                      Base Wage: <strong>₹{(statusData?.weeklySummary?.totalWeeklyBaseEarnings ?? 0).toLocaleString('en-IN')}</strong>
                    </div>
                    {(statusData?.weeklySummary?.totalWeeklyApprovedOvertime ?? 0) > 0 ? (
                      <div className="text-emerald-700 font-bold bg-emerald-100/90 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>+ Approved OT: ₹{statusData?.weeklySummary?.totalWeeklyApprovedOvertime?.toLocaleString('en-IN')}</span>
                      </div>
                    ) : (statusData?.weeklySummary?.totalWeeklyPendingOvertime ?? 0) > 0 ? (
                      <div className="text-amber-800 font-bold bg-amber-100/90 px-2 py-0.5 rounded-md inline-flex items-center gap-1 animate-pulse">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>⏳ Pending OT: ₹{statusData?.weeklySummary?.totalWeeklyPendingOvertime?.toLocaleString('en-IN')}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

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

        {/* TAB: DEDICATED OVERTIME PORTAL */}
        {currentTab === 'overtime' && (
          <div className="space-y-4">
            {/* Overtime Portal Header Banner */}
            <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-100 uppercase tracking-wider">
                  <Timer className="w-4 h-4" />
                  <span>Factory Overtime Portal</span>
                </div>
                <span className="text-[11px] font-bold bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-white/30">
                  🏭 {statusData?.worker?.unit || user?.unit || 'Unit 1'}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Overtime Duty &amp; Operations
              </h2>
              <p className="text-xs text-amber-100 mt-1">
                Record your extra loom machines and overtime operating hours accurately.
              </p>

              {/* Status Pills */}
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/20 text-xs">
                <span className="bg-black/25 px-2.5 py-1 rounded-lg font-mono">
                  Worker ID: {user?.workerId}
                </span>
                <span className="bg-black/25 px-2.5 py-1 rounded-lg">
                  {statusData?.today.shiftType === 'NIGHT' ? '🌙 Night Shift' : '☀️ Day Shift'}
                </span>
                {statusData?.worker?.customWageRate ? (
                  <span className="bg-white/25 px-2.5 py-1 rounded-lg font-mono font-bold">
                    Rate: ₹{statusData.worker.customWageRate}/mc/hr
                  </span>
                ) : null}
              </div>
            </div>

            {/* Overtime Today Summary Card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-navy-950">Today's Recorded Overtime</h3>
                  <p className="text-xs text-slate-500">{statusData?.today.formattedDate || 'Today'}</p>
                </div>
                {statusData?.today.overtimeStatus === 'APPROVED' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Approved / मंजूर
                  </span>
                ) : statusData?.today.overtimeStatus === 'REJECTED' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200" title={statusData.today.overtimeRejectionReason || undefined}>
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    Rejected / नाकारले
                  </span>
                ) : (statusData?.today.overtimeHours || Number(statusData?.today.overtimeMachines || 0) > 0) ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-300 animate-pulse">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Pending Approval / मंजुरी बाकी
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                    Not Recorded Yet
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-orange-50 rounded-xl border border-orange-200/80">
                  <span className="text-[11px] font-bold text-orange-800 uppercase tracking-wide block">
                    OT Machines Operated
                  </span>
                  <div className="text-2xl font-black text-orange-950 mt-1 font-mono">
                    {statusData?.today.overtimeMachines ?? (overtimeMachines || 0)}{' '}
                    <span className="text-xs font-normal text-orange-700">Looms</span>
                  </div>
                </div>

                <div className="p-3.5 bg-orange-50 rounded-xl border border-orange-200/80">
                  <span className="text-[11px] font-bold text-orange-800 uppercase tracking-wide block">
                    OT Hours Worked
                  </span>
                  <div className="text-2xl font-black text-orange-950 mt-1 font-mono">
                    {statusData?.today.overtimeHours ?? (overtimeHours || 0)}{' '}
                    <span className="text-xs font-normal text-orange-700">Hours</span>
                  </div>
                </div>
              </div>

              {/* Calculated Overtime Payout Card */}
              {statusData?.worker?.customWageRate && (overtimeMachines || statusData?.today.overtimeMachines) && (overtimeHours || statusData?.today.overtimeHours) ? (
                <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Overtime Formula:</span>
                    <span className="font-mono text-amber-300">
                      {(overtimeMachines || statusData.today.overtimeMachines)} mc × {(overtimeHours || statusData.today.overtimeHours)} hrs × ₹{statusData.worker.customWageRate}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                    <span className="text-xs font-bold text-slate-200">Total Projected OT Earnings:</span>
                    <strong className="text-base sm:text-lg font-black text-amber-400 font-mono">
                      ₹{Math.round(
                        Number(overtimeMachines || statusData.today.overtimeMachines) *
                        Number(overtimeHours || statusData.today.overtimeHours) *
                        statusData.worker.customWageRate
                      ).toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>
              ) : null}

              {/* Overtime Approval Confirmation Alert */}
              {statusData?.today.overtimeStatus === 'APPROVED' && (
                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-300 flex items-start gap-3">
                  <div className="p-2 bg-emerald-600 text-white rounded-lg shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-black text-emerald-950 flex items-center gap-1.5 flex-wrap">
                      <span>Overtime Approved by Admin! (मंजूर झाले)</span>
                      <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                        Salary Added
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800 mt-1">
                      Your overtime work has been approved. The overtime pay has been credited to your regular salary on your Shift and History screens!
                    </p>
                  </div>
                </div>
              )}

              {statusData?.today.overtimeStatus === 'PENDING' && (statusData.today.overtimeHours || Number(statusData.today.overtimeMachines || 0) > 0) && (
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-300 flex items-start gap-3">
                  <div className="p-2 bg-amber-500 text-white rounded-lg shrink-0 mt-0.5">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-black text-amber-950 flex items-center gap-1.5 flex-wrap">
                      <span>Overtime Pending Admin Approval (मंजुरी बाकी)</span>
                    </div>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Your overtime log has been submitted to the Admin portal for verification. Once approved, the salary will be added to your regular earnings.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Overtime Entry Form Card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-orange-200 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-navy-950">Log or Update Overtime Work</h3>
                  <p className="text-xs text-slate-500">Enter overtime machines &amp; hours for today</p>
                </div>
              </div>

              {overtimeSavedMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{overtimeSavedMessage}</span>
                </div>
              )}

              <form onSubmit={handleSaveOvertimeWork} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Overtime Machines Operated *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    placeholder="e.g. 2 or 4 (Count of looms operated in OT)"
                    value={overtimeMachines}
                    onChange={(e) => setOvertimeMachines(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-orange-500"
                  />
                  <span className="text-[10px] text-slate-500">
                    Number of textile machines operated specifically during overtime hours.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Overtime Hours Worked *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    placeholder="e.g. 2, 3.5, 4 (Duration in hours)"
                    value={overtimeHours}
                    onChange={(e) => setOvertimeHours(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-orange-500"
                  />
                  <span className="text-[10px] text-slate-500">
                    Overtime duration worked beyond standard shift duty.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Remarks / Loom Numbers / Supervisor (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Looms #5, #6; approved by floor supervisor"
                    value={overtimeRemarks}
                    onChange={(e) => setOvertimeRemarks(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Live Real-time Wage Calculation Box */}
                {statusData?.worker?.customWageRate && overtimeMachines && overtimeHours && Number(overtimeMachines) > 0 && Number(overtimeHours) > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-center justify-between">
                    <div>
                      <span className="font-bold block">Live OT Wage Preview:</span>
                      <span className="text-[11px] text-amber-800">
                        {overtimeMachines} mc × {overtimeHours} hrs @ ₹{statusData.worker.customWageRate}
                      </span>
                    </div>
                    <strong className="text-base font-black font-mono text-amber-900">
                      ₹{Math.round(Number(overtimeMachines) * Number(overtimeHours) * statusData.worker.customWageRate).toLocaleString('en-IN')}
                    </strong>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingOvertime}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-extrabold text-sm rounded-xl shadow-md transition-all tap-active disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingOvertime ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Timer className="w-4 h-4" />
                      <span>Save Overtime Details</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Overtime Guidelines Card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs text-slate-600 space-y-2">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-orange-600" />
                <span>Factory Overtime Guidelines:</span>
              </div>
              <p>• Overtime entries are verified against shift schedules and loom operation logs.</p>
              <p>• You can update your overtime work details at any time before final checkout.</p>
              <p>• Overtime earnings will be settled in your weekly / monthly payroll calculation.</p>
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
                    className="p-3.5 bg-slate-50 hover:bg-slate-100/70 rounded-xl border border-slate-200/80 flex items-center justify-between transition-colors gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-navy-950">{r.formattedDate}</span>
                        <span className="text-[11px] text-slate-500 font-medium">({r.dayOfWeek})</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          r.shiftType === 'NIGHT'
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {r.shiftType === 'NIGHT' ? '🌙 Night' : '☀️ Day'}
                        </span>

                        {/* Overtime Approval Badge */}
                        {r.overtimeStatus === 'APPROVED' ? (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            OT Added (+₹{r.earnings?.overtimeEarned || 0})
                          </span>
                        ) : r.overtimeStatus === 'PENDING' ? (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300 animate-pulse flex items-center gap-0.5">
                            <Clock className="w-3 h-3 text-amber-600" />
                            OT Pending
                          </span>
                        ) : r.overtimeStatus === 'REJECTED' ? (
                          <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded border border-rose-200">
                            OT Rejected
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-600 mt-1 font-mono flex-wrap">
                        <span>In: {r.checkInTime}</span>
                        <span>•</span>
                        <span>Out: {r.checkOutTime}</span>
                        {r.workingHours > 0 && (
                          <>
                            <span>•</span>
                            <span className="font-bold text-teal-700">{r.workingHours}h</span>
                          </>
                        )}
                        {r.overtimeHours && r.overtimeHours > 0 && (
                          <>
                            <span>•</span>
                            <span className="font-bold text-amber-700">OT: {r.overtimeHours}h</span>
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

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={r.status} size="sm" />
                      {r.earnings?.totalEarned !== undefined && r.earnings?.totalEarned > 0 && (
                        <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-mono">
                          ₹{r.earnings.totalEarned.toLocaleString('en-IN')}
                        </span>
                      )}
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
                <span className="text-slate-500 font-medium">Factory Unit</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black bg-purple-50 text-purple-900 border border-purple-200">
                  <Building2 className="w-3.5 h-3.5 text-purple-700" />
                  <span>{statusData?.worker?.unit || user?.unit || 'Unit 1'}</span>
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl flex justify-between items-center">
                <span className="text-slate-500 font-medium">Wage Model</span>
                <span className="font-bold text-navy-950">
                  {hasCustomWageAccess ? (
                    <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-xs font-semibold">
                      Custom (₹{statusData?.worker?.customWageRate ?? user?.customWageRate ?? 0}/mc/hr)
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

          {/* SHIFT WORK SECTION */}
          {hasCustomWageAccess && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-navy-950 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-teal-700" />
                  <span>Standard Shift Work</span>
                </span>
                <span className="text-[10px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 font-bold uppercase">
                  Shift Duty
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Shift Machines Operated
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 2"
                    value={machinesOperated}
                    onChange={(e) => setMachinesOperated(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Shift Hours Worked
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 8"
                    value={hoursOperated}
                    onChange={(e) => setHoursOperated(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* DEDICATED OVERTIME SECTION */}
          <div className="p-3.5 bg-orange-50/80 rounded-xl border border-orange-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasOvertime || Boolean(overtimeMachines) || Boolean(overtimeHours)}
                  onChange={(e) => setHasOvertime(e.target.checked)}
                  className="rounded text-orange-600 focus:ring-orange-500 h-4 w-4"
                />
                <span className="text-xs font-bold text-orange-950 flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-orange-700" />
                  <span>Overtime (OT) Work Section</span>
                </span>
              </label>
              {(hasOvertime || Boolean(overtimeMachines) || Boolean(overtimeHours)) && (
                <span className="text-[10px] font-bold text-orange-800 bg-orange-100 px-2 py-0.5 rounded border border-orange-200 uppercase">
                  OT Active
                </span>
              )}
            </div>

            {(hasOvertime || Boolean(overtimeMachines) || Boolean(overtimeHours)) ? (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      OT Machines Operated *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="e.g. 2 (OT Looms)"
                      value={overtimeMachines}
                      onChange={(e) => setOvertimeMachines(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      OT Hours Worked *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="e.g. 3.5 (OT Hours)"
                      value={overtimeHours}
                      onChange={(e) => setOvertimeHours(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                {statusData?.worker?.customWageRate && overtimeMachines && overtimeHours && Number(overtimeMachines) > 0 && Number(overtimeHours) > 0 && (
                  <div className="p-2.5 bg-orange-100/70 border border-orange-200 rounded-lg flex items-center justify-between text-xs">
                    <span className="text-orange-900 font-semibold">Overtime Payout Preview:</span>
                    <strong className="text-orange-950 font-mono text-sm font-black">
                      ₹{Math.round(Number(overtimeMachines) * Number(overtimeHours) * statusData.worker.customWageRate).toLocaleString('en-IN')}
                    </strong>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-orange-800 leading-relaxed">
                Check the box above if you operated machines or worked overtime beyond standard hours today.
              </p>
            )}
          </div>

          {/* COMBINED PROJECTED PAYOUT SUMMARY (FOR BOTH CUSTOM AND FIXED WORKERS) */}
          {statusData?.worker?.customWageRate ? (
            (() => {
              const rate = statusData.worker.customWageRate;
              const shiftM = machinesOperated ? Number(machinesOperated) : 0;
              const shiftH = hoursOperated ? Number(hoursOperated) : 0;
              const otM = overtimeMachines ? Number(overtimeMachines) : 0;
              const otH = overtimeHours ? Number(overtimeHours) : 0;
              const shiftPay = shiftM * shiftH * rate;
              const otPay = otM * otH * rate;
              const total = Math.round(shiftPay + otPay);
              if (total <= 0) return null;

              return (
                <div className="p-3 bg-slate-900 text-white rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Shift: ₹{Math.round(shiftPay).toLocaleString('en-IN')} | OT: ₹{Math.round(otPay).toLocaleString('en-IN')}</span>
                    <span className="font-mono text-slate-400">Rate: ₹{rate.toFixed(2)}/mc/hr</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                    <span className="text-xs font-bold text-slate-200">Total Shift Pay:</span>
                    <strong className="text-base font-black text-amber-400 font-mono">
                      ₹{total.toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>
              );
            })()
          ) : (
            (() => {
              const dailyRate = statusData?.worker?.dailyWage || user?.dailyWage || 1000;
              const otH = overtimeHours ? Number(overtimeHours) : 0;
              const otHourly = dailyRate / 12;
              const otPay = Math.round(otH * otHourly);
              const total = Math.round(dailyRate + otPay);

              return (
                <div className="p-3 bg-slate-900 text-white rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Fixed Daily Wage</span>
                    <span className="font-mono text-slate-400">Daily Rate: ₹{dailyRate.toLocaleString('en-IN')}</span>
                  </div>
                  {otPay > 0 && (
                    <div className="flex items-center justify-between text-[11px] text-amber-300">
                      <span>Overtime Pay ({otH}h):</span>
                      <span className="font-mono">+₹{otPay.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                    <span className="text-xs font-bold text-slate-200">Total Shift Pay:</span>
                    <strong className="text-base font-black text-amber-400 font-mono">
                      ₹{total.toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>
              );
            })()
          )}

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

      {/* 🎊 Check-Out Earnings Celebration Modal */}
      {showCelebrationModal && celebrationEarnings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-amber-200/80 transform transition-all scale-100">
            {/* Top Celebratory Header with Gradient */}
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-6 text-white text-center relative overflow-hidden">
              <div className="inline-block py-1 px-3.5 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-extrabold tracking-widest text-white uppercase mb-2 shadow-sm border border-white/30">
                ॥ श्री स्वामी समर्थ ॥
              </div>

              <h2 className="text-xl sm:text-2xl font-black tracking-tight drop-shadow-sm">
                Shift Completed! 🎉
              </h2>
              <p className="text-xs sm:text-sm text-amber-100 font-medium mt-0.5">
                उत्कृष्ट काम केले! आजची विश्रांती घ्या.
              </p>

              {/* Bouncing Gold Rupee Coin */}
              <div className="mt-4 flex justify-center">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-yellow-300 via-amber-400 to-yellow-200 text-amber-950 font-black text-4xl flex items-center justify-center shadow-2xl shadow-yellow-500/50 border-4 border-white animate-bounce">
                    ₹
                  </div>
                  <div className="absolute -top-1 -right-1 text-2xl animate-pulse text-yellow-200">
                    ✨
                  </div>
                </div>
              </div>
            </div>

            {/* Earnings Total and Breakdown */}
            <div className="p-6 space-y-5 text-center">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                  Total Shift Earnings • आजची एकूण कमाई
                </span>
                <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-emerald-600 to-teal-700 tracking-tight mt-1">
                  ₹ {animatedRupees.toLocaleString('en-IN')}
                </div>
              </div>

              {/* Shift Specs Pill Grid */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left space-y-2.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-slate-500 font-medium">Shift Type:</span>
                  <span className="font-extrabold text-navy-950">
                    {celebrationEarnings.shiftType === 'NIGHT' ? '🌙 Night Shift (8 PM - 8 AM)' : '☀️ Day Shift (8 AM - 8 PM)'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-slate-500 font-medium">Working Hours:</span>
                  <span className="font-extrabold text-navy-950">
                    {celebrationEarnings.hoursOperated || 12} hrs
                  </span>
                </div>

                {celebrationEarnings.wageType === 'CUSTOM' ? (
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-slate-500 font-medium">Looms Operated:</span>
                    <span className="font-extrabold text-navy-950">
                      {celebrationEarnings.machinesOperated} Loom(s)
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-slate-500 font-medium">Wage Model:</span>
                    <span className="font-extrabold text-navy-950">
                      💼 Fixed Daily Wage
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-slate-500 font-medium">Base Shift Pay:</span>
                  <span className="font-extrabold text-emerald-700">
                    ₹ {celebrationEarnings.baseEarned.toLocaleString('en-IN')}
                  </span>
                </div>

                {celebrationEarnings.overtimeEarned > 0 && (
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-amber-800 font-semibold flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        <span>Overtime ({celebrationEarnings.overtimeHours}h):</span>
                      </span>
                      <span className="font-extrabold text-amber-800">
                        ₹ {celebrationEarnings.overtimeEarned.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span>Sent to Admin for approval (मंजुरी बाकी)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Blessing Quote */}
              <div className="py-2 px-3 rounded-xl bg-amber-50 text-amber-900 border border-amber-200/70 text-xs font-semibold">
                ॥ अशक्य ही शक्य करतील स्वामी ॥
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    playCelebrationChime();
                    triggerMultiConfetti();
                  }}
                  className="py-3 px-4 rounded-xl border border-amber-300 text-amber-800 hover:bg-amber-50 font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 tap-active"
                >
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Replay Confetti 🎊</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCelebrationModal(false)}
                  className="py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-emerald-600/30 transition-all tap-active flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Done / ठीक आहे</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Worker Mobile Bottom Navigation */}
      <WorkerBottomNav currentTab={currentTab} onSelectTab={(tab: any) => setCurrentTab(tab)} />
    </div>
  );
};
