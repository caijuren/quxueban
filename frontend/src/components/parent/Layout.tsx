import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  ListTodo,
  CalendarDays,
  Library,
  BookOpen,
  Trophy,
  BarChart3,
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

const navItems = [
  { path: '/parent', label: '概览', icon: LayoutDashboard },
  { path: '/parent/tasks', label: '任务管理', icon: ListTodo },
  { path: '/parent/plans', label: '学习计划', icon: CalendarDays },
  { path: '/parent/library', label: '图书馆', icon: Library },
  { path: '/parent/reading', label: '阅读', icon: BookOpen },
  { path: '/parent/achievements', label: '成就', icon: Trophy },
  { path: '/parent/statistics', label: '数据统计', icon: BarChart3 },
  { path: '/parent/reports', label: 'AI 报告', icon: FileText },
  { path: '/parent/settings/account', label: '设置', icon: Settings },
];

const pageTitleMap: Record<string, string> = {
  '/parent': '概览',
  '/parent/tasks': '任务管理',
  '/parent/task-templates': '任务模板',
  '/parent/plans': '学习计划',
  '/parent/library': '图书馆',
  '/parent/reading': '阅读管理',
  '/parent/achievements': '成就系统',
  '/parent/children': '孩子管理',
  '/parent/statistics': '数据统计',
  '/parent/reports': 'AI 报告中心',
  '/parent/settings/account': '设置',
};

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/parent/settings/')) return '设置';
  if (pageTitleMap[pathname]) return pageTitleMap[pathname];
  for (const [path, title] of Object.entries(pageTitleMap)) {
    if (pathname.startsWith(path + '/')) return title;
  }
  return '趣学伴';
}

const sidebarVariants = {
  closed: { x: '-100%', opacity: 0 },
  open: { x: 0, opacity: 1 },
};

const overlayVariants = {
  closed: { opacity: 0 },
  open: { opacity: 1 },
};

