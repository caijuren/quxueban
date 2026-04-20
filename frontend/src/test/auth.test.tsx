import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth, AuthProvider } from '../hooks/useAuth';
import { apiClient } from '@/lib/api-client';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock apiClient
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ state: { from: { pathname: '/' } } }),
}));

describe('身份认证逻辑', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('家长登录后应保持家长身份', async () => {
    // 模拟后端返回家长数据
    const mockUser = {
      id: 1,
      name: 'andycoy',
      role: 'parent' as const,
      familyId: 1,
      familyName: 'andycoy的家庭',
      familyCode: 'F12345',
      avatar: '👤',
    };

    (apiClient.get as any).mockResolvedValueOnce({
      data: { data: mockUser }
    });

    // 模拟 localStorage.getItem
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'auth_token') return 'valid-token';
      if (key === 'auth_state') return null;
      return null;
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider
    });

    // 等待初始化完成
    await waitFor(() => expect(result.current.isInitializing).toBe(false));

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.user?.role).toBe('parent');
  });

  it('刷新页面后不应跳转到孩子端', async () => {
    // 模拟从localStorage恢复家长用户
    const storedUser = {
      id: 1,
      name: 'andycoy',
      role: 'parent' as const,
      familyId: 1,
      familyName: 'andycoy的家庭',
      familyCode: 'F12345',
      avatar: '👤',
    };

    const storedAuthState = {
      user: storedUser,
      token: 'valid-token',
      isAuthenticated: true,
    };

    // 模拟 localStorage.getItem
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'auth_token') return 'valid-token';
      if (key === 'auth_state') return JSON.stringify(storedAuthState);
      return null;
    });

    // 模拟网络错误，让它从localStorage恢复
    (apiClient.get as any).mockRejectedValueOnce({ code: 'ECONNABORTED' });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider
    });

    // 等待初始化完成
    await waitFor(() => expect(result.current.isInitializing).toBe(false));

    // 应该从localStorage正确恢复用户
    expect(result.current.user).toEqual(storedUser);
    expect(result.current.user?.role).toBe('parent');
  });

  it('孩子登录后应保持孩子身份', async () => {
    // 模拟后端返回孩子数据
    const mockChild = {
      id: 2,
      name: 'Child1',
      role: 'child' as const,
      familyId: 1,
      familyName: 'andycoy的家庭',
      familyCode: 'F12345',
      avatar: '🐛',
    };

    (apiClient.get as any).mockResolvedValueOnce({
      data: { data: mockChild }
    });

    // 模拟 localStorage.getItem
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'auth_token') return 'child-token';
      if (key === 'auth_state') return null;
      return null;
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider
    });

    // 等待初始化完成
    await waitFor(() => expect(result.current.isInitializing).toBe(false));

    expect(result.current.user).toEqual(mockChild);
    expect(result.current.user?.role).toBe('child');
  });
});