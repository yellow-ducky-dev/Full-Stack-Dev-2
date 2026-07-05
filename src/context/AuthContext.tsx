import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { User, UserRole, AuthContextType } from '../types';
import toast from 'react-hot-toast';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Axios instance
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Request interceptor to attach JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nexus_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const getErrorMsg = (error: any, defaultMsg: string) => {
  if (error.response?.data?.errors?.length > 0) {
    return error.response.data.errors[0].message;
  }
  return error.response?.data?.message || error.message || defaultMsg;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('nexus_token');
      if (token) {
        try {
          const res = await api.get('/users/me');
          setUser({ ...res.data, id: res.data._id });
        } catch (error) {
          console.error('Failed to load user:', error);
          localStorage.removeItem('nexus_token');
        }
      }
      setIsLoading(false);
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string, role: UserRole): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password, role });
      
      // Basic support if 2FA was enabled
      if (res.data.requires2FA) {
        toast(res.data.message);
        setIsLoading(false);
        throw new Error('2FA required');
      }
      
      const { token, user } = res.data;
      localStorage.setItem('nexus_token', token);
      setUser({ ...user, id: user._id });
      toast.success('Successfully logged in!');
    } catch (error: any) {
      setIsLoading(false);
      const msg = getErrorMsg(error, 'Login failed');
      toast.error(msg);
      throw new Error(msg);
    }
    setIsLoading(false);
  };

  const register = async (name: string, email: string, password: string, role: UserRole): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/register', { name, email, password, role });
      const { token, user } = res.data;
      localStorage.setItem('nexus_token', token);
      setUser({ ...user, id: user._id });
      toast.success('Account created successfully!');
    } catch (error: any) {
      setIsLoading(false);
      const msg = getErrorMsg(error, 'Registration failed');
      toast.error(msg);
      throw new Error(msg);
    }
    setIsLoading(false);
  };

  const logout = async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // ignore
    }
    setUser(null);
    localStorage.removeItem('nexus_token');
    toast.success('Logged out successfully');
  };

  const forgotPassword = async (email: string): Promise<void> => {
    try {
      await api.post('/auth/forgot-password', { email });
      toast.success('Password reset instructions sent to your email');
    } catch (error: any) {
      const msg = getErrorMsg(error, 'Failed to send reset email');
      toast.error(msg);
      throw new Error(msg);
    }
  };

  const resetPassword = async (token: string, newPassword: string): Promise<void> => {
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      toast.success('Password reset successfully');
    } catch (error: any) {
      const msg = getErrorMsg(error, 'Failed to reset password');
      toast.error(msg);
      throw new Error(msg);
    }
  };

  const updateProfile = async (userId: string, updates: Partial<User>): Promise<void> => {
    if (!user) return;
    try {
      const res = await api.put(`/users/${userId}`, updates);
      const updated = { ...res.data, id: res.data._id || res.data.id };
      setUser(updated);
      toast.success('Profile updated successfully');
    } catch (error: any) {
      const msg = getErrorMsg(error, 'Profile update failed');
      toast.error(msg);
      throw new Error(msg);
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    updateProfile,
    isAuthenticated: !!user,
    isLoading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};