import React, { useState, useEffect } from 'react';
import { Clock, Building2, Plus, Edit2, Trash2, RotateCcw, ShieldAlert, Check, RefreshCw, MapPin, Factory, Navigation, Compass } from 'lucide-react';
import { settingsApi } from '../../services/api.ts';
import { CompanySettingsData, Shift } from '../../types/index.ts';
import { Modal } from '../../components/common/Modal.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { getCurrentGPSPosition } from '../../utils/geo.ts';

export const SettingsPage: React.FC = () => {
  const { showToast } = useToast();

  const [settingsData, setSettingsData] = useState<CompanySettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Form states for company settings
  const [companyName, setCompanyName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [checkInBand, setCheckInBand] = useState(30);
  const [gracePeriod, setGracePeriod] = useState(15);
  const [breakDuration, setBreakDuration] = useState(60);
  const [autoDeductThreshold, setAutoDeductThreshold] = useState(300);
  const [overtimeThreshold, setOvertimeThreshold] = useState(8.5);

  // Factory Geofencing & Map Coordinates (Unit 1 & Unit 2)
  const [geofencingEnabled, setGeofencingEnabled] = useState(true);
  const [geofenceRadius, setGeofenceRadius] = useState(100);
  const [unit1Name, setUnit1Name] = useState('Unit 1');
  const [unit1Lat, setUnit1Lat] = useState('16.432500');
  const [unit1Lng, setUnit1Lng] = useState('74.384222');
  const [unit2Name, setUnit2Name] = useState('Unit 2');
  const [unit2Lat, setUnit2Lat] = useState('16.344861');
  const [unit2Lng, setUnit2Lng] = useState('74.441361');
  const [acquiringGPSUnit, setAcquiringGPSUnit] = useState<'unit1' | 'unit2' | null>(null);

  // Add / Edit Shift Modal
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftName, setShiftName] = useState('');
  const [shiftStart, setShiftStart] = useState('08:30');
  const [shiftEnd, setShiftEnd] = useState('17:30');
  const [shiftGrace, setShiftGrace] = useState(15);
  const [shiftBreak, setShiftBreak] = useState(60);
  const [savingShift, setSavingShift] = useState(false);
  const [deletingShiftId, setDeletingShiftId] = useState<string | null>(null);
  const [resettingShifts, setResettingShifts] = useState(false);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await settingsApi.get();
      if (res.success) {
        setSettingsData(res.data);
        const s = res.data.settings;
        setCompanyName(s.companyName);
        setTimezone(s.timezone);
        setCheckInBand(s.rules.checkInBandMinutes ?? 30);
        setGracePeriod(s.rules.gracePeriodMinutes || 15);
        setBreakDuration(s.rules.breakDurationMinutes || 60);
        setAutoDeductThreshold(s.rules.autoDeductBreakThresholdMinutes || 300);
        setOvertimeThreshold(s.rules.overtimeThresholdHours || 8.5);
        setGeofencingEnabled(s.rules.geofencingEnabled ?? true);
        setGeofenceRadius(s.rules.geofenceRadiusMeters ?? 100);
        setUnit1Name(s.rules.unit1Name || 'Unit 1');
        setUnit1Lat(String(s.rules.unit1Lat ?? 16.432500));
        setUnit1Lng(String(s.rules.unit1Lng ?? 74.384222));
        setUnit2Name(s.rules.unit2Name || 'Unit 2');
        setUnit2Lat(String(s.rules.unit2Lat ?? 16.344861));
        setUnit2Lng(String(s.rules.unit2Lng ?? 74.441361));
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load system settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleGetDeviceLocation = async (target: 'unit1' | 'unit2') => {
    setAcquiringGPSUnit(target);
    try {
      const pos = await getCurrentGPSPosition(10000);
      if (target === 'unit1') {
        setUnit1Lat(pos.latitude.toFixed(6));
        setUnit1Lng(pos.longitude.toFixed(6));
        showToast('📍 Unit 1 coordinates updated from current location!', 'success');
      } else {
        setUnit2Lat(pos.latitude.toFixed(6));
        setUnit2Lng(pos.longitude.toFixed(6));
        showToast('📍 Unit 2 coordinates updated from current location!', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Could not acquire GPS location', 'error');
    } finally {
      setAcquiringGPSUnit(null);
    }
  };

  const handleSaveCompanySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      const res = await settingsApi.update({
        companyName: companyName.trim(),
        timezone: timezone.trim(),
        rules: {
          checkInBandMinutes: Number(checkInBand),
          gracePeriodMinutes: Number(gracePeriod),
          breakDurationMinutes: Number(breakDuration),
          autoDeductBreakThresholdMinutes: Number(autoDeductThreshold),
          overtimeThresholdHours: Number(overtimeThreshold),
          geofencingEnabled: Boolean(geofencingEnabled),
          geofenceRadiusMeters: Number(geofenceRadius),
          unit1Name: unit1Name.trim(),
          unit1Lat: parseFloat(unit1Lat) || 16.432500,
          unit1Lng: parseFloat(unit1Lng) || 74.384222,
          unit2Name: unit2Name.trim(),
          unit2Lat: parseFloat(unit2Lat) || 16.344861,
          unit2Lng: parseFloat(unit2Lng) || 74.441361,
        },
      });

      if (res.success) {
        showToast('Company settings & rules updated successfully', 'success');
        await loadSettings();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleOpenAddShift = () => {
    setEditingShift(null);
    setShiftName('');
    setShiftStart('08:30');
    setShiftEnd('17:30');
    setShiftGrace(15);
    setShiftBreak(60);
    setShiftModalOpen(true);
  };

  const handleOpenEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setShiftName(shift.name);
    setShiftStart(shift.startTime);
    setShiftEnd(shift.endTime);
    setShiftGrace(shift.gracePeriodMinutes);
    setShiftBreak(shift.breakDurationMinutes);
    setShiftModalOpen(true);
  };

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingShift(true);
      if (editingShift) {
        const res = await settingsApi.updateShift(editingShift.id, {
          name: shiftName.trim(),
          startTime: shiftStart.trim(),
          endTime: shiftEnd.trim(),
          gracePeriodMinutes: Number(shiftGrace),
          breakDurationMinutes: Number(shiftBreak),
        });
        if (res.success) {
          showToast(res.message, 'success');
          setShiftModalOpen(false);
          await loadSettings();
        }
      } else {
        const res = await settingsApi.createShift({
          name: shiftName.trim(),
          startTime: shiftStart.trim(),
          endTime: shiftEnd.trim(),
          gracePeriodMinutes: Number(shiftGrace),
          breakDurationMinutes: Number(shiftBreak),
        });
        if (res.success) {
          showToast(res.message, 'success');
          setShiftModalOpen(false);
          await loadSettings();
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save shift', 'error');
    } finally {
      setSavingShift(false);
    }
  };

  const handleDeleteShift = async (shift: Shift) => {
    if (!window.confirm(`Are you sure you want to delete shift "${shift.name}"?`)) {
      return;
    }
    try {
      setDeletingShiftId(shift.id);
      const res = await settingsApi.deleteShift(shift.id);
      if (res.success) {
        showToast(res.message, 'success');
        await loadSettings();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete shift', 'error');
    } finally {
      setDeletingShiftId(null);
    }
  };

  const handleResetAllShifts = async () => {
    if (!window.confirm('Are you sure you want to reset all factory shifts? All shift timings will be removed so you can configure them according to your convenience.')) {
      return;
    }
    try {
      setResettingShifts(true);
      const res = await settingsApi.resetShifts();
      if (res.success) {
        showToast(res.message, 'success');
        await loadSettings();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to reset shifts', 'error');
    } finally {
      setResettingShifts(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-navy-950 tracking-tight">
          System & Shift Configuration
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Configure factory working hours, grace periods, lunch breaks, and overtime rules
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COMPANY SETTINGS & RULES (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveCompanySettings} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
            <h2 className="text-base font-bold text-navy-950 flex items-center gap-2 pb-3 border-b border-slate-100">
              <Building2 className="w-5 h-5 text-teal-600" />
              <span>Company Information & Timezone</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Company Name (Header & Exports)
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Plant Timezone
                </label>
                <input
                  type="text"
                  required
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-teal-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Default: Asia/Kolkata (IST +05:30)</span>
              </div>
            </div>

            {/* Factory Geofencing & GPS Map Coordinates Section */}
            <div className="pt-5 border-t border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-navy-950 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-indigo-600" />
                  <span>Factory Geofence & GPS Coordinates (युनिट १ व युनिट २ नकाशे)</span>
                </h3>

                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs font-bold text-slate-700">जिओफेन्सिंग:</span>
                  <input
                    type="checkbox"
                    checked={geofencingEnabled}
                    onChange={(e) => setGeofencingEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                  />
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    geofencingEnabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {geofencingEnabled ? 'सक्रिय (Active)' : 'बंद (Disabled)'}
                  </span>
                </label>
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Geofence Radius (मर्यादा मीटर मध्ये - उदा. 100 मीटर)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      required
                      min={10}
                      max={5000}
                      value={geofenceRadius}
                      onChange={(e) => setGeofenceRadius(Number(e.target.value))}
                      className="w-36 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold font-mono focus:ring-2 focus:ring-teal-500"
                    />
                    <span className="text-xs font-medium text-slate-500">
                      मीटर आवारात (फॅक्टरी केंद्रापासून कामगारांना या अंतरातच Check In/Out करता येईल)
                    </span>
                  </div>
                </div>

                {/* Unit 1 Coordinates */}
                <div className="p-4 bg-white rounded-xl border border-indigo-100 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Factory className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-indigo-950">Unit 1 Coordinates (16°25'57.0"N 74°23'03.2"E)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleGetDeviceLocation('unit1')}
                      disabled={acquiringGPSUnit === 'unit1'}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                    >
                      <Navigation className={`w-3.5 h-3.5 ${acquiringGPSUnit === 'unit1' ? 'animate-spin' : ''}`} />
                      <span>{acquiringGPSUnit === 'unit1' ? 'Locating...' : 'Use Current Device GPS'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Unit 1 Name</label>
                      <input
                        type="text"
                        value={unit1Name}
                        onChange={(e) => setUnit1Name(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Latitude (अक्षांश)</label>
                      <input
                        type="text"
                        value={unit1Lat}
                        onChange={(e) => setUnit1Lat(e.target.value)}
                        placeholder="16.432500"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-semibold focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Longitude (रेखांश)</label>
                      <input
                        type="text"
                        value={unit1Lng}
                        onChange={(e) => setUnit1Lng(e.target.value)}
                        placeholder="74.384222"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-semibold focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Unit 2 Coordinates */}
                <div className="p-4 bg-white rounded-xl border border-sky-100 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Factory className="w-4 h-4 text-sky-600" />
                      <span className="text-xs font-bold text-sky-950">Unit 2 Coordinates (16°20'41.5"N 74°26'28.9"E)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleGetDeviceLocation('unit2')}
                      disabled={acquiringGPSUnit === 'unit2'}
                      className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                    >
                      <Navigation className={`w-3.5 h-3.5 ${acquiringGPSUnit === 'unit2' ? 'animate-spin' : ''}`} />
                      <span>{acquiringGPSUnit === 'unit2' ? 'Locating...' : 'Use Current Device GPS'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Unit 2 Name</label>
                      <input
                        type="text"
                        value={unit2Name}
                        onChange={(e) => setUnit2Name(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Latitude (अक्षांश)</label>
                      <input
                        type="text"
                        value={unit2Lat}
                        onChange={(e) => setUnit2Lat(e.target.value)}
                        placeholder="16.344861"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-semibold focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Longitude (रेखांश)</label>
                      <input
                        type="text"
                        value={unit2Lng}
                        onChange={(e) => setUnit2Lng(e.target.value)}
                        placeholder="74.441361"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-semibold focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="flex items-center gap-2 px-5 py-2.5 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all disabled:opacity-50"
              >
                {savingSettings ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Company Settings</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* SHIFTS CONFIGURATION (1 Col) */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-navy-950 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-600" />
                  <span>Factory Shifts</span>
                </h2>
                <p className="text-xs text-slate-500">Configured plant work schedules</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetAllShifts}
                  disabled={resettingShifts || !settingsData?.shifts || settingsData.shifts.length === 0}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
                  title="Reset all factory shifts"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${resettingShifts ? 'animate-spin' : ''}`} />
                  <span>Reset</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenAddShift}
                  className="p-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg transition-colors"
                  title="Add New Shift"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {!settingsData?.shifts || settingsData.shifts.length === 0 ? (
                <div className="py-8 px-4 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">No factory shifts configured</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Click the <span className="font-bold text-teal-700">+</span> button above to create shifts according to your convenience.
                  </p>
                </div>
              ) : (
                settingsData.shifts.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 rounded-xl transition-colors flex items-center justify-between"
                  >
                    <div>
                      <h3 className="font-bold text-xs text-navy-950">{s.name}</h3>
                      <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                        {s.startTime} — {s.endTime}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Grace: {s.gracePeriodMinutes}m • Break: {s.breakDurationMinutes}m
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditShift(s)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-navy-950 hover:bg-slate-200/60 transition-colors"
                        title="Edit Shift"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteShift(s)}
                        disabled={deletingShiftId === s.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                        title="Delete Shift"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SHIFT MODAL */}
      <Modal
        isOpen={shiftModalOpen}
        onClose={() => setShiftModalOpen(false)}
        title={editingShift ? 'Edit Shift Schedule' : 'Add New Plant Shift'}
        subtitle="Specify shift hours, grace period, and break duration"
        maxWidth="md"
      >
        <form onSubmit={handleSaveShift} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Shift Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Shift D - Night Weaving"
              value={shiftName}
              onChange={(e) => setShiftName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Start Time (HH:mm)</label>
              <input
                type="time"
                required
                value={shiftStart}
                onChange={(e) => setShiftStart(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">End Time (HH:mm)</label>
              <input
                type="time"
                required
                value={shiftEnd}
                onChange={(e) => setShiftEnd(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Grace Period (Minutes)</label>
              <input
                type="number"
                min="0"
                max="60"
                value={shiftGrace}
                onChange={(e) => setShiftGrace(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Break Duration (Minutes)</label>
              <input
                type="number"
                min="0"
                max="120"
                value={shiftBreak}
                onChange={(e) => setShiftBreak(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShiftModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingShift}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
            >
              {savingShift ? 'Saving...' : 'Save Shift'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
