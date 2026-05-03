import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  ListTodo,
  CalendarDays,
  Library,
  Trophy,
  BarChart3,
  ChartNoAxesCombined,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bell,
  Clock,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  FileText,
  Target,
  Brain,
  HelpCircle,
  ClipboardCheck,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSelectedChild } from '@/contexts/SelectedChildContext';
import type { Child } from '@/contexts/SelectedChildContext';
import { Skeleton } from '@/components/ui/skeleton';

const navGroups = [
  {
    id: 'today',
    label: '今日',
    items: [
      { path: '/parent', label: '今日概览', icon: LayoutDashboard },
      { path: '/parent/plans', label: '学习计划', icon: CalendarDays },
    ],
  },
  {
    id: 'tasks',
    label: '任务',
    items: [
      { path: '/parent/tasks', label: '任务管理', icon: ListTodo },
    ],
  },
  {
    id: 'goals',
    label: '目标',
    items: [
      { path: '/parent/goals', label: '目标管理', icon: Target },
      { path: '/parent/ability-model', label: '三层准备度', icon: Brain },
    ],
  },
  {
    id: 'growth',
    label: '成长',
    items: [
      { path: '/parent/growth-dashboard', label: '成长总览', icon: ChartNoAxesCombined },
      { path: '/parent/data-quality', label: '数据体检', icon: ClipboardCheck },
      { path: '/parent/reports', label: '学习报告', icon: FileText },
      { path: '/parent/achievements', label: '成就', icon: Trophy },
    ],
  },
  {
    id: 'reading',
    label: '阅读',
    items: [
      { path: '/parent/library', label: '图书馆', icon: Library },
    ],
  },
  {
    id: 'system',
    label: '设置',
    items: [
      { path: '/parent/settings/account', label: '设置', icon: Settings },
      { path: '/parent/help', label: '帮助中心', icon: HelpCircle },
    ],
  },
];

const navItems = navGroups.flatMap((group) => group.items);

type AppNotification = {
  id: number;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  time: string;
  read: boolean;
};

const pageTitleMap: Record<string, string> = {
  '/parent': '今日概览',
  '/parent/tasks': '任务管理',
  '/parent/task-templates': '任务模板',
  '/parent/plans': '学习计划',
  '/parent/library': '图书馆',
  '/parent/achievements': '成就系统',
  '/parent/growth-dashboard': '成长总览',
  '/parent/data-quality': '数据体检',
  '/parent/ability-model': '三层准备度',
  '/parent/goals': '目标管理',
  '/parent/children': '孩子管理',
  '/parent/statistics': '学习统计',
  '/parent/reports': '学习报告',
  '/parent/settings/account': '设置',
  '/parent/help': '帮助中心',
};

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/parent/settings/')) return '设置';
  if (pageTitleMap[pathname]) return pageTitleMap[pathname];
  for (const [path, title] of Object.entries(pageTitleMap)) {
    if (pathname.startsWith(path + '/')) return title;
  }
  return '趣学伴';
}

function getActiveGroupLabel(pathname: string): string {
  const activeGroup = navGroups.find((group) =>
    group.items.some((item) =>
      item.path === '/parent'
        ? pathname === '/parent'
        : pathname === item.path || pathname.startsWith(`${item.path}/`)
    )
  );

  return activeGroup?.label || '今日';
}

const sidebarVariants = {
  closed: { x: '-100%', opacity: 0 },
  open: { x: 0, opacity: 1 },
};

const overlayVariants = {
  closed: { opacity: 0 },
  open: { opacity: 1 },
};

function ChildSwitcherButton({
  childrenList,
  selectedChild,
  selectChild,
  compact = false,
}: {
  childrenList: Child[];
  selectedChild: Child | null;
  selectChild: (childId: number | null) => void;
  compact?: boolean;
}) {
  if (childrenList.length === 0) return null;

  return (
    <div
      className={cn(
        'flex min-w-0 items-center',
        compact ? 'max-w-[140px] gap-2 overflow-hidden' : 'gap-3'
      )}
      aria-label="选择孩子"
    >
      {childrenList.map((child) => {
        const isSelected = selectedChild?.id === child.id;
        return (
        <button
          key={child.id}
          type="button"
          onClick={() => selectChild(child.id)}
          title={child.name}
          aria-label={`切换到${child.name}`}
          aria-pressed={isSelected}
          className={cn(
            'group relative flex shrink-0 items-center justify-center rounded-full transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30',
            compact ? 'size-8' : 'size-9',
            !isSelected && 'hover:scale-105'
          )}
        >
          <ChildAvatar
            child={child}
            className={cn(
              compact ? 'size-8 text-sm' : 'size-9 text-base',
              !isSelected && 'grayscale opacity-45 group-hover:opacity-70'
            )}
          />
        </button>
        );
      })}
    </div>
  );
}

