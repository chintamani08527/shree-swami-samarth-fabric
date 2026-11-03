import React from 'react';
import { Menu, LogOut, User as UserIcon, Shield } from 'lucide-react';
import { Logo } from '../common/Logo.tsx';
import { LiveClock } from '../common/LiveClock.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

interface NavbarProps {
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, showSidebarToggle = false }) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            {showSidebarToggle && (
              <button
                onClick={onToggleSidebar}
                className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-navy-900 hover:bg-slate-100 transition-colors"
                aria-label="Toggle Navigation Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <Logo size="sm" showSubtitle={false} />
          </div>

          <div className="hidden md:flex items-center">
            <LiveClock showDate={true} />
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 sm:border-l border-slate-200">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs sm:text-sm font-bold text-navy-950 leading-tight">
                    {user.name}
                  </span>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded-md border border-teal-200/60">
                      {user.role === 'SUPER_ADMIN' ? 'Super Admin' : user.role === 'ADMIN' ? 'Admin' : user.role}
                    </span>
                    <span className="text-[10px] text-slate-600 font-mono">
                      {user.workerId}
                    </span>
                  </div>
                </div>

                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-navy-900 to-navy-800 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  {user.name.charAt(0)}
                </div>

                <button
                  onClick={logout}
                  title="Secure Logout"
                  className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
