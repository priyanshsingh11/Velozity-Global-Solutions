import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(
    localStorage.getItem('accessToken')
  );
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.data.user);
    } catch {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem('accessToken');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // On mount: try to restore session from stored access token or attempt refresh
  useEffect(() => {
    const storedToken = localStorage.getItem('accessToken');
    if (storedToken) {
      setAccessToken(storedToken);
      fetchCurrentUser();
    } else {
      // Try a silent refresh via HttpOnly cookie
      api
        .post('/auth/refresh')
        .then(({ data }) => {
          const newToken = data.data.accessToken;
          localStorage.setItem('accessToken', newToken);
          setAccessToken(newToken);
          setUser(data.data.user);
        })
        .catch(() => {
          // No valid session
        })
        .finally(() => setIsLoading(false));
    }
  }, [fetchCurrentUser]);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    const { accessToken: token, user: userData } = data.data;
    localStorage.setItem('accessToken', token);
    setAccessToken(token);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('accessToken');
      setAccessToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
