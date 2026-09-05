import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getStoredTokens, storeTokens, clearTokens } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('habitup_admin_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const { accessToken } = getStoredTokens();
    if (accessToken && !user) {
      // If tokens exist but user object is missing, clear invalid state
      clearTokens();
    }
    setIsInitializing(false);
  }, []);

  // Heartbeat loop every 60 seconds
  useEffect(() => {
    if (!user) return;

    const sendHeartbeat = async () => {
      const { refreshToken } = getStoredTokens();
      if (!refreshToken) return;

      try {
        await api.heartbeat(refreshToken);
        setLastHeartbeat(new Date().toLocaleTimeString());
      } catch (err) {
        console.warn('Session heartbeat ping failed:', err.message);
      }
    };

    // Send initial heartbeat on mount
    sendHeartbeat();

    // 60 second interval
    const interval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const login = async (email, password) => {
    const res = await api.login(email, password);

    if (res.user?.role !== 'admin') {
      throw new Error('Access denied. Administrator privileges required.');
    }

    storeTokens(res.accessToken, res.refreshToken);
    localStorage.setItem('habitup_admin_user', JSON.stringify(res.user));
    setUser(res.user);
    setLastHeartbeat(new Date().toLocaleTimeString());
    return res.user;
  };

  const logout = () => {
    clearTokens();
    setUser(null);
    setLastHeartbeat(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isInitializing,
        lastHeartbeat,
        login,
        logout,
      }}
    >
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
