import { AdvanceRecord, AllAdvancesResponse, WorkerAdvancesResponse } from '../types/index.ts';

const isAndroidApp =
  typeof window !== 'undefined' &&
  (window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:' ||
    window.navigator.userAgent.includes('SSF-Android-App') ||
    Boolean((window as any).AndroidBridge) ||
    (window.location.hostname === 'localhost' && !window.location.port));

const API_BASE =
  ((import.meta as any).env?.VITE_API_BASE as string) ||
  (isAndroidApp ? 'https://shree-swami-samarth-fabric.vercel.app/api' : '/api');

function getAuthToken(): string | null {
  return localStorage.getItem('ssf_auth_token');
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('ssf_auth_token', token);
  } else {
    localStorage.removeItem('ssf_auth_token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

// 1. Auth API
export const authApi = {
  login: (workerId: string, password: string) =>
    request<{ success: boolean; data: { token: string; user: any } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ workerId, password }),
    }),

  logout: () =>
    request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    }),

  getMe: () =>
    request<{ success: boolean; data: any }>('/auth/me'),
};

// 2. Attendance API
export const attendanceApi = {
  verifyLocation: (latitude?: number | null, longitude?: number | null) =>
    request<{ success: boolean; data: any }>('/attendance/verify-location', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude }),
    }),

  checkIn: (options?: {
    workerUserId?: string;
    shiftType?: 'DAY' | 'NIGHT' | string;
    latitude?: number | null;
    longitude?: number | null;
  } | string) => {
    let payload: Record<string, any> = {};
    if (typeof options === 'string') {
      payload.workerUserId = options;
    } else if (options) {
      payload = { ...options };
    }
    return request<{ success: boolean; message: string; data: any; worker: any }>('/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  checkOut: (options?: {
    workerUserId?: string;
    machinesOperated?: number;
    hoursOperated?: number;
    overtimeMachines?: number;
    overtimeHours?: number;
    latitude?: number | null;
    longitude?: number | null;
  } | string) => {
    let payload: Record<string, any> = {};
    if (typeof options === 'string') {
      payload.workerUserId = options;
    } else if (options) {
      payload = { ...options };
    }
    return request<{ success: boolean; message: string; data: any; workingHours: number; earnings?: any }>('/attendance/check-out', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  logCustomWageWork: (data: {
    machinesOperated?: number;
    hoursOperated?: number;
    overtimeMachines?: number;
    overtimeHours?: number;
    remarks?: string;
  }) =>
    request<{ success: boolean; message: string; data: any }>('/attendance/custom-wage-log', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logOvertimeWork: (data: {
    overtimeMachines?: number;
    overtimeHours?: number;
    remarks?: string;
  }) =>
    request<{ success: boolean; message: string; data: any }>('/attendance/overtime-log', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMyStatus: () =>
    request<{ success: boolean; data: any }>('/attendance/me'),

  getMyHistory: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return request<{ success: boolean; data: any[] }>(`/attendance/history?${params.toString()}`);
  },

  listRecords: (params: Record<string, any> = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') searchParams.append(k, String(v));
    });
    return request<{ success: boolean; data: any }>(`/attendance?${searchParams.toString()}`);
  },

  getLiveWorkers: (departmentId?: string) => {
    const url = departmentId ? `/attendance/live?departmentId=${departmentId}` : '/attendance/live';
    return request<{ success: boolean; data: any[]; count: number }>(url);
  },

  correctRecord: (recordId: string, updateData: any) =>
    request<{ success: boolean; message: string; data: any }>(`/attendance/${recordId}/correct`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    }),
};

