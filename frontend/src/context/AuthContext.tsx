import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Notification, UserRole } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole) => Promise<void>;
  notifications: Notification[];
  unreadCount: number;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('kc_token'));
  const [loading, setLoading] = useState<boolean>(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Refresh user data
  const refreshUser = async () => {
    try {
      if (localStorage.getItem('kc_token')) {
        const res = await api.getMe();
        setUser(res.user);
      }
    } catch (err) {
      console.error('Failed to restore session:', err);
      // Fallback: switch to default demo farmer
      await switchRole('farmer');
    }
  };

  const refreshNotifications = async () => {
    try {
      if (localStorage.getItem('kc_token')) {
        const notifs = await api.getNotifications();
        setNotifications(notifs);
      }
    } catch (e) {
      // ignore
    }
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        if (!token) {
          // Auto-login as Farmer Ramesh for immediate rich demo experience
          await switchRole('farmer');
        } else {
          await refreshUser();
          await refreshNotifications();
        }
      } catch (e) {
        console.error('Init error:', e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await api.login({ email, password: pass });
    localStorage.setItem('kc_token', res.token);
    setToken(res.token);
    setUser(res.user);
    await refreshNotifications();
  };

  const register = async (data: any) => {
    const res = await api.register(data);
    localStorage.setItem('kc_token', res.token);
    setToken(res.token);
    setUser(res.user);
    await refreshNotifications();
  };

  const logout = () => {
    localStorage.removeItem('kc_token');
    setToken(null);
    setUser(null);
  };

  const switchRole = async (role: UserRole) => {
    setLoading(true);
    try {
      const res = await api.demoSwitch(role);
      localStorage.setItem('kc_token', res.token);
      setToken(res.token);
      setUser(res.user);
      const notifs = await api.getNotifications();
      setNotifications(notifs);
    } catch (err) {
      console.error('Error switching role:', err);
    } finally {
      setLoading(false);
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        switchRole,
        notifications,
        unreadCount,
        refreshNotifications,
        markNotificationRead,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
