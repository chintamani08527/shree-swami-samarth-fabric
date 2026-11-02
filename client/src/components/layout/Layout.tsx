import React, { useState } from 'react';
import { Navbar } from './Navbar.tsx';
import { Sidebar } from './Sidebar.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

interface LayoutProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentTab, onSelectTab, children }) => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative overflow-hidden">
      {/* Shree Swami Samarth Background - perfectly fitted inside viewable frame */}
      <div
        className="fixed inset-y-0 right-0 left-0 lg:left-64 pointer-events-none z-0 flex items-center justify-center p-4 sm:p-8 select-none"
        aria-hidden="true"
      >
        <img
          src="/swami-samarth-bg.jpg"
          alt="Shree Swami Samarth"
          className="max-h-[85vh] max-w-[85vw] lg:max-w-[70vw] object-contain object-center opacity-[0.16] filter contrast-105"
        />
      </div>

      <div className="flex-1 flex relative z-10">
        {/* Desktop & Mobile Responsive Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={onSelectTab}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar
            showSidebarToggle={true}
            onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};
