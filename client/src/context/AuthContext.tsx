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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await authApi.getMe();
        if (res.success && res.data) {
          setUser(res.data);
        }
      } catch (err) {
        setUser(null);
        setAuthToken(null);
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
    return res.data.user;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {}
    setAuthToken(null);
    setUser(null);
  };

  const refreshProfile = async () => {
    try {
      const res = await authApi.getMe();
      if (res.success && res.data) {
        setUser(res.data);
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
