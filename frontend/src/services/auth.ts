import { request, setStoredToken, removeStoredToken } from './api';
import { AuthSession, User, SystemHealth } from '../types';

export const authApi = {
  async login(credentials: { username: string; password: string }): Promise<AuthSession> {
    const session = await request<AuthSession>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    setStoredToken(session.token);
    return session;
  },

  async logout(): Promise<void> {
    try {
      await request<void>('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network / offline error on logout
    } finally {
      removeStoredToken();
    }
  },

  async getMe(): Promise<User> {
    return request<User>('/api/auth/me');
  },

  async getSystemHealth(): Promise<SystemHealth> {
    return request<SystemHealth>('/api/system/health');
  },
};
