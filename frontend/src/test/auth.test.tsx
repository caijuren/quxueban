import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth, AuthProvider } from '../hooks/useAuth';
import { apiClient } from '@/lib/api-client';

const storage = new Map<string, string>();

const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    storage.delete(key);
  }),
  clear: vi.fn(() => {
    storage.clear();
  }),
};

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: vi.fn(),
  },
  getErrorMessage: (error: unknown) => error instanceof Error ? error.message : '请求失败',
}));

const navigateMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ state: null }),
}));

describe('身份认证逻辑', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.clear();
  });

  it('刷新页面后应从 auth_user 恢复家长身份', async () => {
    const storedUser = {
      id: 1,
      name: 'andycoy',
      role: 'parent' as const,
      familyId: 1,
      familyName: 'andycoy的家庭',
      familyCode: 'F12345',
      avatar: '👤',
    };

    storage.set('auth_token', 'valid-token');
    storage.set('auth_user', JSON.stringify(storedUser));

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => expect(result.current.isInitializing).toBe(false));

    expect(result.current.user).toEqual(storedUser);
    expect(result.current.user?.role).toBe('parent');
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('孩子身份缓存会被清理，不再进入家长端认证态', async () => {
    const storedChild = {
      id: 2,
      name: 'Child1',
      role: 'child',
      familyId: 1,
      familyName: 'andycoy的家庭',
      familyCode: 'F12345',
      avatar: '🐛',
    };

    storage.set('auth_token', 'child-token');
    storage.set('auth_user', JSON.stringify(storedChild));

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => expect(result.current.isInitializing).toBe(false));

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(storage.has('auth_token')).toBe(false);
    expect(storage.has('auth_user')).toBe(false);
  });

  it('家长登录后应写入 auth_token 和 auth_user', async () => {
    const mockUser = {
      id: 1,
      name: 'andycoy',
      role: 'parent' as const,
      familyId: 1,
      familyName: 'andycoy的家庭',
      familyCode: 'F12345',
      avatar: '👤',
    };

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        data: {
          token: 'valid-token',
          user: mockUser,
        },
      },
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => expect(result.current.isInitializing).toBe(false));

    await act(async () => {
      await result.current.login('andycoy', '123456');
    });

    expect(storage.get('auth_token')).toBe('valid-token');
    expect(JSON.parse(storage.get('auth_user') || '{}')).toEqual(mockUser);
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(navigateMock).toHaveBeenCalledWith('/parent', { replace: true });
  });
});