function isImageAvatar(value?: string) {
  if (!value) return false;
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/') || value.startsWith('data:image/');
}

function ChildAvatar({ child, className }: { child: Child; className?: string }) {
  const fallback = child.avatar && !isImageAvatar(child.avatar) ? child.avatar : (child.name?.charAt(0) || '孩');

  return (
    <Avatar className={cn('overflow-hidden bg-transparent transition-[filter,opacity]', className)}>
      {isImageAvatar(child.avatar) ? <AvatarImage src={child.avatar} alt={child.name} /> : null}
      <AvatarFallback className="bg-gradient-to-br from-indigo-100 to-sky-100 font-semibold text-indigo-700">
        {fallback}
      </AvatarFallback>
    </Avatar>
  );
}

export default function ParentLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user, logout, isAuthenticated, isInitializing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { children: childrenList, selectedChild, selectChild, isLoading: isChildLoading } = useSelectedChild();

  // 检查菜单项是否激活
  const isMenuActive = (path: string) => {
    return path === '/parent'
      ? location.pathname === '/parent'
      : location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const markAsRead = (id: number) => {
    setNotifications(prev => {
      const target = prev.find(n => n.id === id);
      if (target && !target.read) {
        setUnreadCount(count => Math.max(0, count - 1));
      }
      return prev.map(n => n.id === id ? { ...n, read: true } : n);
    });
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  useEffect(() => {
    const handleNotification = (event: Event) => {
      const detail = (event as CustomEvent<Partial<AppNotification>>).detail || {};
      const notification: AppNotification = {
        id: Date.now(),
        type: detail.type || 'info',
        title: detail.title || '系统通知',
        message: detail.message || '',
        time: '刚刚',
        read: false,
      };
      setNotifications(prev => [notification, ...prev].slice(0, 20));
      setUnreadCount(prev => prev + 1);
    };

    window.addEventListener('quxueban:notification', handleNotification);
    return () => window.removeEventListener('quxueban:notification', handleNotification);
  }, []);

  useEffect(() => {
    if (!isInitializing && isAuthenticated && user && user.role !== 'parent') {
      logout();
    }
  }, [isInitializing, isAuthenticated, user, logout]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm animate-pulse">
            趣
          </div>
          <p className="text-muted-foreground text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!user || user.role !== 'parent') {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);
  const pageTitle = getPageTitle(location.pathname);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ==================== Desktop Sidebar ==================== */}
      <aside className="hidden lg:flex lg:flex-col w-[176px] bg-white border-r border-border flex-shrink-0">
        {/* Brand */}
        <div className="border-b border-border px-2.5 py-2.5 flex-shrink-0">
          <div className="rounded-xl border border-border/70 bg-white px-2 py-2 shadow-sm">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="趣学伴" className="h-7 w-7 rounded-lg object-cover shadow-sm" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold tracking-tight text-slate-900">趣学伴</p>
                <p className="mt-0.5 text-[9px] text-muted-foreground">家庭学习伙伴</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-2.5 py-1.5">
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = isMenuActive(item.path);
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'group relative flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-all',
                    isActive
                      ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/15'
                      : 'text-muted-foreground hover:bg-slate-50 hover:text-foreground'
                  )}
                >
                  {isActive ? <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary" /> : null}
                  <div className={cn(
                    'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md transition-colors',
                    isActive ? 'bg-white text-primary shadow-sm' : 'bg-slate-100 text-slate-500 group-hover:bg-white'
                  )}>
                    <Icon className="size-[14px] flex-shrink-0" />
                  </div>
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </ScrollArea>

        {/* User Profile */}
        <div className="border-t border-border p-2.5 flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2 rounded-xl border border-border/70 bg-white px-2 py-2 text-left shadow-sm transition-colors hover:border-primary/20 hover:bg-slate-50">
                <div className="relative flex-shrink-0">
                  <Avatar className="size-9 ring-1 ring-slate-200">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-primary text-white text-[11px] font-semibold">
                      {user?.name?.charAt(0) || 'P'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold tracking-tight text-slate-900">
                    {user?.name || '家长'}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>家长</span>
                  </div>
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                  <ChevronDown className="size-3" />
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => navigate('/parent/settings/account')}
              >
                <Settings className="size-4 mr-2" />
                <span>设置</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="size-4 mr-2" />
                <span>退出登录</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* ==================== Main Area ==================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Header */}
        <header className="hidden lg:flex items-center justify-between h-[52px] px-6 bg-white border-b border-border flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-foreground">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ChildSwitcherButton
              childrenList={childrenList}
              selectedChild={selectedChild}
              selectChild={selectChild}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground relative">
                  <Bell className="size-4" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs w-5 h-5 flex items-center justify-center rounded-full">
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0">
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between mb-1">
                    <DropdownMenuLabel>通知中心</DropdownMenuLabel>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllAsRead}
                        className="text-xs text-primary hover:underline"
                      >
                        全部标为已读
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    您有 {unreadCount} 条未读通知
                  </p>
                </div>
                <ScrollArea className="max-h-80">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      暂无通知
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {notifications.map((notification) => (
                        <DropdownMenuItem 
                          key={notification.id}
                          className={cn(
                            "px-4 py-3 hover:bg-accent cursor-pointer",
                            !notification.read && "bg-accent/50"
                          )}
                          onClick={() => markAsRead(notification.id)}
                        >
                          <div className="flex items-start gap-3 w-full">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                              notification.type === 'success' && "bg-green-100 text-green-600",
                              notification.type === 'info' && "bg-blue-100 text-blue-600",
                              notification.type === 'warning' && "bg-yellow-100 text-yellow-600",
                              notification.type === 'error' && "bg-red-100 text-red-600"
                            )}>
                              {notification.type === 'success' && <CheckCircle2 className="size-4" />}
                              {notification.type === 'info' && <MessageSquare className="size-4" />}
                              {notification.type === 'warning' && <AlertCircle className="size-4" />}
                              {notification.type === 'error' && <AlertCircle className="size-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">
                                {notification.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {notification.message}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="size-3" />
                                  {notification.time}
                                </span>
                                {!notification.read && (
                                  <Badge className="text-xs bg-primary text-primary-foreground">未读</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between h-[52px] px-4 bg-white border-b border-border flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="text-foreground"
          >
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0 text-center">
            <h1 className="font-semibold text-foreground text-sm truncate">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ChildSwitcherButton
              childrenList={childrenList}
              selectedChild={selectedChild}
              selectChild={selectChild}
              compact
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground relative">
                  <Bell className="size-4" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs w-5 h-5 flex items-center justify-center rounded-full">
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0">
                <div className="p-4 border-b border-border">
                    <div className="flex items-center justify-between mb-1">
                      <DropdownMenuLabel>通知中心</DropdownMenuLabel>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-xs text-primary hover:underline"
                        >
                          全部标为已读
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      您有 {unreadCount} 条未读通知
                    </p>
                  </div>
                <ScrollArea className="max-h-80">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      暂无通知
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {notifications.map((notification) => (
                        <DropdownMenuItem
                          key={notification.id}
                          className={cn(
                            "px-4 py-3 hover:bg-accent cursor-pointer",
                            !notification.read && "bg-accent/50"
                          )}
                          onClick={() => markAsRead(notification.id)}
                        >
                          <div className="flex items-start gap-3 w-full">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                              notification.type === 'success' && "bg-green-100 text-green-600",
                              notification.type === 'info' && "bg-blue-100 text-blue-600",
                              notification.type === 'warning' && "bg-yellow-100 text-yellow-600",
                              notification.type === 'error' && "bg-red-100 text-red-600"
                            )}>
                              {notification.type === 'success' && <CheckCircle2 className="size-4" />}
                              {notification.type === 'info' && <MessageSquare className="size-4" />}
                              {notification.type === 'warning' && <AlertCircle className="size-4" />}
                              {notification.type === 'error' && <AlertCircle className="size-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">
                                {notification.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {notification.message}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="size-3" />
                                  {notification.time}
                                </span>
                                {!notification.read && (
                                  <Badge className="text-xs bg-primary text-primary-foreground">未读</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {isChildLoading && childrenList.length === 0 ? (
              <div className="space-y-6">
                <Skeleton className="h-16 rounded-2xl" />
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <Skeleton className="h-56 rounded-2xl" />
                  <Skeleton className="h-56 rounded-2xl" />
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-28 rounded-2xl" />
                  ))}
                </div>
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </main>
      </div>

      {/* ==================== Mobile Sidebar Overlay ==================== */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              variants={overlayVariants}
              initial="closed"
              animate="open"
              exit="closed"
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
              onClick={closeSidebar}
            />
            <motion.aside
              variants={sidebarVariants}
              initial="closed"
              animate="open"
              exit="closed"
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-[280px] bg-white shadow-2xl flex flex-col"
            >
              {/* Mobile Sidebar Brand */}
              <div className="border-b border-border px-3 py-3 flex-shrink-0">
                <div className="rounded-2xl border border-border/70 bg-gradient-to-r from-slate-50 to-indigo-50/70 px-3 py-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img src="/logo.png" alt="趣学伴" className="h-10 w-10 rounded-2xl object-cover shadow-sm" />
                      <div>
                        <p className="text-[15px] font-semibold tracking-tight text-slate-900">趣学伴</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">家庭学习伙伴</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={closeSidebar} className="rounded-xl text-muted-foreground hover:bg-white/80">
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Mobile Child Selector */}
              {childrenList.length > 0 && (
                <div className="px-3 pt-3 pb-2 flex-shrink-0">
                  <div className="mx-2 mb-2 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-gradient-to-r from-slate-50 to-white px-3 py-2.5 text-left shadow-sm transition-colors hover:border-indigo-200 hover:bg-white">
                        <Avatar className="size-7 ring-1 ring-white/80 shadow-sm">
                          <AvatarImage src={selectedChild?.avatar} />
                          <AvatarFallback className="bg-indigo-100 text-indigo-700 text-[11px] font-semibold">
                            {selectedChild?.name?.charAt(0) || 'C'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {selectedChild?.name || '选择孩子'}
                          </p>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
                          <ChevronDown className="size-4" />
                        </div>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[248px] p-1.5">
                      {childrenList.map((child) => {
                        const isSelected = selectedChild?.id === child.id;
                        return (
                          <DropdownMenuItem
                            key={child.id}
                            onClick={() => {
                              selectChild(child.id);
                            }}
                            className={cn(
                              'flex items-center gap-3 rounded-xl px-2.5 py-2.5 cursor-pointer',
                              isSelected && 'bg-indigo-50 text-primary focus:bg-indigo-50 focus:text-primary'
                            )}
                          >
                            <Avatar className="size-7 ring-1 ring-white/80">
                              <AvatarImage src={child.avatar} />
                              <AvatarFallback className={cn(
                                'text-[11px] font-semibold',
                                isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
                              )}>
                                {child.name?.charAt(0) || 'C'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="flex-1 truncate text-sm font-medium">{child.name}</span>
                            {isSelected ? <span className="h-2 w-2 rounded-full bg-indigo-500" /> : null}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              {/* Mobile Navigation */}
              <ScrollArea className="flex-1 px-3 py-2">
                <nav className="space-y-0.5">
                  {navItems.map((item) => {
                    const isActive = isMenuActive(item.path);
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={closeSidebar}
                        className={cn(
                          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all',
                          isActive
                            ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/15'
                            : 'text-muted-foreground hover:bg-slate-50 hover:text-foreground'
                        )}
                      >
                        {isActive ? <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-primary" /> : null}
                        <div className={cn(
                          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-colors',
                          isActive ? 'bg-white text-primary shadow-sm' : 'bg-slate-100 text-slate-500 group-hover:bg-white'
                        )}>
                          <Icon className="size-4 flex-shrink-0" />
                        </div>
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </nav>
              </ScrollArea>

              {/* Mobile User Profile */}
              <div className="border-t border-border p-3 flex-shrink-0">
                <div className="rounded-2xl border border-border/70 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative flex-shrink-0">
                      <Avatar className="size-10 flex-shrink-0 ring-1 ring-slate-200 shadow-sm">
                      <AvatarImage src={user?.avatar} />
                        <AvatarFallback className="bg-primary text-white text-sm font-semibold">
                        {user?.name?.charAt(0) || 'P'}
                      </AvatarFallback>
                    </Avatar>
                        <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{user?.name || '家长'}</p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            在线
                          </span>
                          <span className="text-[11px] text-muted-foreground">家长</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLogout}
                      className="rounded-xl border border-red-100 bg-white text-destructive shadow-sm hover:bg-red-50 hover:text-destructive text-xs"
                    >
                      <LogOut className="size-3.5 mr-1" />
                      退出
                    </Button>
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
