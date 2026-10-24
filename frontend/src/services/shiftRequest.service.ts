import { apiFetch } from './apiClient';
import { ShiftRequest } from '../types';

export const shiftRequestService = {
  getAll: async (branchId?: string): Promise<ShiftRequest[]> => {
    const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    return apiFetch<ShiftRequest[]>(`/api/shift-requests${qs}`);
  },

  create: async (payload: any): Promise<ShiftRequest> => {
    return apiFetch<ShiftRequest>('/api/shift-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update: async (id: string, payload: any): Promise<ShiftRequest> => {
    return apiFetch<ShiftRequest>(`/api/shift-requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  approve: async (id: string, reviewerId?: string, reviewNote?: string): Promise<ShiftRequest> => {
    return apiFetch<ShiftRequest>(`/api/shift-requests/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ reviewerId, reviewNote }),
    });
  },

  reject: async (id: string, reviewerId?: string, reviewNote?: string): Promise<ShiftRequest> => {
    return apiFetch<ShiftRequest>(`/api/shift-requests/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reviewerId, reviewNote }),
    });
  },
};
