import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserPlus,
  KeyRound,
  Trash2,
  CheckCircle2,
  XCircle,
  Phone,
  Calendar,
  Lock,
  RefreshCw,
  Crown,
  ShieldAlert,
  Search,
} from 'lucide-react';
import { adminsApi } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';

interface AdminUser {
  id: string;
  workerId: string;
  name: string;
  phone?: string | null;
  role: 'SUPER_ADMIN' | 'ADMIN';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const AdminManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isResetPinModalOpen, setIsResetPinModalOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);

  // Form States
  const [formData, setFormData] = useState({
    workerId: '',
    name: '',
    phone: '',
    pin: '',
  });
  const [newPin, setNewPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAdmins = async () => {
    try {
      setLoading(true);
      const res = await adminsApi.list();
      if (res.success) {
        setAdmins(res.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load administrators', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.workerId.trim() || !formData.name.trim() || !formData.pin.trim()) {
      showToast('Please fill in Admin ID, Name, and Password', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await adminsApi.create(formData);
      if (res.success) {
        showToast(res.message || 'Admin account created successfully!', 'success');
        setIsAddModalOpen(false);
        setFormData({ workerId: '', name: '', phone: '', pin: '' });
        await loadAdmins();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create admin', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (admin: AdminUser) => {
    if (admin.role === 'SUPER_ADMIN' || admin.workerId === 'VINAYAK4501') {
      showToast('Super Admin Vinayak Ginde cannot be deactivated.', 'error');
      return;
    }

    try {
      const res = await adminsApi.toggleStatus(admin.id, !admin.isActive);
      if (res.success) {
        showToast(res.message, 'success');
        await loadAdmins();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update admin status', 'error');
    }
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin || !newPin.trim()) return;

    try {
      setSubmitting(true);
      const res = await adminsApi.resetPin(selectedAdmin.id, newPin.trim());
      if (res.success) {
        showToast(res.message, 'success');
        setIsResetPinModalOpen(false);
        setNewPin('');
        setSelectedAdmin(null);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to reset password', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAdmin = async (admin: AdminUser) => {
    if (admin.role === 'SUPER_ADMIN' || admin.workerId === 'VINAYAK4501') {
      showToast('Super Admin Vinayak Ginde cannot be removed.', 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to remove administrator ${admin.name} (${admin.workerId})?`)) {
      return;
    }

    try {
      const res = await adminsApi.delete(admin.id);
      if (res.success) {
        showToast(res.message, 'success');
        await loadAdmins();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to remove admin', 'error');
    }
  };

  const filteredAdmins = admins.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.workerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.phone && a.phone.includes(searchQuery))
  );

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.workerId === 'VINAYAK4501';

  return (
    <div className="space-y-6">
      {/* Top Banner / Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-navy-950 tracking-tight">
              Administrator Management
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Super Admin Portal: Manage administrators, access privileges, and authorized personnel
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAdmins}
            disabled={loading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors disabled:opacity-50"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-700 to-navy-900 hover:from-teal-800 hover:to-navy-950 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-navy-900/10 transition-all tap-active"
            >
              <UserPlus className="w-4 h-4 text-teal-300" />
              <span>Register New Admin</span>
            </button>
          )}
        </div>
      </div>

      {/* Super Admin Ownership Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-navy-950 via-slate-900 to-teal-950 text-white border border-slate-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-navy-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20">
            <Crown className="w-6 h-6 text-navy-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base sm:text-lg">Vinayak Ginde</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-400 text-navy-950 shadow-xs">
                Super Admin / Factory Owner
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Worker ID: <span className="font-mono font-bold text-amber-300">VINAYAK4501</span> • Master Authority with Full System &amp; Admin Rights
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
            <span className="text-slate-400">Total Admins:</span>{' '}
            <span className="font-bold text-white ml-1">{admins.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-bold">
            {admins.filter((a) => a.isActive).length} Active
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search administrators by name, ID, or phone..."
          className="w-full text-xs sm:text-sm bg-transparent outline-none placeholder:text-slate-400 text-slate-800"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded"
          >
            Clear
          </button>
        )}
      </div>

      {/* Admins Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Admin ID</th>
                <th className="py-3.5 px-4">Name</th>
                <th className="py-3.5 px-4">Role &amp; Privilege</th>
                <th className="py-3.5 px-4">Phone Number</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Registered Date</th>
                {isSuperAdmin && <th className="py-3.5 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No administrators found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredAdmins.map((admin) => {
                  const isCurrentSuper = admin.role === 'SUPER_ADMIN' || admin.workerId === 'VINAYAK4501';

                  return (
                    <tr key={admin.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Admin ID */}
                      <td className="py-3.5 px-4 font-mono font-black text-navy-950">
                        <span className={`px-2 py-0.5 rounded border text-xs ${
                          isCurrentSuper ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-slate-100 text-slate-800 border-slate-200'
                        }`}>
                          {admin.workerId}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <span>{admin.name}</span>
                          {isCurrentSuper && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        {isCurrentSuper ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-gradient-to-r from-amber-500 to-amber-400 text-navy-950 shadow-xs">
                            <Crown className="w-3 h-3 text-navy-950" />
                            SUPER ADMIN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-navy-100 text-navy-900 border border-navy-200">
                            <ShieldCheck className="w-3 h-3 text-teal-700" />
                            ADMIN
                          </span>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                        {admin.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{admin.phone}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">Not provided</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        {admin.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-center text-slate-500 text-xs">
                        <span className="flex items-center justify-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{new Date(admin.createdAt).toLocaleDateString('en-IN')}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      {isSuperAdmin && (
                        <td className="py-3.5 px-4 text-right">
                          {isCurrentSuper ? (
                            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200/60">
                              Primary Owner
                            </span>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Toggle Status */}
                              <button
                                onClick={() => handleToggleStatus(admin)}
                                className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors ${
                                  admin.isActive
                                    ? 'border-slate-200 text-slate-600 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200'
                                    : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                }`}
                                title={admin.isActive ? 'Deactivate Admin' : 'Activate Admin'}
                              >
                                {admin.isActive ? 'Deactivate' : 'Activate'}
                              </button>

                              {/* Reset PIN */}
                              <button
                                onClick={() => {
                                  setSelectedAdmin(admin);
                                  setIsResetPinModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-600 hover:text-navy-950 hover:bg-slate-100 border border-slate-200 transition-colors"
                                title="Reset Admin Password"
                              >
                                <KeyRound className="w-3.5 h-3.5 text-teal-700" />
                              </button>

                              {/* Delete Admin */}
                              <button
                                onClick={() => handleDeleteAdmin(admin)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                                title="Delete Admin"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: REGISTER NEW ADMIN */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-50 rounded-xl text-teal-700 border border-teal-100">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-navy-950 text-base">Register New Admin</h3>
                  <p className="text-xs text-slate-400">Granted by Super Admin Vinayak Ginde</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Admin ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.workerId}
                  onChange={(e) => setFormData({ ...formData, workerId: e.target.value.toUpperCase() })}
                  placeholder="e.g. ADM-01 or ADM4502"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-[11px] text-slate-400 mt-0.5">Unique identifier used for signing in.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Ramesh Patil"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phone Number (Optional)
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. +91 98220 12345"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password / PIN <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={formData.pin}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                  placeholder="Enter login password (min 4 characters)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs sm:text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-navy-950 hover:bg-slate-900 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET ADMIN PIN */}
      {isResetPinModalOpen && selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-50 rounded-xl text-teal-700 border border-teal-100">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-navy-950 text-base">Reset Admin Password</h3>
                  <p className="text-xs text-slate-400">For {selectedAdmin.name} ({selectedAdmin.workerId})</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsResetPinModalOpen(false);
                  setSelectedAdmin(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Password / PIN <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="Enter new password (min 4 characters)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetPinModalOpen(false);
                    setSelectedAdmin(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs sm:text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-navy-950 hover:bg-slate-900 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
