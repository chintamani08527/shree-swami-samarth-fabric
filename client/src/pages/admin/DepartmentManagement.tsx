import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Users, CheckCircle2, RefreshCw } from 'lucide-react';
import { departmentsApi } from '../../services/api.ts';
import { Department } from '../../types/index.ts';
import { Modal } from '../../components/common/Modal.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

export const DepartmentManagement: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.workerId === 'VINAYAK4501';

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Department Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit Department Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const res = await departmentsApi.list();
      if (res.success) setDepartments(res.data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load departments', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await departmentsApi.create({
        name: deptName.trim(),
        description: deptDesc.trim() || undefined,
      });
      if (res.success) {
        showToast(res.message, 'success');
        setAddModalOpen(false);
        setDeptName('');
        setDeptDesc('');
        await loadDepartments();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create department', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (dept: Department) => {
    setEditingDept(dept);
    setEditName(dept.name);
    setEditDesc(dept.description || '');
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    try {
      setSaving(true);
      const res = await departmentsApi.update(editingDept.id, {
        name: editName.trim(),
        description: editDesc.trim() || null,
      });
      if (res.success) {
        showToast(res.message, 'success');
        setEditModalOpen(false);
        await loadDepartments();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update department', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-navy-950 tracking-tight">
            Manufacturing Departments
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage textile plant production divisions & assign factory staff
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-navy-900 to-teal-800 hover:from-navy-800 hover:to-teal-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-navy-900/10 transition-all tap-active"
          >
            <Plus className="w-4 h-4" />
            <span>Create Department</span>
          </button>
        )}
      </div>

      {/* DEPARTMENTS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((dept) => (
          <div
            key={dept.id}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleOpenEdit(dept)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-navy-950 hover:bg-slate-100 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <h3 className="text-base font-bold text-navy-950">{dept.name}</h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                {dept.description || 'Core textile manufacturing operations division.'}
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Active Workers:</span>
              </span>
              <span className="font-bold text-navy-950 font-mono text-sm bg-slate-50 px-2.5 py-0.5 rounded-lg border border-slate-200">
                {dept.workerCount ?? 0}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* CREATE DEPARTMENT MODAL */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Manufacturing Department"
        subtitle="e.g. Weaving, Jacquard, Carding, Sizing"
        maxWidth="md"
      >
        <form onSubmit={handleCreateDept} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Department Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Sizing & Warping"
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Description / Operations Summary</label>
            <textarea
              rows={3}
              placeholder="Describe machine operations, loom types, or responsibilities..."
              value={deptDesc}
              onChange={(e) => setDeptDesc(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
            />
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
              disabled={saving}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Department'}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT DEPARTMENT MODAL */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Department"
        subtitle={`Editing ${editingDept?.name}`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Department Name</label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
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
              disabled={saving}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
