import { apiFetch } from './apiClient';
import { Branch } from '../types';

export const branchService = {
  getAll: async (): Promise<Branch[]> => {
    return apiFetch<Branch[]>('/api/branches');
  },

  create: async (payload: any): Promise<Branch> => {
    return apiFetch<Branch>('/api/branches', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update: async (id: string, payload: any): Promise<Branch> => {
    return apiFetch<Branch>(`/api/branches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  delete: async (id: string): Promise<{ success: boolean; message?: string }> => {
    return apiFetch<{ success: boolean; message?: string }>(`/api/branches/${id}`, {
      method: 'DELETE',
    });
  },
};
