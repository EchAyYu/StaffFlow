import { apiFetch } from './apiClient';

export const systemService = {
  getInitialState: async (): Promise<any> => {
    return apiFetch<any>('/api/initial-state');
  },

  resetData: async (): Promise<{ success: boolean; message?: string }> => {
    return apiFetch<{ success: boolean; message?: string }>('/api/reset-data', {
      method: 'POST',
    });
  },

  getHealth: async (): Promise<any> => {
    return apiFetch<any>('/api/health');
  },

  savePayrollOt: async (payload: {
    userId: string;
    branchId?: string;
    otHours: number;
    completedHours?: number;
    projectedHours?: number;
    basePay?: number;
    weekStartDate?: string;
  }): Promise<any> => {
    return apiFetch<any>('/api/payroll-ot', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getAuditLogs: async (params?: { branchId?: string; limit?: number }): Promise<any[]> => {
    const query = new URLSearchParams();
    if (params?.branchId) query.append('branchId', params.branchId);
    if (params?.limit) query.append('limit', String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiFetch<any[]>(`/api/audit-logs${qs}`);
  },
};
