import { create } from 'zustand';
import { api } from './api';

interface AuthUser {
  id: string; email: string; name: string; role: string;
  totalTokensUsed: number; totalCost: number;
  preferences: { defaultModel?: string; defaultProvider?: string; theme?: string };
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  init: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  init: () => {
    const token = localStorage.getItem('access_token');
    const user = localStorage.getItem('user');
    if (token && user) {
      set({ user: JSON.parse(user), isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    const data: any = await api.post('/auth/login', { email, password });
    localStorage.setItem('access_token', data.accessToken);
    localStorage.setItem('refresh_token', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    set({ user: data.user });
  },

  logout: async () => {
    await api.post('/auth/logout').catch(() => {});
    localStorage.clear();
    set({ user: null });
    window.location.href = '/login';
  },
}));
