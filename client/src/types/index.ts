export type RoleType = 'SUPER_ADMIN' | 'ADMIN' | 'SUPERVISOR' | 'WORKER';

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
  customWageRate?: number | null;
  wageType?: 'FIXED' | 'CUSTOM';
  hasCustomWageAccess?: boolean;
  unit?: 'Unit 1' | 'Unit 2' | string;
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
  shiftType?: 'DAY' | 'NIGHT' | string | null;
  unit?: string;
  machinesOperated?: number | null;
  hoursOperated?: number | null;
  overtimeMachines?: number | null;
  overtimeHours?: number | null;
  overtimeStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | string | null;
  overtimeApprovedAt?: string | null;
  overtimeApprovedBy?: string | null;
  overtimeRejectionReason?: string | null;
  earnings?: ShiftEarnings | null;
}

export interface ShiftEarnings {
  totalEarned: number;
  baseEarned: number;
  overtimeEarned: number;
  wageType: 'FIXED' | 'CUSTOM' | string;
  customRate?: number;
  dailyWage?: number;
  machinesOperated: number;
  hoursOperated: number;
  overtimeMachines: number;
  overtimeHours: number;
  shiftType: string;
  status: string;
  formula?: string;
  overtimeStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | string | null;
  isOvertimeApproved?: boolean;
  overtimePendingAmount?: number;
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
    shiftType?: 'DAY' | 'NIGHT' | string | null;
    formattedCheckInTime: string;
    formattedCheckOutTime: string;
    status: AttendanceStatusType;
    workingMinutes: number;
    workingHours: number;
    breakMinutes: number;
    lateMinutes: number;
    machinesOperated?: number | null;
    hoursOperated?: number | null;
    overtimeMachines?: number | null;
    overtimeHours?: number | null;
    overtimeStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | string | null;
    overtimeApprovedAt?: string | null;
    overtimeApprovedBy?: string | null;
    overtimeRejectionReason?: string | null;
    earnings?: ShiftEarnings | null;
  };
  worker?: {
    wageType: 'FIXED' | 'CUSTOM';
    hasCustomWageAccess: boolean;
    dailyWage?: number | null;
    customWageRate?: number | null;
    unit?: string;
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
    totalWeeklyEarnings?: number;
    totalWeeklyBaseEarnings?: number;
    totalWeeklyApprovedOvertime?: number;
    totalWeeklyPendingOvertime?: number;
    completedShiftsCount?: number;
    hasOngoingShift?: boolean;
  };
  geofenceConfig?: {
    enabled: boolean;
    radiusMeters: number;
    unit1: {
      name: string;
      latitude: number;
      longitude: number;
    };
    unit2: {
      name: string;
      latitude: number;
      longitude: number;
    };
  } | null;
}

export interface DashboardWorkerItem {
  id: string;
  workerId: string;
  name: string;
  phone?: string | null;
  unit: string;
  department: string;
  shift: string;
  wageType: 'FIXED' | 'CUSTOM' | string;
  dailyWage?: number | null;
  customWageRate?: number | null;
  status: 'PRESENT' | 'ABSENT' | 'ON_FLOOR' | string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  lateMinutes?: number;
  workingMinutes?: number;
  machinesOperated?: number | null;
  hoursOperated?: number | null;
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
  workerLists?: {
    registered: DashboardWorkerItem[];
    present: DashboardWorkerItem[];
    absent: DashboardWorkerItem[];
    onFloor: DashboardWorkerItem[];
    late: DashboardWorkerItem[];
  };
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
      geofencingEnabled?: boolean;
      geofenceRadiusMeters?: number;
      unit1Name?: string;
      unit1Lat?: number;
      unit1Lng?: number;
      unit2Name?: string;
      unit2Lat?: number;
      unit2Lng?: number;
    };
  };
  shifts: Shift[];
}

export interface OvertimeRequestItem {
  id: string;
  userId: string;
  workerId: string;
  workerName: string;
  phone?: string | null;
  departmentName: string;
  unit: string;
  attendanceDate: string;
  shiftType: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  checkInTime: string;
  checkOutTime: string;
  workingMinutes: number;
  workingHours: number;
  machinesOperated?: number | null;
  hoursOperated?: number | null;
  overtimeMachines: number;
  overtimeHours: number;
  overtimeStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  overtimeApprovedAt?: string | null;
  overtimeApprovedBy?: string | null;
  overtimeRejectionReason?: string | null;
  estimatedOtPay: number;
  wageType: 'FIXED' | 'CUSTOM' | string;
  customWageRate?: number | null;
  dailyWage?: number | null;
  remarks?: string | null;
}

export interface OvertimeRequestsResponse {
  items: OvertimeRequestItem[];
  summary: {
    totalPendingCount: number;
    totalPendingAmount: number;
    totalApprovedCount: number;
    totalApprovedAmount: number;
    totalRejectedCount: number;
    totalCount: number;
  };
}
