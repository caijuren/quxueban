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

export function SelectedChildProvider({ children }: { children: React.ReactNode }) {
  const [childrenList, setChildrenList] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 初始化时从localStorage恢复
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsedId = parseInt(stored, 10);
      if (!isNaN(parsedId)) {
        setSelectedChildId(parsedId);
      }
    }
  }, []);

  // 获取孩子列表
  const refreshChildren = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/auth/children');
      const kids = response.data.data || [];
      setChildrenList(kids);
      
      // 如果没有选中或选中的不在列表中，默认选第一个
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

  // 初始加载孩子列表
  useEffect(() => {
    refreshChildren();
  }, [refreshChildren]);

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
