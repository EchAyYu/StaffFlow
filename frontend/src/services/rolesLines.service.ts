import { apiFetch } from './apiClient';
import { BusinessRole, LineConfig, LineRequirement } from '../types';

export const rolesLinesService = {
  getRoles: async (branchId?: string): Promise<BusinessRole[]> => {
    const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    return apiFetch<BusinessRole[]>(`/api/roles${qs}`);
  },

  saveRole: async (payload: any): Promise<BusinessRole> => {
    return apiFetch<BusinessRole>('/api/roles', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateRole: async (id: string, payload: any): Promise<BusinessRole> => {
    return apiFetch<BusinessRole>(`/api/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  getLineConfigs: async (branchId?: string): Promise<LineConfig[]> => {
    const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    return apiFetch<LineConfig[]>(`/api/line-configs${qs}`);
  },

  updateLineConfig: async (payload: any): Promise<LineConfig> => {
    return apiFetch<LineConfig>('/api/line-configs', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  getLineRequirements: async (branchId?: string): Promise<LineRequirement[]> => {
    const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    return apiFetch<LineRequirement[]>(`/api/line-requirements${qs}`);
  },

  updateLineRequirement: async (payload: any): Promise<LineRequirement> => {
    return apiFetch<LineRequirement>('/api/line-requirements', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
};
