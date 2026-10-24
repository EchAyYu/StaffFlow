import { apiFetch } from './apiClient';
import { Employee } from '../types';

export const userService = {
  getAll: async (params?: { branchId?: string; roleType?: string }): Promise<Employee[]> => {
    const query = new URLSearchParams();
    if (params?.branchId) query.append('branchId', params.branchId);
    if (params?.roleType) query.append('roleType', params.roleType);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiFetch<Employee[]>(`/api/users${qs}`);
  },

  create: async (payload: any): Promise<Employee> => {
    return apiFetch<Employee>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update: async (id: string, payload: any): Promise<Employee> => {
    return apiFetch<Employee>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  delete: async (id: string): Promise<{ success: boolean; message?: string }> => {
    return apiFetch<{ success: boolean; message?: string }>(`/api/users/${id}`, {
      method: 'DELETE',
    });
  },
};
