import { useState, useEffect, useCallback } from 'react';
import type { ElementType, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  User,
  Home,
  ChevronRight,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import AccountSettings from './settings/AccountSettings';
import FamilySettings from './settings/FamilySettings';
import ChildrenManagement from './settings/ChildrenManagement';

interface SettingsItem {
  id: string;
  label: string;
  description: string;
  icon: ElementType;
  component: ReactNode;
}

const settingsItems: SettingsItem[] = [
  {
    id: 'account',
    label: '账户信息',
    description: '头像、密码与基础资料',
    icon: User,
    component: <AccountSettings />,
  },
  {
    id: 'family',
    label: '家庭设置',
    description: '家庭名称、家庭码与成员信息',
    icon: Home,
    component: <FamilySettings />,
  },
  {
    id: 'children',
    label: '孩子管理',
    description: '添加孩子、查看成长数据',
    icon: User,
    component: <ChildrenManagement />,
  },
];

export default function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('children');

  useEffect(() => {
    const path = location.pathname;
    const match = path.match(/\/settings\/([^/]+)/);
    if (match) {
      const tabId = match[1];
      const exists = settingsItems.some((item) => item.id === tabId);
      if (exists) {
        setActiveTab(tabId);
        return;
      }
    }

    if (path === '/parent/settings' || path === '/parent/settings/') {
      navigate('/parent/settings/children', { replace: true });
      setActiveTab('children');
    }
  }, [location.pathname, navigate]);

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    navigate(`/parent/settings/${tabId}`, { replace: true });
  }, [navigate]);

  const currentItem = settingsItems.find((item) => item.id === activeTab);

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-6">
      <aside className="w-64 flex-shrink-0">
        <div className="flex h-full flex-col rounded-xl border border-border bg-white shadow-sm">
          <div className="border-b border-border p-4">
            <h2 className="font-semibold text-foreground">设置</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              当前已恢复常用设置模块，优先保障家庭管理稳定可用。
            </p>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-1 p-3">
              {settingsItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                      isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {isActive ? <ChevronRight className="h-4 w-4" /> : null}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="h-full rounded-xl border border-border bg-white shadow-sm">
          <ScrollArea className="h-full">
            <div className="p-6">
              {currentItem ? (
                <div className="mb-6 border-b border-border pb-4">
                  <h1 className="text-xl font-semibold text-foreground">{currentItem.label}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">{currentItem.description}</p>
                </div>
              ) : null}
              {currentItem?.component}
            </div>
          </ScrollArea>
        </div>
      </main>
    </div>
  );
}