// 2b. Overtime Approval API
export const overtimeApi = {
  list: (params: { status?: string; startDate?: string; endDate?: string } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.append('status', params.status);
    if (params.startDate) searchParams.append('startDate', params.startDate);
    if (params.endDate) searchParams.append('endDate', params.endDate);
    const qs = searchParams.toString();
    return request<{ success: boolean; data: any }>(`/attendance/overtime/list${qs ? `?${qs}` : ''}`);
  },

  approve: (id: string) =>
    request<{ success: boolean; message: string; data: any }>(`/attendance/overtime/${id}/approve`, {
      method: 'POST',
    }),

  reject: (id: string, reason?: string) =>
    request<{ success: boolean; message: string; data: any }>(`/attendance/overtime/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  bulkApprove: (recordIds: string[]) =>
    request<{ success: boolean; message: string; count: number }>('/attendance/overtime/bulk-approve', {
      method: 'POST',
      body: JSON.stringify({ recordIds }),
    }),
};

// 3. Workers API
export const workersApi = {
  list: (params: Record<string, any> = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') searchParams.append(k, String(v));
    });
    return request<{ success: boolean; data: any }>(`/workers?${searchParams.toString()}`);
  },

  getById: (id: string) =>
    request<{ success: boolean; data: any }>(`/workers/${id}`),

  create: (workerData: any) =>
    request<{ success: boolean; message: string; data: any }>('/workers', {
      method: 'POST',
      body: JSON.stringify(workerData),
    }),

  update: (id: string, updateData: any) =>
    request<{ success: boolean; message: string; data: any }>(`/workers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    }),

  deactivate: (id: string, reason: string) =>
    request<{ success: boolean; message: string; data: any }>(`/workers/${id}/deactivate`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),

  resetPin: (id: string, newPin: string) =>
    request<{ success: boolean; message: string }>(`/workers/${id}/reset-pin`, {
      method: 'POST',
      body: JSON.stringify({ newPin }),
    }),
};

// Universal File Downloader (Coordinates seamlessly between Web browsers and Native Android App)
export async function triggerFileDownload(blob: Blob, filename: string) {
  const bridge = typeof window !== 'undefined' ? (window as any).AndroidBridge : null;
  if (bridge && typeof bridge.downloadBase64File === 'function') {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = (reader.result as string) || '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      bridge.downloadBase64File(
        base64,
        filename,
        blob.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    };
    reader.readAsDataURL(blob);
    return;
  }

  // Standard web browser fallback
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1500);
}

// 4. Reports API
export const reportsApi = {
  getDashboard: (date?: string) => {
    const url = date ? `/reports/dashboard?date=${date}` : '/reports/dashboard';
    return request<{ success: boolean; data: any }>(url);
  },

  getWeekly: (refDate?: string, departmentId?: string) => {
    const params = new URLSearchParams();
    if (refDate) params.append('refDate', refDate);
    if (departmentId) params.append('departmentId', departmentId);
    return request<{ success: boolean; data: any }>(`/reports/weekly?${params.toString()}`);
  },

  downloadWeeklyExcel: async (refDate?: string, departmentId?: string) => {
    const token = getAuthToken();
    const params = new URLSearchParams();
    if (refDate) params.append('refDate', refDate);
    if (departmentId) params.append('departmentId', departmentId);

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/reports/weekly/export?${params.toString()}`, {
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Failed to generate Excel report');
    }

    const blob = await res.blob();
    await triggerFileDownload(blob, `SSF_Weekly_Attendance_${refDate || 'Current'}.xlsx`);
  },

  getMonthly: (refDate?: string, departmentId?: string) => {
    const params = new URLSearchParams();
    if (refDate) params.append('refDate', refDate);
    if (departmentId) params.append('departmentId', departmentId);
    return request<{ success: boolean; data: any }>(`/reports/monthly?${params.toString()}`);
  },

  downloadMonthlyExcel: async (refDate?: string, departmentId?: string) => {
    const token = getAuthToken();
    const params = new URLSearchParams();
    if (refDate) params.append('refDate', refDate);
    if (departmentId) params.append('departmentId', departmentId);

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/reports/monthly/export?${params.toString()}`, {
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Failed to generate monthly Excel report');
    }

    const blob = await res.blob();
    await triggerFileDownload(blob, `SSF_Monthly_Attendance_${refDate || 'Current'}.xlsx`);
  },

  getYearly: (year?: string | number, departmentId?: string) => {
    const params = new URLSearchParams();
    if (year) params.append('year', String(year));
    if (departmentId) params.append('departmentId', departmentId);
    return request<{ success: boolean; data: any }>(`/reports/yearly?${params.toString()}`);
  },

  downloadYearlyExcel: async (year?: string | number, departmentId?: string) => {
    const token = getAuthToken();
    const params = new URLSearchParams();
    if (year) params.append('year', String(year));
    if (departmentId) params.append('departmentId', departmentId);

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/reports/yearly/export?${params.toString()}`, {
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Failed to generate yearly Excel report');
    }

    const blob = await res.blob();
    await triggerFileDownload(blob, `SSF_Yearly_Attendance_${year || 'Current'}.xlsx`);
  },

  downloadSalaryExcel: async (refDate?: string, periodType: 'MONTHLY' | 'WEEKLY' = 'MONTHLY', departmentId?: string) => {
    const token = getAuthToken();
    const params = new URLSearchParams();
    if (refDate) params.append('refDate', refDate);
    if (periodType) params.append('periodType', periodType);
    if (departmentId) params.append('departmentId', departmentId);

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/reports/salary/export?${params.toString()}`, {
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Failed to generate salary calculation Excel report');
    }

    const blob = await res.blob();
    await triggerFileDownload(blob, `SSF_Salary_Calculation_${refDate || 'Current'}.xlsx`);
  },
};

