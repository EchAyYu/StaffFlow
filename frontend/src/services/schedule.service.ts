import { apiFetch } from './apiClient';
import { WeeklySchedule } from '../types';

export const scheduleService = {
  getSchedule: async (branchId?: string, weekStartDate?: string): Promise<WeeklySchedule | null> => {
    const query = new URLSearchParams();
    if (branchId) query.append('branchId', branchId);
    if (weekStartDate) query.append('weekStartDate', weekStartDate);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiFetch<WeeklySchedule | null>(`/api/schedules${qs}`);
  },

  saveSchedule: async (schedule: WeeklySchedule): Promise<{ success: boolean; scheduleId: string; message?: string }> => {
    return apiFetch<{ success: boolean; scheduleId: string; message?: string }>('/api/schedules', {
      method: 'POST',
      body: JSON.stringify(schedule),
    });
  },

  publishSchedule: async (
    id: string,
    payload: { publishedBy?: string; branchId?: string; status?: string; publishedAt?: string }
  ): Promise<any> => {
    return apiFetch<any>(`/api/schedules/${id}/publish`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
};