export default function ParentLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user, logout, isAuthenticated, isInitializing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { children: childrenList, selectedChild, selectChild } = useSelectedChild();

  // 检查菜单项是否激活
  const isMenuActive = (path: string) => {
    return path === '/parent'
      ? location.pathname === '/parent'
      : location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  // 模拟通知数据
  useEffect(() => {
    // 这里可以从API获取实际的通知数据
    const mockNotifications = [
      {
        id: 1,
        title: '任务完成提醒',
        message: '臭沫沫完成了今日的阅读任务',
        type: 'success',
        time: '2分钟前',
        read: false,
      },
      {
        id: 2,
        title: '学习计划更新',
        message: '本周学习计划已更新',
        type: 'info',
        time: '1小时前',
        read: false,
      },
      {
        id: 3,
        title: '成就解锁',
        message: '小胖子解锁了"连续学习7天"成就',
        type: 'success',
        time: '昨天',
        read: true,
      },
    ];
    setNotifications(mockNotifications);
    setUnreadCount(mockNotifications.filter(n => !n.read).length);
  }, []);

  const markAsRead = (id: number) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
    setUnreadCount(prev => prev - 1);
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

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
        <div className="border-b border-border px-2.5 py-2 flex-shrink-0">
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-gradient-to-r from-slate-50 to-indigo-50/70 px-2 py-2 shadow-sm">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white font-bold text-[11px] shadow-sm">
              趣
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold tracking-tight text-slate-900">趣学伴</p>
              <p className="mt-0.5 text-[9px] text-muted-foreground">家庭学习伙伴</p>
            </div>
          </div>
        </div>

        {/* Child Selector */}
        {childrenList.length > 0 && (
          <div className="px-2.5 pt-2 pb-1.5 flex-shrink-0">
            <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground font-semibold px-1.5 mb-1.5">
              当前孩子
            </p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-2 rounded-xl border border-border/70 bg-slate-50/90 px-2 py-2 text-left shadow-sm transition-colors hover:border-indigo-200 hover:bg-white">
                  <Avatar className="size-6 ring-1 ring-white/80">
                    <AvatarImage src={selectedChild?.avatar} />
                    <AvatarFallback className="bg-indigo-100 text-indigo-700 text-[9px] font-semibold">
                      {selectedChild?.name?.charAt(0) || 'C'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-slate-900">
                      {selectedChild?.name || '选择孩子'}
                    </p>
                  </div>
                  <ChevronDown className="size-3.5 text-slate-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[150px] p-1">
                {childrenList.map((child) => {
                  const isSelected = selectedChild?.id === child.id;
                  return (
                    <DropdownMenuItem
                      key={child.id}
                      onClick={() => selectChild(child.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-2 py-2 cursor-pointer',
                        isSelected && 'bg-indigo-50 text-primary focus:bg-indigo-50 focus:text-primary'
                      )}
                    >
                      <Avatar className="size-5 ring-1 ring-white/80">
                        <AvatarImage src={child.avatar} />
                        <AvatarFallback className={cn(
                          'text-[9px] font-semibold',
                          isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
                        )}>
                          {child.name?.charAt(0) || 'C'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate text-[12px] font-medium">{child.name}</span>
                      {isSelected ? <span className="h-2 w-2 rounded-full bg-indigo-500" /> : null}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

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
                      ? 'bg-gradient-to-r from-indigo-50 to-violet-50 text-primary shadow-sm ring-1 ring-indigo-100'
                      : 'text-muted-foreground hover:bg-slate-50 hover:text-foreground'
                  )}
                >
                  {isActive ? <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-gradient-to-b from-indigo-500 to-violet-500" /> : null}
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
              <button className="flex w-full items-center gap-2 rounded-xl border border-border/70 bg-white px-2 py-2 text-left shadow-sm transition-colors hover:border-indigo-200 hover:bg-slate-50">
                <div className="relative flex-shrink-0">
                  <Avatar className="size-9 ring-1 ring-slate-200">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-500 text-white text-[11px] font-semibold">
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
          <h1 className="text-base font-semibold text-foreground">{pageTitle}</h1>
          <div className="flex items-center gap-2">
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
          <h1 className="font-semibold text-foreground text-sm">{pageTitle}</h1>
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
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            <Outlet />
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
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-gradient-to-r from-slate-50 to-indigo-50/70 px-3 py-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white font-bold text-sm shadow-sm">
                      趣
                    </div>
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

              {/* Mobile Child Selector */}
              {childrenList.length > 0 && (
                <div className="px-3 pt-3 pb-2 flex-shrink-0">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold px-2 mb-2">
                    当前孩子
                  </p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-slate-50/90 px-3 py-2.5 text-left shadow-sm transition-colors hover:border-indigo-200 hover:bg-white">
                        <Avatar className="size-7 ring-1 ring-white/80">
                          <AvatarImage src={selectedChild?.avatar} />
                          <AvatarFallback className="bg-indigo-100 text-indigo-700 text-[11px] font-semibold">
                            {selectedChild?.name?.charAt(0) || 'C'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {selectedChild?.name || '选择孩子'}
                          </p>
                          <p className="text-[11px] text-muted-foreground">点击切换</p>
                        </div>
                        <ChevronDown className="size-4 text-slate-500" />
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
                <nav className="space-y-1">
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
                            ? 'bg-gradient-to-r from-indigo-50 to-violet-50 text-primary shadow-sm ring-1 ring-indigo-100'
                            : 'text-muted-foreground hover:bg-slate-50 hover:text-foreground'
                        )}
                      >
                        {isActive ? <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-gradient-to-b from-indigo-500 to-violet-500" /> : null}
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
                <div className="rounded-2xl border border-border/70 bg-gradient-to-r from-slate-50 to-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative flex-shrink-0">
                      <Avatar className="size-10 flex-shrink-0 ring-1 ring-slate-200 shadow-sm">
                      <AvatarImage src={user?.avatar} />
                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-500 text-white text-sm font-semibold">
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
