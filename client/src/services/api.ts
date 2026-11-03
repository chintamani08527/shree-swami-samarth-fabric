const isAndroidApp =
  typeof window !== 'undefined' &&
  (window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:' ||
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
  checkIn: (options?: { workerUserId?: string; shiftType?: 'DAY' | 'NIGHT' | string } | string) => {
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
  } | string) => {
    let payload: Record<string, any> = {};
    if (typeof options === 'string') {
      payload.workerUserId = options;
    } else if (options) {
      payload = { ...options };
    }
    return request<{ success: boolean; message: string; data: any; workingHours: number }>('/attendance/check-out', {
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
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `SSF_Weekly_Attendance_${refDate || 'Current'}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
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
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `SSF_Monthly_Attendance_${refDate || 'Current'}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
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
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `SSF_Yearly_Attendance_${year || 'Current'}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
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
