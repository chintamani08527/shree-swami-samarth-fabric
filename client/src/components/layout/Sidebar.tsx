import React from 'react';
import {
  LayoutDashboard,
  CheckCircle,
  Users,
  FileSpreadsheet,
  Building2,
  ScrollText,
  Sliders,
  LogOut,
  X,
} from 'lucide-react';
import { Logo } from '../common/Logo.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpen,
  onClose,
}) => {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'attendance', label: 'Attendance Monitoring', icon: CheckCircle },
    { id: 'workers', label: 'Workers', icon: Users },
    { id: 'reports', label: 'Reports & Excel Export', icon: FileSpreadsheet },
    ...(isAdmin ? [{ id: 'departments', label: 'Departments', icon: Building2 }] : []),
    ...(isAdmin ? [{ id: 'audit', label: 'Audit Logs', icon: ScrollText }] : []),
    ...(isAdmin ? [{ id: 'settings', label: 'Settings', icon: Sliders }] : []),
  ];

  const handleTabClick = (id: string) => {
    onSelectTab(id);
    onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-navy-950 text-white flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between p-5 border-b border-navy-900">
          <Logo size="sm" light={true} />
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-teal-700 text-white shadow-md shadow-teal-900/30'
                    : 'text-slate-300 hover:text-white hover:bg-navy-900/80'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Card & Logout Footer */}
        <div className="p-4 border-t border-navy-900 bg-navy-950/60">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-sm">
              {user?.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{user?.name}</p>
              <p className="text-[11px] text-teal-400 font-mono truncate">
                {user?.workerId} • {user?.role === 'ADMIN' ? 'Owner' : user?.role}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 hover:text-rose-200 border border-rose-900/40 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
