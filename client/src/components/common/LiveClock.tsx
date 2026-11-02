import React, { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';

interface LiveClockProps {
  showDate?: boolean;
  className?: string;
}

export const LiveClock: React.FC<LiveClockProps> = ({ showDate = true, className = '' }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format in Asia/Kolkata timezone
  const timeString = time.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const dateString = time.toLocaleDateString('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className={`flex flex-col sm:flex-row items-center gap-2 sm:gap-4 ${className}`}>
      {showDate && (
        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 bg-white/80 border border-slate-200/80 px-3 py-1.5 rounded-lg shadow-sm">
          <Calendar className="w-4 h-4 text-teal-600" />
          <span>{dateString}</span>
        </div>
      )}
      <div className="flex items-center gap-1.5 text-sm sm:text-base font-bold text-navy-950 bg-white border border-slate-200 px-3.5 py-1.5 rounded-lg shadow-sm font-mono tracking-tight">
        <Clock className="w-4 h-4 text-teal-600 animate-pulse" />
        <span>{timeString}</span>
        <span className="text-[10px] uppercase font-sans tracking-wide text-slate-600 font-semibold ml-1">
          IST
        </span>
      </div>
    </div>
  );
};
