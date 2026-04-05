import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import type { User, AuthState, LoginCredentials, ChildLoginCredentials, RegisterData } from '@/types/auth';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  childLogin: (credentials: ChildLoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  addChild: (child: { name: string; pin: string; avatar: string }) => Promise<void>;
  switchUser: (user: User) => void;
  updateAuth: (data: { token: string; user: User }) => void;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = 'auth_state';

function getStoredAuthState(): AuthState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to parse auth state from localStorage', e);
  }
  return { user: null, token: null, isAuthenticated: false };
}

function saveAuthState(state: AuthState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (state.token) {
    localStorage.setItem('auth_token', state.token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(getStoredAuthState);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // 验证 token 是否有效
  const verifyToken = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setIsInitializing(false);
      return;
    }

    // 先尝试从本地存储恢复用户数据，避免闪烁
    const stored = getStoredAuthState();
    if (stored.user && stored.token === token) {
      setState(stored);
    }

    try {
      const response = await apiClient.get('/auth/me');
      const user = response.data.data;
      setState({
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          familyId: user.familyId,
          familyName: user.familyName,
          familyCode: user.familyCode,
          avatar: user.avatar,
        },
        token,
        isAuthenticated: true,
      });
    } catch (err: any) {
      // 如果是网络错误（后端休眠），保持当前状态，不强制登出
      if (err.code === 'ECONNABORTED' || err.message?.includes('Network Error') || !err.response) {
        console.warn('Network error during token verification, keeping existing session');
        // 保持现有状态，不登出
      } else if (err.response?.status === 401) {
        // Token 真正无效，清除状态
        console.error('Token invalid (401), logging out');
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('auth_token');
        setState({ user: null, token: null, isAuthenticated: false });
        window.dispatchEvent(new Event('auth:logout'));
      } else {
        // 其他错误，保持现有状态
        console.error('Token verification error:', err);
      }
    } finally {
      setIsInitializing(false);
    }
  }, []);

  // 应用启动时验证 token
  useEffect(() => {
    verifyToken();
  }, [verifyToken]);

  // 监听全局登出事件
  useEffect(() => {
    const handleLogout = () => {
      setState({ user: null, token: null, isAuthenticated: false });
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('auth_token');
    };

    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  useEffect(() => {
    if (!isInitializing) {
      saveAuthState(state);
    }
  }, [state, isInitializing]);

  const redirectByRole = useCallback((user: User) => {
    const from = location.state?.from?.pathname;
    if (from && from !== '/login' && from !== '/register') {
      navigate(from, { replace: true });
      return;
    }
    if (user.role === 'parent') {
      navigate('/parent', { replace: true });
    } else {
      navigate('/child', { replace: true });
    }
  }, [navigate, location]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/login', credentials);
      const { user, token } = response.data.data;
      setState({ user, token, isAuthenticated: true });
      redirectByRole(user);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [redirectByRole]);

  const childLogin = useCallback(async (credentials: ChildLoginCredentials) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/child-login', credentials);
      const { user, token } = response.data.data;
      setState({ user, token, isAuthenticated: true });
      redirectByRole(user);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [redirectByRole]);

  const register = useCallback(async (data: RegisterData) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/register', data);
      const { user, token } = response.data.data;
      setState({ user, token, isAuthenticated: true });
      redirectByRole(user);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [redirectByRole]);

  const logout = useCallback(() => {
    setState({ user: null, token: null, isAuthenticated: false });
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('auth_token');
    navigate('/login', { replace: true });
  }, [navigate]);

  const addChild = useCallback(async (child: { name: string; pin: string; avatar: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      await apiClient.post('/auth/add-child', child);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const switchUser = useCallback((user: User) => {
    setState(prev => ({ ...prev, user }));
    redirectByRole(user);
  }, [redirectByRole]);

  const updateAuth = useCallback((data: { token: string; user: User }) => {
    setState({
      user: data.user,
      token: data.token,
      isAuthenticated: true,
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        childLogin,
        register,
        logout,
        addChild,
        switchUser,
        updateAuth,
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
