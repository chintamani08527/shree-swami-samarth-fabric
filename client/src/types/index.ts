export type RoleType = 'ADMIN' | 'SUPERVISOR' | 'WORKER';

export type AttendanceStatusType =
  | 'PRESENT'
  | 'LATE'
  | 'HALF_DAY'
  | 'ABSENT'
  | 'ON_LEAVE'
  | 'HOLIDAY'
  | 'NOT_MARKED';

export type AttendanceSourceType =
  | 'WEB_MOBILE'
  | 'WEB_DESKTOP'
  | 'MANUAL_CORRECTION'
  | 'ADMIN_OVERRIDE';

export interface User {
  id: string;
  workerId: string;
  name: string;
  phone?: string | null;
  role: RoleType;
  dailyWage?: number | null;
  wageType?: 'FIXED' | 'CUSTOM';
  hasCustomWageAccess?: boolean;
  isActive: boolean;
  department?: { id: string; name: string } | null;
  departmentId?: string | null;
  shift?: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    gracePeriodMinutes?: number;
    breakDurationMinutes?: number;
  } | null;
  joiningDate?: string;
  createdAt?: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  workerCount?: number;
}

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  gracePeriodMinutes: number;
  breakDurationMinutes: number;
  halfDayThresholdHours: number;
  fullDayThresholdHours: number;
  isActive: boolean;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  workerId: string;
  workerName: string;
  phone?: string | null;
  department: string;
  departmentId?: string | null;
  attendanceDate: string;
  formattedDate: string;
  dayOfWeek: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  checkInTime: string;
  checkOutTime: string;
  workingMinutes: number;
  workingHours: number;
  breakMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  status: AttendanceStatusType;
  source: AttendanceSourceType;
  isMissingCheckOut: boolean;
  remarks?: string | null;
  wageType?: 'FIXED' | 'CUSTOM';
  hasCustomWageAccess?: boolean;
  machinesOperated?: number | null;
  hoursOperated?: number | null;
}

export interface WorkerTodayStatus {
  today: {
    date: string;
    formattedDate: string;
    dayOfWeek: string;
    isCheckedIn: boolean;
    isCheckedOut: boolean;
    checkInAt?: string | null;
    checkOutAt?: string | null;
    formattedCheckInTime: string;
    formattedCheckOutTime: string;
    status: AttendanceStatusType;
    workingMinutes: number;
    workingHours: number;
    breakMinutes: number;
    lateMinutes: number;
    machinesOperated?: number | null;
    hoursOperated?: number | null;
  };
  worker?: {
    wageType: 'FIXED' | 'CUSTOM';
    hasCustomWageAccess: boolean;
    dailyWage?: number | null;
  };
  shift?: {
    name: string;
    startTime: string;
    endTime: string;
    gracePeriodMinutes: number;
  } | null;
  checkInWindow?: {
    shiftStart: string;
    shiftEnd: string;
    windowStart: string;
    windowEnd: string;
    bandMinutes: number;
    isOpen: boolean;
    isTooEarly: boolean;
    isClosed: boolean;
    status: 'OPEN' | 'TOO_EARLY' | 'CLOSED';
    message?: string;
  } | null;
  weeklySummary: {
    startDate: string;
    endDate: string;
    daysPresent: number;
    daysLate: number;
    totalHours: number;
  };
}

export interface DashboardKPIs {
  kpis: {
    totalRegisteredWorkers: number;
    presentToday: number;
    absentToday: number;
    currentlyCheckedIn: number;
    lateArrivals: number;
    totalWorkingHoursToday: number;
    attendancePercentage: number;
    targetDate: string;
    formattedTargetDate: string;
  };
  trend: {
    date: string;
    formattedDate: string;
    day: string;
    present: number;
    late: number;
    absent: number;
    hours: number;
  }[];
  departmentBreakdown: {
    id: string;
    name: string;
    totalWorkers: number;
    present: number;
    checkedInNow: number;
    absent: number;
    attendanceRate: number;
  }[];
}

export interface AuditLogItem {
  id: string;
  actorUserId?: string | null;
  actorName: string;
  actorRole: string;
  actorWorkerId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  reason: string;
  details?: any;
  createdAt: string;
}

export interface CompanySettingsData {
  settings: {
    id: string;
    companyName: string;
    timezone: string;
    defaultWorkingHours: number;
    rules: {
      checkInBandMinutes?: number;
      gracePeriodMinutes: number;
      breakDurationMinutes: number;
      autoDeductBreakThresholdMinutes: number;
      halfDayThresholdHours: number;
      fullDayThresholdHours: number;
      overtimeThresholdHours: number;
      dailyCutoffTime: string;
    };
  };
  shifts: Shift[];
}
