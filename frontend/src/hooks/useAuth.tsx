import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiClient, getErrorMessage } from '@/lib/api-client';

export interface User {
  id: number;
  name: string;
  role: 'parent';
  familyId: number;
  familyName: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // 从存储中加载认证状态
  useEffect(() => {
    const loadAuth = async () => {
      try {
        setIsInitializing(true);
        setError(null);
        
        const token = localStorage.getItem(TOKEN_KEY);
        const userStr = localStorage.getItem(USER_KEY);
        
        if (!token || !userStr) {
          setUser(null);
          setIsAuthenticated(false);
          return;
        }
        
        const userData = JSON.parse(userStr) as User;
        
        // 验证用户角色
        if (userData.role !== 'parent') {
          throw new Error('Invalid user role');
        }
        
        setUser(userData);
        setIsAuthenticated(true);
      } catch (err) {
        console.error('加载认证状态失败:', err);
        setError(getErrorMessage(err));
        setUser(null);
        setIsAuthenticated(false);
        // 清理无效的存储
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      } finally {
        setIsInitializing(false);
      }
    };
    
    loadAuth();

    const syncAuth = () => {
      loadAuth();
    };

    window.addEventListener('storage', syncAuth);
    window.addEventListener('auth:logout', syncAuth);

    return () => {
      window.removeEventListener('storage', syncAuth);
      window.removeEventListener('auth:logout', syncAuth);
    };
  }, []);
  
  // 登录
  const login = useCallback(async (username: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiClient.post('/login', { username, password });
      const { token, user: userData } = response.data.data;
      
      // 验证用户角色
      if (userData.role !== 'parent') {
        throw new Error('Only parent users are allowed');
      }
      
      // 存储认证信息
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      window.dispatchEvent(new Event('auth:login'));
      
      setUser(userData);
      setIsAuthenticated(true);
      
      // 重定向
      const from = location.state?.from?.pathname;
      if (from && from !== '/login' && from !== '/register') {
        navigate(from, { replace: true });
      } else {
        navigate('/parent', { replace: true });
      }
    } catch (err) {
      console.error('登录失败:', err);
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [navigate, location]);
  
  // 注册
  const register = useCallback(async (username: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiClient.post('/register', { username, password });
      const { token, user: userData } = response.data.data;
      
      // 存储认证信息
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      window.dispatchEvent(new Event('auth:login'));
      
      setUser(userData);
      setIsAuthenticated(true);
      
      // 重定向到家长仪表盘
      navigate('/parent', { replace: true });
    } catch (err) {
      console.error('注册失败:', err);
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);
  
  // 登出
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new Event('auth:logout'));
    
    setUser(null);
    setIsAuthenticated(false);
    
    navigate('/login', { replace: true });
  }, [navigate]);

  // 更新用户信息
  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...updates };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);
  
  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        login,
        register,
        logout,
        updateUser,
        isLoading,
        isInitializing,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
