import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  light?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showSubtitle = true, light = false }) => {
  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  };

  const titleSizes = {
    sm: 'text-sm font-bold',
    md: 'text-base sm:text-lg font-bold tracking-tight',
    lg: 'text-xl sm:text-2xl font-extrabold tracking-tight',
  };

  return (
    <div className="flex items-center gap-3">
      {/* SSF Monogram Emblem Badge */}
      <div
        className={`${iconSizes[size]} rounded-xl flex items-center justify-center shrink-0 shadow-md ${
          light
            ? 'bg-slate-900 border border-amber-400/40 shadow-amber-500/10'
            : 'bg-slate-950 border border-amber-500/30 shadow-slate-900/40'
        } relative overflow-hidden`}
      >
        {/* Subtle internal gold gradient border */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-transparent to-teal-500/20 pointer-events-none" />
        
        <div className="flex flex-col items-center justify-center leading-none">
          <span className="font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 font-mono text-[11px] sm:text-[13px]">
            SSF
          </span>
          <span className="text-[6px] tracking-widest text-teal-400 font-bold uppercase mt-[-1px]">
            FABRIC
          </span>
        </div>
      </div>

      <div className="flex flex-col">
        <span
          className={`${titleSizes[size]} leading-none ${
            light ? 'text-white' : 'text-slate-900 font-extrabold'
          }`}
        >
          Shree Swami Samarth Fabric
        </span>
        {showSubtitle && (
          <span
            className={`text-[10px] sm:text-xs font-semibold tracking-wide mt-1 uppercase ${
              light ? 'text-teal-300' : 'text-teal-700'
            }`}
          >
            Smart Attendance Management
          </span>
        )}
      </div>
    </div>
  );
};
