import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  light?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showSubtitle = true, light = false }) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  };

  const titleSizes = {
    sm: 'text-sm font-bold',
    md: 'text-base sm:text-lg font-bold tracking-tight',
    lg: 'text-xl sm:text-2xl font-extrabold tracking-tight',
  };

  return (
    <div className="flex items-center gap-3">
      {/* Textile Weave / Loom Shuttle Icon */}
      <div
        className={`${iconSizes[size]} rounded-xl flex items-center justify-center shrink-0 shadow-md ${
          light
            ? 'bg-white text-navy-900 ring-2 ring-white/20'
            : 'bg-gradient-to-br from-navy-900 via-navy-800 to-teal-800 text-white shadow-navy-900/20'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-3/5 h-3/5"
        >
          {/* Weaving warp and weft textile pattern */}
          <path d="M3 6h18" />
          <path d="M3 12h18" />
          <path d="M3 18h18" />
          <path d="M6 3v18" />
          <path d="M12 3v18" />
          <path d="M18 3v18" />
        </svg>
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
            className={`text-[10px] sm:text-xs font-medium tracking-wide mt-1 uppercase ${
              light ? 'text-teal-200' : 'text-teal-700'
            }`}
          >
            Smart Attendance Management
          </span>
        )}
      </div>
    </div>
  );
};
