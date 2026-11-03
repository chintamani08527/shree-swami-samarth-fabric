import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Building2,
  KeyRound,
  UserX,
  Edit2,
  CheckCircle2,
  XCircle,
  Phone,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { workersApi, departmentsApi, settingsApi } from '../../services/api.ts';
import { User, Department, Shift } from '../../types/index.ts';
import { Modal } from '../../components/common/Modal.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

// Helper Salary Projection Breakdown Card (Week, Month, Year)
const SalaryProjectionCard: React.FC<{
  wageType: 'FIXED' | 'CUSTOM';
  dailyWage?: number | string;
  customWageRate?: number | string;
}> = ({ wageType, dailyWage, customWageRate }) => {
  const [simMachines, setSimMachines] = useState(1);
  const [simHours, setSimHours] = useState(8);

  const rate = wageType === 'CUSTOM' ? parseFloat(String(customWageRate || 0)) : 0;
  const fixedDay = wageType === 'FIXED' ? parseFloat(String(dailyWage || 0)) : 0;

  if (wageType === 'CUSTOM' && (!rate || rate <= 0)) return null;
  if (wageType === 'FIXED' && (!fixedDay || fixedDay <= 0)) return null;

  const daySalary = wageType === 'CUSTOM' ? rate * simMachines * simHours : fixedDay;
  const weekSalary = Math.round(daySalary * 6);
  const monthSalary = Math.round(daySalary * 26);
  const yearSalary = Math.round(monthSalary * 12);

  return (
    <div className="mt-3 p-3 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
          <span>📊</span>
          <span>Projected Salary Calculation</span>
        </span>
        {wageType === 'CUSTOM' ? (
          <span className="text-[10px] text-slate-400 font-mono">
            Rate: ₹{rate}/mach/hr
          </span>
        ) : (
          <span className="text-[10px] text-slate-400 font-mono">
            Rate: ₹{fixedDay}/day
          </span>
        )}
      </div>

      {wageType === 'CUSTOM' && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] bg-slate-800/80 p-2 rounded-lg border border-slate-700">
          <span className="text-slate-400 font-medium">Calculate for:</span>
          <div className="flex items-center gap-1">
            <span className="text-slate-300">Machines:</span>
            <select
              value={simMachines}
              onChange={(e) => setSimMachines(Number(e.target.value))}
              className="bg-slate-950 text-white border border-slate-600 rounded px-1.5 py-0.5 text-xs font-bold font-mono focus:ring-1 focus:ring-amber-500"
            >
              <option value="1">1 Machine</option>
              <option value="2">2 Machines</option>
              <option value="3">3 Machines</option>
              <option value="4">4 Machines</option>
              <option value="6">6 Machines</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-300">Hours/day:</span>
            <select
              value={simHours}
              onChange={(e) => setSimHours(Number(e.target.value))}
              className="bg-slate-950 text-white border border-slate-600 rounded px-1.5 py-0.5 text-xs font-bold font-mono focus:ring-1 focus:ring-amber-500"
            >
              <option value="8">8 hrs (Normal)</option>
              <option value="10">10 hrs</option>
              <option value="12">12 hrs (Full)</option>
            </select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
        <div className="bg-slate-800/70 p-2 rounded-lg border border-slate-700/60">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Week (6 Days)</div>
          <div className="text-sm font-extrabold font-mono text-emerald-400 mt-0.5">
            ₹{weekSalary.toLocaleString('en-IN')}
          </div>
          <div className="text-[9px] text-slate-400">₹{Math.round(daySalary).toLocaleString('en-IN')}/day</div>
        </div>

        <div className="bg-slate-800/70 p-2 rounded-lg border border-slate-700/60 ring-1 ring-amber-500/30">
          <div className="text-[10px] uppercase font-bold tracking-wider text-amber-300">Month (26 Days)</div>
          <div className="text-sm font-extrabold font-mono text-amber-400 mt-0.5">
            ₹{monthSalary.toLocaleString('en-IN')}
          </div>
          <div className="text-[9px] text-slate-400">26 working days</div>
        </div>

        <div className="bg-slate-800/70 p-2 rounded-lg border border-slate-700/60">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Year (12 Mos)</div>
          <div className="text-sm font-extrabold font-mono text-teal-400 mt-0.5">
            ₹{yearSalary.toLocaleString('en-IN')}
          </div>
          <div className="text-[9px] text-slate-400">Annual estimate</div>
        </div>
      </div>
    </div>
  );
};

