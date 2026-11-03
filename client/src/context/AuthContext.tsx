import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.ts';
import { authApi, setAuthToken } from '../services/api.ts';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (workerId: string, pin: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('ssf_user_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(() => {
    // If no token exists, immediately ready (not loading)
    if (typeof window === 'undefined') return true;
    const token = localStorage.getItem('ssf_auth_token');
    const savedUser = localStorage.getItem('ssf_user_profile');
    return Boolean(token && !savedUser);
  });

  useEffect(() => {
    async function loadUser() {
      const token = localStorage.getItem('ssf_auth_token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await authApi.getMe();
        if (res.success && res.data) {
          setUser(res.data);
          localStorage.setItem('ssf_user_profile', JSON.stringify(res.data));
        }
      } catch (err) {
        setUser(null);
        setAuthToken(null);
        localStorage.removeItem('ssf_user_profile');
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  const login = async (workerId: string, pin: string): Promise<User> => {
    const res = await authApi.login(workerId, pin);
    setAuthToken(res.data.token);
    setUser(res.data.user);
    try {
      localStorage.setItem('ssf_user_profile', JSON.stringify(res.data.user));
    } catch {}
    return res.data.user;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {}
    setAuthToken(null);
    setUser(null);
    try {
      localStorage.removeItem('ssf_user_profile');
    } catch {}
  };

  const refreshProfile = async () => {
    try {
      const res = await authApi.getMe();
      if (res.success && res.data) {
        setUser(res.data);
        localStorage.setItem('ssf_user_profile', JSON.stringify(res.data));
      }
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
