import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface Child {
  id: number;
  name: string;
  avatar: string;
}

interface SelectedChildContextType {
  children: Child[];
  selectedChildId: number | null;
  selectedChild: Child | null;
  isLoading: boolean;
  selectChild: (childId: number | null) => void;
  refreshChildren: () => Promise<void>;
}

const SelectedChildContext = createContext<SelectedChildContextType | null>(null);

const STORAGE_KEY = 'selected_child_id';

/**
 * 读取家长认证状态（直接从 localStorage，与 useAuth 保持一致）
 */
function getParentAuth() {
  const token = localStorage.getItem('auth_token');
  const userStr = localStorage.getItem('auth_user');
  if (!token || !userStr) return null;
  try {
    const user = JSON.parse(userStr);
    if (user.role === 'parent') return { token, user };
  } catch { /* ignore */ }
  return null;
}

export function SelectedChildProvider({ children }: { children: React.ReactNode }) {
  const [childrenList, setChildrenList] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsedId = parseInt(stored, 10);
    return Number.isNaN(parsedId) ? null : parsedId;
  });
  const [isLoading, setIsLoading] = useState(() => !!getParentAuth());
  const [authReady, setAuthReady] = useState(() => !!getParentAuth());

  // 监听认证状态变化
  useEffect(() => {
    const checkAuth = () => {
      const auth = getParentAuth();
      setAuthReady(!!auth);
    };

    checkAuth();

    // 监听 storage 变化（跨标签页）和自定义 auth 事件
    window.addEventListener('storage', checkAuth);
    window.addEventListener('auth:logout', checkAuth);
    window.addEventListener('auth:login', checkAuth);

    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('auth:logout', checkAuth);
      window.removeEventListener('auth:login', checkAuth);
    };
  }, []);

  // 获取孩子列表
  const refreshChildren = useCallback(async () => {
    const auth = getParentAuth();
    if (!auth) return;

    setIsLoading(true);
    try {
      // 使用 /children 接口
      const response = await apiClient.get('/children');
      const kids = response.data.data || [];
      console.log('Fetched children:', kids);
      setChildrenList(kids);
      
      // 如果没有选中或选中的不在列表中，默认选择第一个孩子
      const currentSelected = localStorage.getItem(STORAGE_KEY);
      const currentSelectedId = currentSelected ? parseInt(currentSelected, 10) : null;

      if (kids.length > 0) {
        const validChild = currentSelectedId && kids.find((c: Child) => c.id === currentSelectedId);
        if (!validChild) {
          selectChild(kids[0].id);
        }
      } else {
        selectChild(null);
      }
    } catch (error) {
      console.error('Failed to fetch children:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectChild = useCallback((childId: number | null) => {
    setSelectedChildId(childId);
    if (childId) {
      localStorage.setItem(STORAGE_KEY, childId.toString());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    // 触发全局事件，通知页面刷新
    window.dispatchEvent(new CustomEvent('child:changed', { detail: { childId } }));
  }, []);

  const selectedChild = childrenList.find(c => c.id === selectedChildId) || null;

  // 当认证状态就绪时加载孩子列表
  useEffect(() => {
    if (authReady) {
      refreshChildren();
    }
  }, [authReady, refreshChildren]);

  return (
    <SelectedChildContext.Provider value={{
      children: childrenList,
      selectedChildId,
      selectedChild,
      isLoading,
      selectChild,
      refreshChildren,
    }}>
      {children}
    </SelectedChildContext.Provider>
  );
}

export function useSelectedChild(): SelectedChildContextType {
  const context = useContext(SelectedChildContext);
  if (!context) {
    throw new Error('useSelectedChild must be used within SelectedChildProvider');
  }
  return context;
}
