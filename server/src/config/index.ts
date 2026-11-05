import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  jwtSecret: process.env.JWT_SECRET || 'shree-swami-samarth-fabric-jwt-secret-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  companyName: process.env.COMPANY_NAME || 'Shree Swami Samarth Fabric',
  companyTimezone: process.env.COMPANY_TIMEZONE || 'Asia/Kolkata',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};

export const Roles = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  WORKER: 'WORKER',
} as const;

export type RoleType = typeof Roles[keyof typeof Roles];

export const AttendanceStatuses = {
  PRESENT: 'PRESENT',
  LATE: 'LATE',
  HALF_DAY: 'HALF_DAY',
  ABSENT: 'ABSENT',
  ON_LEAVE: 'ON_LEAVE',
  HOLIDAY: 'HOLIDAY',
} as const;

export type AttendanceStatusType = typeof AttendanceStatuses[keyof typeof AttendanceStatuses];

export const AttendanceSources = {
  WEB_MOBILE: 'WEB_MOBILE',
  WEB_DESKTOP: 'WEB_DESKTOP',
  MANUAL_CORRECTION: 'MANUAL_CORRECTION',
  ADMIN_OVERRIDE: 'ADMIN_OVERRIDE',
} as const;

export type AttendanceSourceType = typeof AttendanceSources[keyof typeof AttendanceSources];

export const DEFAULT_ATTENDANCE_RULES = {
  checkInBandMinutes: 30, // 30 minutes band time: workers can check in within 30 min before or after shift start
  gracePeriodMinutes: 15,
  breakDurationMinutes: 60,
  autoDeductBreakThresholdMinutes: 300, // 5 hours minimum for break deduction
  halfDayThresholdHours: 4.0,
  fullDayThresholdHours: 8.0,
  overtimeThresholdHours: 8.5,
  dailyCutoffTime: '23:59', // cutoff for marking missing checkout
  // Factory Geofencing configuration (Unit 1 & Unit 2)
  geofencingEnabled: true,
  geofenceRadiusMeters: 100, // 100 meter boundary around factory units
  unit1Name: 'Unit 1',
  unit1Lat: 16.432500, // 16°25'57.0"N
  unit1Lng: 74.384222, // 74°23'03.2"E
  unit2Name: 'Unit 2',
  unit2Lat: 16.344861, // 16°20'41.5"N
  unit2Lng: 74.441361, // 74°26'28.9"E
};
