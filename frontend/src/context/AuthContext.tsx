import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, SystemHealth } from '../types';
import { authApi } from '../services/auth';
import { getStoredToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  health: SystemHealth | null;
  login: (credentials: { username: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshHealth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [health, setHealth] = useState<SystemHealth | null>(null);

  const refreshHealth = async () => {
    try {
      const data = await authApi.getSystemHealth();
      setHealth(data);
    } catch (err) {
      console.error('[Health Check Failed]', err);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      await refreshHealth();
      const token = getStoredToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const userData = await authApi.getMe();
        setUser(userData);
      } catch (err) {
        console.warn('[Session expired or invalid]', err);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (credentials: { username: string; password: string }) => {
    const session = await authApi.login(credentials);
    setUser(session.user);
    await refreshHealth();
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        health,
        login,
        logout,
        refreshHealth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
