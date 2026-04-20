import { useState, useEffect, useCallback } from 'react';
import type { ElementType, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  User,
  Home,
  BookOpen,
  Bell,
  Bot,
  Database,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// Settings sections
import AccountSettings from './settings/AccountSettings';
import FamilySettings from './settings/FamilySettings';
import ChildrenManagement from './settings/ChildrenManagement';
import LearningSettings from './settings/LearningSettings';
import NotificationSettings from './settings/NotificationSettings';
import AISettings from './settings/AISettings';
import DataManagement from './settings/DataManagement';
import DangerZone from './settings/DangerZone';

interface SettingsItem {
  id: string;
  label: string;
  description: string;
  icon: ElementType;
  component: ReactNode;
  badge?: string;
  tone?: 'default' | 'danger';
}

interface SettingsGroup {
  id: string;
  label: string;
  items: SettingsItem[];
}

const settingsGroups: SettingsGroup[] = [
  {
    id: 'profile',
    label: '个人与家庭',
    items: [
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
    ]
  },
  {
    id: 'preferences',
    label: '学习与通知',
    items: [
      {
        id: 'learning',
        label: '学习设置',
        description: '学习时长、休息提醒与周报偏好',
        icon: BookOpen,
        component: <LearningSettings />,
      },
      {
        id: 'notification',
        label: '通知偏好',
        description: '接收哪些提醒、通过什么方式接收',
        icon: Bell,
        component: <NotificationSettings />,
      },
      {
        id: 'ai',
        label: 'AI 设置',
        description: '配置 AI 服务与连接测试',
        icon: Bot,
        component: <AISettings />,
      },
    ]
  },
  {
    id: 'system',
    label: '数据与安全',
    items: [
      {
        id: 'data',
        label: '数据管理',
        description: '备份、导入导出与历史数据维护',
        icon: Database,
        component: <DataManagement />,
        badge: '规划中',
      },
      {
        id: 'danger',
        label: '危险区域',
        description: '不可逆或高影响操作',
        icon: AlertTriangle,
        component: <DangerZone />,
        tone: 'danger',
      },
    ]
  },
];

export default function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('account');

  // Parse active tab from URL
  useEffect(() => {
    const path = location.pathname;
    const match = path.match(/\/settings\/([^/]+)/);
    if (match) {
      const tabId = match[1];
      const exists = settingsGroups.some(g => g.items.some(i => i.id === tabId));
      if (exists) {
        setActiveTab(tabId);
      }
    }
  }, [location.pathname]);

  // Update URL when tab changes
  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    navigate(`/parent/settings/${tabId}`, { replace: true });
  }, [navigate]);

  // Get current component
  const currentItem = settingsGroups
    .flatMap(g => g.items)
    .find(item => item.id === activeTab);

  return (
      <div className="h-[calc(100vh-6rem)] flex gap-6">
        {/* Left Sidebar */}
        <aside className="w-64 flex-shrink-0">
          <div className="bg-white rounded-xl border border-border shadow-sm h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold text-foreground">设置</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                管理账户、家庭、通知和数据安全。
              </p>
            </div>

            {/* Navigation */}
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-4">
                {settingsGroups.map(group => (
                  <div key={group.id}>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2">
                      {group.label}
                    </h3>
                    <nav className="space-y-1">
                      {group.items.map(item => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleTabChange(item.id)}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                              isActive
                                ? 'bg-primary text-primary-foreground'
                                : 'text-foreground hover:bg-muted',
                              item.tone === 'danger' && !isActive && 'text-destructive hover:bg-destructive/10'
                            )}
                          >
                            <Icon className="w-4 h-4" />
                            <span className="flex-1 text-left">{item.label}</span>
                            {item.badge && !isActive ? (
                              <Badge variant="secondary" className="text-[10px] font-medium">
                                {item.badge}
                              </Badge>
                            ) : null}
                            {isActive && <ChevronRight className="w-4 h-4" />}
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="p-4 border-t border-border">
              <p className="text-xs leading-5 text-muted-foreground">
                大多数设置会在修改后立即保存。高风险操作会在执行前再次确认。
              </p>
            </div>
          </div>
        </aside>

        {/* Right Content */}
        <main className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-border shadow-sm h-full">
            <ScrollArea className="h-full">
              <div className="p-6">
                {currentItem ? (
                  <div className="mb-6 border-b border-border pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h1 className="text-xl font-semibold text-foreground">{currentItem.label}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">{currentItem.description}</p>
                      </div>
                      {currentItem.badge ? (
                        <Badge variant="outline">{currentItem.badge}</Badge>
                      ) : null}
                    </div>
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
