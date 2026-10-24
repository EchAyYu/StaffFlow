import { apiFetch } from './apiClient';

export interface LoginResponse {
  success: boolean;
  user: any;
  branch: any;
  message?: string;
  error?: string;
}

export const authService = {
  login: async (identifier: string, password: string): Promise<LoginResponse> => {
    return apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
  },
};
