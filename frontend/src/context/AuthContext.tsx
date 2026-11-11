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
      refreshHealth().catch(() => {});
      const token = getStoredToken();
      if (!token) {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('jewel_suite_user_data');
        }
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        const userData = await authApi.getMe();
        setUser(userData);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('jewel_suite_user_data', JSON.stringify(userData));
        }
      } catch (err: any) {
        const isAuthError = err?.statusCode === 401 || err?.status === 401 || err?.code === 'UNAUTHORIZED';
        if (isAuthError) {
          console.warn('[Session expired or invalid]', err);
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('jewel_suite_user_data');
          }
          setUser(null);
        } else {
          // If offline or temporary network hitch, restore cached user to keep session continuous
          if (typeof window !== 'undefined') {
            const cached = sessionStorage.getItem('jewel_suite_user_data');
            if (cached) {
              try {
                setUser(JSON.parse(cached));
              } catch {
                setUser(null);
              }
            } else {
              setUser(null);
            }
          } else {
            setUser(null);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (credentials: { username: string; password: string }) => {
    const session = await authApi.login(credentials);
    setUser(session.user);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('jewel_suite_user_data', JSON.stringify(session.user));
    }
    refreshHealth().catch(() => {});
  };

  const logout = async () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('jewel_suite_user_data');
    }
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
