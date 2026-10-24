import { apiFetch } from './apiClient';

export const availabilityService = {
  getAvailability: async (params?: { branchId?: string; weekStartDate?: string }): Promise<any[]> => {
    const query = new URLSearchParams();
    if (params?.branchId) query.append('branchId', params.branchId);
    if (params?.weekStartDate) query.append('weekStartDate', params.weekStartDate);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiFetch<any[]>(`/api/availability${qs}`);
  },

  saveAvailability: async (payload: {
    userId: string;
    branchId?: string;
    weekStartDate: string;
    slots: Record<string, string>;
    dayCustomHours?: Partial<Record<string, string>>;
    note?: string;
  }): Promise<{ success: boolean; message?: string }> => {
    return apiFetch<{ success: boolean; message?: string }>('/api/availability', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
