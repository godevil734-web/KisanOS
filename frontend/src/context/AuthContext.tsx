import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Notification, UserRole } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  loginWithPassword: (identifier: string, pass: string, expectedRole?: string) => Promise<any>;
  loginWithOtp: (phone: string, code: string, expectedRole?: string) => Promise<any>;
  sendOtp: (phone: string) => Promise<any>;
  signupFarmer: (data: { name: string; phone: string; villageDistrict: string; mainCrops: string[]; password?: string }) => Promise<any>;
  signupBusiness: (data: any) => Promise<any>;
  googleInit: (data: { credential?: string; googleUser?: any }) => Promise<any>;
  googleVerifyOtp: (tempToken: string, code: string) => Promise<any>;
  googleRegister: (data: any) => Promise<any>;
  googleResendOtp: (email: string) => Promise<any>;
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
      const savedToken = localStorage.getItem('kc_token');
      if (savedToken) {
        const res = await api.getMe();
        setUser(res.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.warn('Session restoration failed:', err);
      localStorage.removeItem('kc_token');
      setToken(null);
      setUser(null);
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
        if (token) {
          await refreshUser();
          await refreshNotifications();
        } else {
          setUser(null);
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

  const loginWithPassword = async (identifier: string, pass: string, expectedRole?: string) => {
    const res = await api.login({ identifier, password: pass, expectedRole });
    localStorage.setItem('kc_token', res.token);
    setToken(res.token);
    setUser(res.user);
    await refreshNotifications();
    return res.user;
  };

  const sendOtp = async (phone: string) => {
    return await api.sendOtp(phone);
  };

  const loginWithOtp = async (phone: string, code: string, expectedRole?: string) => {
    const res = await api.verifyOtp({ phone, code, expectedRole });
    localStorage.setItem('kc_token', res.token);
    setToken(res.token);
    setUser(res.user);
    await refreshNotifications();
    return res.user;
  };

  const signupFarmer = async (data: { name: string; phone: string; villageDistrict: string; mainCrops: string[]; password?: string }) => {
    return await api.signupFarmer(data);
  };

  const signupBusiness = async (data: any) => {
    const res = await api.signupBusiness(data);
    localStorage.setItem('kc_token', res.token);
    setToken(res.token);
    setUser(res.user);
    await refreshNotifications();
    return res;
  };

  const googleInit = async (data: { credential?: string; googleUser?: any }) => {
    return await api.googleInit(data);
  };

  const googleVerifyOtp = async (tempToken: string, code: string) => {
    const res = await api.googleVerifyOtp({ tempToken, code });
    localStorage.setItem('kc_token', res.token);
    setToken(res.token);
    setUser(res.user);
    await refreshNotifications();
    return res.user;
  };

  const googleRegister = async (data: any) => {
    const res = await api.googleRegister(data);
    localStorage.setItem('kc_token', res.token);
    setToken(res.token);
    setUser(res.user);
    await refreshNotifications();
    return res;
  };

  const googleResendOtp = async (email: string) => {
    return await api.googleResendOtp(email);
  };

  const register = async (userData: any) => {
    if (userData.role === 'farmer') {
      await signupFarmer({
        name: userData.name,
        phone: userData.phone,
        villageDistrict: userData.location || 'Agra, UP',
        mainCrops: ['potato'],
        password: userData.password
      });
    } else {
      await signupBusiness({
        role: userData.role,
        businessName: userData.aggregatorDetails?.businessName || userData.buyerDetails?.companyName || userData.name,
        contactPerson: userData.name,
        mobile: userData.phone,
        email: userData.email || `${userData.phone}@kisanconnect.in`,
        city: userData.location || 'Agra, UP',
        password: userData.password || 'password123'
      });
    }
  };

  const logout = () => {
    api.logout().catch(() => {});
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
        loginWithPassword,
        loginWithOtp,
        sendOtp,
        signupFarmer,
        signupBusiness,
        googleInit,
        googleVerifyOtp,
        googleRegister,
        googleResendOtp,
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
