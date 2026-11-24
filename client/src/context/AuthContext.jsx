import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  apiFetch,
  getStoredTokens,
  getStoredUser,
  setStoredAuth,
  clearStoredAuth,
} from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(true);

  const syncUser = useCallback(async () => {
    const { accessToken, refreshToken } = getStoredTokens();
    if (!accessToken && !refreshToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await apiFetch('/api/auth/me');
      if (res?.data?.user) {
        setUser(res.data.user);
        setStoredAuth({ user: res.data.user });
      }
    } catch {
      clearStoredAuth();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    syncUser();
  }, [syncUser]);

  const login = async ({ email, password }) => {
    const res = await apiFetch(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      { skipAuth: true }
    );
    setStoredAuth(res.data);
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async ({ name, email, password, role, bio }) => {
    const res = await apiFetch(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role, bio }),
      },
      { skipAuth: true }
    );
    setStoredAuth(res.data);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    try {
      if (getStoredTokens().accessToken) {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      }
    } catch {
      // ignore network error on logout
    } finally {
      clearStoredAuth();
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    isHost: user?.role === 'host' || user?.role === 'admin',
    isAdmin: user?.role === 'admin',
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
