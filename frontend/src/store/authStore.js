import { create } from 'zustand';
import { authApi } from '../api/endpoints';

const saved = JSON.parse(localStorage.getItem('taskflow_auth') || '{}');

export const useAuthStore = create((set, get) => ({
  user: saved.user || null,
  accessToken: saved.accessToken || '',
  refreshToken: saved.refreshToken || '',
  loading: true,
  setSession(session) {
    localStorage.setItem('taskflow_auth', JSON.stringify(session));
    set({ ...session, loading: false });
  },
  async login(payload) {
    const { data } = await authApi.login(payload);
    get().setSession(data);
    return data.user;
  },
  async register(payload) {
    const { data } = await authApi.register(payload);
    get().setSession(data);
    return data.user;
  },
  async hydrate() {
    const token = get().accessToken;
    if (!token) return set({ loading: false });
    try {
      const { data } = await authApi.me();
      set({ user: data, loading: false });
    } catch {
      get().logout(false);
    }
  },
  async logout(callApi = true) {
    const refreshToken = get().refreshToken;
    localStorage.removeItem('taskflow_auth');
    set({ user: null, accessToken: '', refreshToken: '', loading: false });
    if (callApi && refreshToken) await authApi.logout({ refreshToken }).catch(() => {});
  }
}));
