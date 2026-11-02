import React from 'react';
import { AttendanceStatusType } from '../../types/index.ts';

interface StatusBadgeProps {
  status: AttendanceStatusType | string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 font-semibold',
    md: 'text-xs px-2.5 py-1 font-semibold',
    lg: 'text-sm px-3.5 py-1.5 font-bold',
  };

  const getStyle = () => {
    switch (status) {
      case 'PRESENT':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
      case 'LATE':
        return 'bg-amber-50 text-amber-700 border-amber-200/80';
      case 'HALF_DAY':
        return 'bg-orange-50 text-orange-700 border-orange-200/80';
      case 'ABSENT':
        return 'bg-rose-50 text-rose-700 border-rose-200/80';
      case 'ON_LEAVE':
        return 'bg-blue-50 text-blue-700 border-blue-200/80';
      case 'HOLIDAY':
        return 'bg-purple-50 text-purple-700 border-purple-200/80';
      case 'NOT_MARKED':
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'PRESENT':
        return 'Present';
      case 'LATE':
        return 'Late Arrival';
      case 'HALF_DAY':
        return 'Half Day';
      case 'ABSENT':
        return 'Absent';
      case 'ON_LEAVE':
        return 'On Leave';
      case 'HOLIDAY':
        return 'Holiday';
      case 'NOT_MARKED':
        return 'Not Marked';
      default:
        return status;
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border shadow-xs tracking-wide ${sizeClasses[size]} ${getStyle()}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === 'PRESENT'
            ? 'bg-emerald-500'
            : status === 'LATE'
            ? 'bg-amber-500'
            : status === 'HALF_DAY'
            ? 'bg-orange-500'
            : status === 'ABSENT'
            ? 'bg-rose-500'
            : 'bg-slate-400'
        }`}
      />
      {getLabel()}
    </span>
  );
};
