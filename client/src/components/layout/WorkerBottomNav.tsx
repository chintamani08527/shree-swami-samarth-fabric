import React from 'react';
import { Clock, CalendarCheck, User as UserIcon } from 'lucide-react';

interface WorkerBottomNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const WorkerBottomNav: React.FC<WorkerBottomNavProps> = ({ currentTab, onSelectTab }) => {
  const tabs = [
    { id: 'home', label: 'Check In', icon: Clock },
    { id: 'history', label: 'My Attendance', icon: CalendarCheck },
    { id: 'profile', label: 'My Profile', icon: UserIcon },
  ];

  return (
    <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-2 py-1.5 sm:hidden">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center py-1.5 px-4 rounded-xl transition-all tap-active ${
                isActive
                  ? 'text-teal-700 font-bold'
                  : 'text-slate-500 hover:text-slate-700 font-medium'
              }`}
            >
              <div
                className={`p-1 rounded-lg transition-colors ${
                  isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-500'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] mt-0.5 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