export const WorkerManagement: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'ADMIN';

  const [workers, setWorkers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Add Worker Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newWorkerId, setNewWorkerId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<'WORKER' | 'SUPERVISOR' | 'ADMIN'>('WORKER');
  const [newDeptId, setNewDeptId] = useState('');
  const [newShiftId, setNewShiftId] = useState('');
  const [newWageType, setNewWageType] = useState<'FIXED' | 'CUSTOM'>('FIXED');
  const [newHasCustomAccess, setNewHasCustomAccess] = useState<boolean>(true);
  const [newDailyWage, setNewDailyWage] = useState<string>('');
  const [newCustomWageRate, setNewCustomWageRate] = useState<string>('');
  const [newPin, setNewPin] = useState('1234');
  const [savingWorker, setSavingWorker] = useState(false);

  // Edit Worker Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDeptId, setEditDeptId] = useState('');
  const [editShiftId, setEditShiftId] = useState('');
  const [editWageType, setEditWageType] = useState<'FIXED' | 'CUSTOM'>('FIXED');
  const [editHasCustomAccess, setEditHasCustomAccess] = useState<boolean>(false);
  const [editDailyWage, setEditDailyWage] = useState<string>('');
  const [editCustomWageRate, setEditCustomWageRate] = useState<string>('');
  const [editReason, setEditReason] = useState('');

  // Reset PIN Modal State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [targetWorker, setTargetWorker] = useState<User | null>(null);
  const [resetPinValue, setResetPinValue] = useState('');

  // Deactivate Modal State
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState('');

  // Load auxiliary data
  useEffect(() => {
    async function loadAux() {
      try {
        const [dRes, sRes] = await Promise.all([
          departmentsApi.list(),
          settingsApi.get(),
        ]);
        if (dRes.success) setDepartments(dRes.data);
        if (sRes.success) setShifts(sRes.data.shifts);
      } catch {}
    }
    loadAux();
  }, []);

  // Fetch Workers
  const loadWorkers = async () => {
    try {
      setLoading(true);
      const res = await workersApi.list({
        search: search || undefined,
        departmentId: selectedDept || undefined,
        isActive: selectedStatus !== '' ? selectedStatus === 'active' : undefined,
        limit: 100,
      });
      if (res.success) {
        setWorkers(res.data.workers);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load workers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkers();
  }, [selectedDept, selectedStatus]);

  // Handle Add Worker Submit
  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingWorker(true);
      const res = await workersApi.create({
        workerId: newWorkerId.trim().toUpperCase(),
        name: newName.trim(),
        phone: newPhone.trim() || undefined,
        role: newRole,
        departmentId: newDeptId || undefined,
        wageType: newWageType,
        hasCustomWageAccess: newWageType === 'CUSTOM' ? newHasCustomAccess : false,
        dailyWage: newWageType === 'FIXED' && newDailyWage ? parseFloat(newDailyWage) : undefined,
        customWageRate: newWageType === 'CUSTOM' && newCustomWageRate ? parseFloat(newCustomWageRate) : undefined,
        passwordOrPin: newPin,
      });

      if (res.success) {
        showToast(res.message, 'success');
        setAddModalOpen(false);
        // Reset form
        setNewWorkerId('');
        setNewName('');
        setNewPhone('');
        setNewWageType('FIXED');
        setNewHasCustomAccess(true);
        setNewDailyWage('');
        setNewCustomWageRate('');
        setNewPin('1234');
        await loadWorkers();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create worker', 'error');
    } finally {
      setSavingWorker(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (worker: User) => {
    setEditingWorker(worker);
    setEditName(worker.name);
    setEditPhone(worker.phone || '');
    setEditDeptId(worker.department?.id || '');
    setEditShiftId(worker.shift?.id || '');
    setEditWageType(worker.wageType === 'CUSTOM' ? 'CUSTOM' : 'FIXED');
    setEditHasCustomAccess(Boolean(worker.hasCustomWageAccess));
    setEditDailyWage(worker.dailyWage ? String(worker.dailyWage) : '');
    setEditCustomWageRate(worker.customWageRate ? String(worker.customWageRate) : '');
    setEditReason('');
    setEditModalOpen(true);
  };

  // Handle Edit Submit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorker) return;
    try {
      setSavingWorker(true);
      const res = await workersApi.update(editingWorker.id, {
        name: editName.trim(),
        phone: editPhone.trim() || null,
        departmentId: editDeptId || null,
        wageType: editWageType,
        hasCustomWageAccess: editWageType === 'CUSTOM' ? editHasCustomAccess : false,
        dailyWage: editWageType === 'FIXED' && editDailyWage ? parseFloat(editDailyWage) : null,
        customWageRate: editWageType === 'CUSTOM' && editCustomWageRate ? parseFloat(editCustomWageRate) : null,
        reason: editReason.trim() || undefined,
      });
      if (res.success) {
        showToast(res.message, 'success');
        setEditModalOpen(false);
        await loadWorkers();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update worker', 'error');
    } finally {
      setSavingWorker(false);
    }
  };

  // Open Reset PIN Modal
  const handleOpenResetPin = (worker: User) => {
    setTargetWorker(worker);
    setResetPinValue('');
    setResetModalOpen(true);
  };

  // Handle Reset PIN Submit
  const handleSaveResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetWorker) return;
    if (resetPinValue.length < 4) {
      showToast('PIN / Password must be at least 4 digits', 'error');
      return;
    }
    try {
      const res = await workersApi.resetPin(targetWorker.id, resetPinValue);
      if (res.success) {
        showToast(res.message, 'success');
        setResetModalOpen(false);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to reset PIN', 'error');
    }
  };

  // Open Deactivate Modal
  const handleOpenDeactivate = (worker: User) => {
    setTargetWorker(worker);
    setDeactivateReason('');
    setDeactivateModalOpen(true);
  };

  // Handle Deactivate Submit
  const handleSaveDeactivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetWorker) return;
    if (!deactivateReason.trim() || deactivateReason.trim().length < 5) {
      showToast('A mandatory reason is required to deactivate worker', 'error');
      return;
    }
    try {
      const res = await workersApi.deactivate(targetWorker.id, deactivateReason.trim());
      if (res.success) {
        showToast(res.message, 'success');
        setDeactivateModalOpen(false);
        await loadWorkers();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to deactivate worker', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-navy-950 tracking-tight">
            Factory Worker Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Profiles, department assignments, shift allocations & credential controls
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-navy-900 to-teal-800 hover:from-navy-800 hover:to-teal-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-navy-900/10 transition-all tap-active"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register New Worker</span>
          </button>
        )}
      </div>

      {/* FILTERS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by worker name, ID, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadWorkers()}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="inactive">Deactivated Only</option>
        </select>

        <button
          onClick={loadWorkers}
          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Filter</span>
        </button>
      </div>

      {/* WORKERS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Worker ID</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4 text-right">Wage Plan</th>
                <th className="py-3 px-4">Shift Mode</th>
                <th className="py-3 px-4 text-center">Role</th>
                <th className="py-3 px-4 text-center">Status</th>
                {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No workers registered yet. Click &quot;Register New Worker&quot; to add your staff.
                  </td>
                </tr>
              ) : (
                workers.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-navy-950">{w.workerId}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{w.name}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-xs">{w.phone || '--'}</td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{w.department?.name || 'Unassigned'}</td>
                    <td className="py-3 px-4 text-right">
                      {w.wageType === 'CUSTOM' || w.hasCustomWageAccess ? (
                        <div className="inline-flex flex-col items-end">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold font-mono text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            ₹{w.customWageRate ?? 0}/mach/hr
                          </span>
                          <span className="text-[9px] text-slate-500 font-medium mt-0.5">
                            ~₹{Math.round((w.customWageRate || 0) * 8 * 26).toLocaleString('en-IN')}/mo
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex flex-col items-end">
                          <span className="font-mono font-bold text-navy-950 text-xs">
                            {w.dailyWage ? `₹${w.dailyWage}/day` : '₹0 / Unset'}
                          </span>
                          {w.dailyWage ? (
                            <span className="text-[9px] text-slate-500 font-medium mt-0.5">
                              ~₹{Math.round(w.dailyWage * 26).toLocaleString('en-IN')}/mo
                            </span>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        ☀️ Day / 🌙 Night (Worker Chooses)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
                        {w.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {w.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          Deactivated
                        </span>
                      )}
                    </td>

                    {isAdmin && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(w)}
                            title="Edit Profile"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-navy-950 hover:bg-slate-100 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleOpenResetPin(w)}
                            title="Reset Credentials / PIN"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {w.isActive && (
                            <button
                              onClick={() => handleOpenDeactivate(w)}
                              title="Deactivate Worker Profile"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REGISTER WORKER MODAL */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Register New Factory Worker"
        subtitle="Create credentials and assign manufacturing department & shift"
        maxWidth="lg"
      >
        <form onSubmit={handleAddWorker} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Worker ID *</label>
              <input
                type="text"
                required
                placeholder="Enter Worker ID"
                value={newWorkerId}
                onChange={(e) => setNewWorkerId(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono uppercase focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                placeholder="Enter Full Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
            <input
              type="text"
              placeholder="Enter Phone Number"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Wage Type Selection */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">Wage Model *</label>
              <span className="text-[10px] text-slate-400">Admin sets Fixed; Custom worker logs machines &amp; hours</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNewWageType('FIXED')}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all text-center ${
                  newWageType === 'FIXED'
                    ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Fixed Wage
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewWageType('CUSTOM');
                  setNewHasCustomAccess(true);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all text-center ${
                  newWageType === 'CUSTOM'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Custom Wage
              </button>
            </div>

            {newWageType === 'FIXED' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fixed Daily Wage / Pay Rate (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="1"
                    placeholder="Enter Fixed Daily Wage (e.g. 500)"
                    value={newDailyWage}
                    onChange={(e) => setNewDailyWage(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Admin specifies the fixed amount payable per day.
                </p>
                <SalaryProjectionCard wageType="FIXED" dailyWage={newDailyWage} />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Wage Rate for 1 Machine per 1 Hour (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      required
                      placeholder="Enter wage for 1 machine 1 hour (e.g. 50)"
                      value={newCustomWageRate}
                      onChange={(e) => setNewCustomWageRate(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Wage rate for operating 1 machine for 1 hour. Total salary is calculated accordingly for week, month, and year.
                  </p>
                </div>

                <SalaryProjectionCard wageType="CUSTOM" customWageRate={newCustomWageRate} />

                <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newHasCustomAccess}
                      onChange={(e) => setNewHasCustomAccess(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                    />
                    <span className="text-xs font-bold text-amber-950">
                      Grant Custom Wage Access (Enable machine &amp; hour inputs on Worker Page)
                    </span>
                  </label>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Worker will log their operated machine count and total working hours directly on their worker page.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">User Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
              >
                <option value="WORKER">WORKER</option>
                <option value="SUPERVISOR">SUPERVISOR</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
              <select
                value={newDeptId}
                onChange={(e) => setNewDeptId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 flex items-center gap-2">
            <span className="text-sm">ℹ️</span>
            <span>
              <strong>Shift Assignment:</strong> Not required for Admin. Worker selects <strong>Day Shift (☀️)</strong> or <strong>Night Shift (🌙)</strong> directly when checking in.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Initial PIN / Password *</label>
            <input
              type="text"
              required
              placeholder="Set 4-digit PIN or password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono tracking-widest focus:ring-2 focus:ring-teal-500"
            />
            <span className="text-[10px] text-slate-400">Worker will use Worker ID and this PIN to log in on mobile.</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingWorker}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
            >
              {savingWorker ? 'Registering...' : 'Register Worker'}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT WORKER MODAL */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Worker Profile"
        subtitle={`Editing profile for ${editingWorker?.workerId}`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
            <input
              type="text"
              placeholder="Enter Phone Number"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Wage Type Selection */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">Wage Model</label>
              <span className="text-[10px] text-slate-400">Admin sets Fixed; Custom worker logs machines &amp; hours</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditWageType('FIXED')}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all text-center ${
                  editWageType === 'FIXED'
                    ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Fixed Wage
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditWageType('CUSTOM');
                  setEditHasCustomAccess(true);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all text-center ${
                  editWageType === 'CUSTOM'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Custom Wage
              </button>
            </div>

            {editWageType === 'FIXED' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fixed Daily Wage (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="1"
                    placeholder="Enter Fixed Daily Wage"
                    value={editDailyWage}
                    onChange={(e) => setEditDailyWage(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <SalaryProjectionCard wageType="FIXED" dailyWage={editDailyWage} />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Wage Rate for 1 Machine per 1 Hour (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      required
                      placeholder="Enter wage for 1 machine 1 hour (e.g. 50)"
                      value={editCustomWageRate}
                      onChange={(e) => setEditCustomWageRate(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Wage rate for operating 1 machine for 1 hour. Total salary is calculated accordingly for week, month, and year.
                  </p>
                </div>

                <SalaryProjectionCard wageType="CUSTOM" customWageRate={editCustomWageRate} />

                <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editHasCustomAccess}
                      onChange={(e) => setEditHasCustomAccess(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                    />
                    <span className="text-xs font-bold text-amber-950">
                      Grant Custom Wage Access (Enable machine &amp; hour inputs on Worker Page)
                    </span>
                  </label>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Worker logs their operated machine count and total working hours directly on their worker page.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
            <select
              value={editDeptId}
              onChange={(e) => setEditDeptId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Unassigned</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 flex items-center gap-2">
            <span className="text-sm">ℹ️</span>
            <span>
              <strong>Shift:</strong> Worker chooses Day Shift or Night Shift directly each day on their phone.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Change (Audit Log)</label>
            <input
              type="text"
              placeholder="e.g. Worker transferred from Loom #2 to Jacquard section"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingWorker}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
            >
              {savingWorker ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </Modal>

      {/* RESET PIN MODAL */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Reset Worker PIN / Password"
        subtitle={`Set new secure login credentials for ${targetWorker?.name} (${targetWorker?.workerId})`}
        maxWidth="sm"
      >
        <form onSubmit={handleSaveResetPin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">New 4-digit PIN or Password</label>
            <input
              type="text"
              required
              placeholder="e.g. 5678"
              value={resetPinValue}
              onChange={(e) => setResetPinValue(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono tracking-widest text-center text-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setResetModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors"
            >
              Reset Credentials
            </button>
          </div>
        </form>
      </Modal>

      {/* DEACTIVATE WORKER MODAL */}
      <Modal
        isOpen={deactivateModalOpen}
        onClose={() => setDeactivateModalOpen(false)}
        title="Deactivate Worker Profile"
        subtitle={`Deactivating ${targetWorker?.name} (${targetWorker?.workerId})`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveDeactivate} className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
            Deactivating this profile will immediately revoke their ability to check in or access the portal. Past attendance logs remain intact.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mandatory Deactivation Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              placeholder="e.g. Employment resignation, contract completion, or seasonal leave"
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setDeactivateModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors"
            >
              Confirm Deactivation
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
