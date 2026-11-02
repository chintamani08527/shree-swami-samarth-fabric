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
  const [newDailyWage, setNewDailyWage] = useState<string>('');
  const [newPin, setNewPin] = useState('1234');
  const [savingWorker, setSavingWorker] = useState(false);

  // Edit Worker Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDeptId, setEditDeptId] = useState('');
  const [editShiftId, setEditShiftId] = useState('');
  const [editDailyWage, setEditDailyWage] = useState<string>('');
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
        shiftId: newShiftId || undefined,
        dailyWage: newDailyWage ? parseFloat(newDailyWage) : undefined,
        passwordOrPin: newPin,
      });

      if (res.success) {
        showToast(res.message, 'success');
        setAddModalOpen(false);
        // Reset form
        setNewWorkerId('');
        setNewName('');
        setNewPhone('');
        setNewDailyWage('');
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
    setEditDailyWage(worker.dailyWage ? String(worker.dailyWage) : '');
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
        shiftId: editShiftId || undefined,
        dailyWage: editDailyWage ? parseFloat(editDailyWage) : null,
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
                <th className="py-3 px-4 text-right">Daily Wage</th>
                <th className="py-3 px-4">Assigned Shift</th>
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
                    <td className="py-3 px-4 text-right font-mono font-bold text-navy-950">
                      {w.dailyWage ? `₹${w.dailyWage}` : '--'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      {w.shift ? (
                        <span>
                          {w.shift.name.split('(')[0].trim()}{' '}
                          <span className="text-slate-400">({w.shift.startTime}-{w.shift.endTime})</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Not Assigned</span>
                      )}
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

          <div className="grid grid-cols-2 gap-3">
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

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Daily Wage / Pay Rate (₹)</label>
              <input
                type="number"
                step="1"
                placeholder="Enter Daily Wage (₹)"
                value={newDailyWage}
                onChange={(e) => setNewDailyWage(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
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

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Shift</label>
              <select
                value={newShiftId}
                onChange={(e) => setNewShiftId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Default General Shift</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
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

          <div className="grid grid-cols-2 gap-3">
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

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Daily Wage (₹)</label>
              <input
                type="number"
                step="1"
                placeholder="Enter Daily Wage"
                value={editDailyWage}
                onChange={(e) => setEditDailyWage(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-teal-500"
              />
            </div>
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

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Shift</label>
            <select
              value={editShiftId}
              onChange={(e) => setEditShiftId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Keep Existing Shift</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
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