// 5. Departments API
export const departmentsApi = {
  list: () =>
    request<{ success: boolean; data: any[] }>('/departments'),

  create: (data: { name: string; description?: string }) =>
    request<{ success: boolean; message: string; data: any }>('/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: any) =>
    request<{ success: boolean; message: string; data: any }>(`/departments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// 6. Settings API
export const settingsApi = {
  get: () =>
    request<{ success: boolean; data: any }>('/settings'),

  update: (data: any) =>
    request<{ success: boolean; message: string; data: any }>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  createShift: (data: any) =>
    request<{ success: boolean; message: string; data: any }>('/settings/shifts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateShift: (id: string, data: any) =>
    request<{ success: boolean; message: string; data: any }>(`/settings/shifts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteShift: (id: string) =>
    request<{ success: boolean; message: string }>(`/settings/shifts/${id}`, {
      method: 'DELETE',
    }),

  resetShifts: () =>
    request<{ success: boolean; message: string; count: number }>('/settings/shifts/reset', {
      method: 'POST',
    }),
};

// 7. Audit Logs API
export const auditApi = {
  list: (params: Record<string, any> = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') searchParams.append(k, String(v));
    });
    return request<{ success: boolean; data: any }>(`/audit-logs?${searchParams.toString()}`);
  },
};

// 8. Admins API (Super Admin Management)
export const adminsApi = {
  list: () =>
    request<{ success: boolean; data: any[] }>('/admins'),

  create: (data: { workerId: string; name: string; phone?: string; pin: string }) =>
    request<{ success: boolean; message: string; data: any }>('/admins', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  toggleStatus: (id: string, isActive: boolean) =>
    request<{ success: boolean; message: string; data: any }>(`/admins/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),

  resetPin: (id: string, newPin: string) =>
    request<{ success: boolean; message: string }>(`/admins/${id}/reset-pin`, {
      method: 'POST',
      body: JSON.stringify({ newPin }),
    }),

  delete: (id: string) =>
    request<{ success: boolean; message: string }>(`/admins/${id}`, {
      method: 'DELETE',
    }),
};

// 9. Advance (उचल) API
export const advanceApi = {
  // Worker: View personal advances & summary
  getMyAdvances: () =>
    request<{ success: boolean; data: WorkerAdvancesResponse }>('/advances/me'),

  // Worker: Request an advance
  requestAdvance: (amount: number, reason?: string) =>
    request<{ success: boolean; message: string; data: AdvanceRecord }>('/advances/request', {
      method: 'POST',
      body: JSON.stringify({ amount, reason }),
    }),

  // Admin / Supervisor: Query all advances with stats
  getAllAdvances: (params: Record<string, any> = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') searchParams.append(k, String(v));
    });
    return request<{ success: boolean; data: AllAdvancesResponse }>(`/advances?${searchParams.toString()}`);
  },

  // Admin: Give advance to worker
  createAdvance: (data: {
    userId: string;
    amount: number;
    advanceDate?: string;
    paymentMode?: string;
    reason?: string;
  }) =>
    request<{ success: boolean; message: string; data: AdvanceRecord }>('/advances', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Admin: Update advance status
  updateStatus: (id: string, status: string, rejectionReason?: string) =>
    request<{ success: boolean; message: string; data: AdvanceRecord }>(`/advances/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, rejectionReason }),
    }),

  // Admin / Supervisor: Record custom cutting/deduction from advance
  recordCustomDeduction: (
    advanceId: string,
    amount: number,
    cutDate?: string,
    notes?: string
  ) =>
    request<{
      success: boolean;
      message: string;
      data: { deduction: any; advance: AdvanceRecord };
    }>(`/advances/${advanceId}/deduct`, {
      method: 'POST',
      body: JSON.stringify({ amount, cutDate, notes }),
    }),

  // Admin: Delete / Revert an advance deduction
  deleteDeduction: (deductionId: string) =>
    request<{ success: boolean; message: string; data: AdvanceRecord }>(
      `/advances/deductions/${deductionId}`,
      { method: 'DELETE' }
    ),

  // Admin: Delete advance
  deleteAdvance: (id: string) =>
    request<{ success: boolean; message: string }>(`/advances/${id}`, {
      method: 'DELETE',
    }),
};

