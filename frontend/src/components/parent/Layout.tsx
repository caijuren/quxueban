import { useState, useEffect } from 'react';
import { NavLink, Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  ListTodo,
  CalendarDays,
  Library,
  BookOpen,
  Trophy,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bell,
  Plus,
  CalendarPlus,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ChildTabs } from './ChildTabs';
import { useSelectedChild } from '@/contexts/SelectedChildContext';
import UserProfileModal from '@/components/UserProfileModal';

const navItems = [
  { path: '/parent', label: '概览', icon: LayoutDashboard },
  { path: '/parent/tasks', label: '任务', icon: ListTodo },
  { path: '/parent/plans', label: '计划', icon: CalendarDays },
  { path: '/parent/library', label: '图书馆', icon: Library },
  { path: '/parent/reading', label: '阅读', icon: BookOpen },
  { path: '/parent/achievements', label: '成就', icon: Trophy },
  { path: '/parent/statistics', label: '数据', icon: BarChart3 },
  { path: '/parent/settings', label: '设置', icon: Settings },
];

const sidebarVariants = {
  closed: { x: '-100%', opacity: 0 },
  open: { x: 0, opacity: 1 }
};

const overlayVariants = {
  closed: { opacity: 0 },
  open: { opacity: 1 }
};

export default function ParentLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const { user, logout, isAuthenticated, isInitializing } = useAuth();
  const { selectedChild } = useSelectedChild();
  const navigate = useNavigate();
  const location = useLocation();

  // 路由守卫：未登录时跳转到登录页，孩子用户跳转到孩子页面
  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      navigate('/login', { replace: true, state: { from: location } });
    } else if (!isInitializing && isAuthenticated && user?.role !== 'parent') {
      // 孩子用户访问家长页面，重定向到孩子首页
      navigate('/child', { replace: true });
    }
  }, [isInitializing, isAuthenticated, user, navigate, location]);

  // 初始化中显示加载状态，避免子组件访问未定义数据
  if (isInitializing) {
    console.log('[Layout] Initializing...');
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/25 animate-pulse">
            🐛
          </div>
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  // 未登录不渲染任何内容（会由useEffect重定向）
  if (!isAuthenticated) {
    console.log('[Layout] Not authenticated, rendering null');
    return null;
  }

  console.log('[Layout] Rendering with user:', user?.name, 'familyCode:', user?.familyCode);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleProfileSettings = () => {
    setProfileModalOpen(true);
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-primary/5 to-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-primary/5 to-primary/10 rounded-full blur-3xl" />
      </div>

      {/* Global Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-border shadow-sm h-16">
        <div className="flex items-center justify-between h-full px-6">
          {/* Left: Brand + Navigation + Child Tabs */}
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm shadow-md">
                趣
              </div>
              <h1 className="ml-2 font-semibold text-foreground text-base">趣学伴</h1>
            </div>
            <nav className="hidden md:flex items-center gap-2 ml-6">
              {navItems.map((item) => {
                const isActive = item.path === '/parent'
                  ? location.pathname === '/parent'
                  : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group',
                      isActive
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <div className={cn(
                      'w-7 h-7 rounded flex items-center justify-center transition-all duration-200',
                      isActive ? 'bg-white/20' : 'bg-muted group-hover:bg-muted/50'
                    )}>
                      <Icon className={cn(
                        'size-4 transition-transform duration-200',
                        isActive ? '' : 'group-hover:scale-105'
                      )} />
                    </div>
                    <span className="text-sm transition-all duration-200">{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
            <div className="hidden lg:flex ml-6">
              <ChildTabs />
            </div>
          </div>

          {/* Right: Notifications + User */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-foreground hover:bg-muted">
              <Bell className="size-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 p-1 rounded-lg hover:bg-muted transition-colors">
                  <Avatar className="size-8 ring-2 ring-white shadow-sm">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white text-sm font-medium">
                      {user?.name?.charAt(0) || 'P'}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="cursor-pointer" onClick={handleProfileSettings}>
                  <Settings className="size-4 mr-2" />
                  <span>个人设置</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer text-destructive" onClick={handleLogout}>
                  <LogOut className="size-4 mr-2" />
                  <span>退出登录</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-16 left-0 right-0 z-40 bg-white border-b border-border">
        <div className="flex items-center justify-between h-12 px-5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="text-foreground hover:bg-muted"
          >
            <Menu className="size-5" />
          </Button>
          <h1 className="font-semibold text-foreground text-base">趣学伴</h1>
          <Button variant="ghost" size="icon" className="text-foreground hover:bg-muted">
            <Bell className="size-5" />
          </Button>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
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
              className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-72 bg-white shadow-2xl"
            >
              <SidebarContent 
                user={user} 
                onLogout={handleLogout} 
                onClose={closeSidebar}
                currentPath={location.pathname}
                selectedChild={selectedChild}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Layout */}
      <div className="hidden lg:flex min-h-screen relative z-10 pt-16">
        {/* Desktop Sidebar */}
        {!sidebarCollapsed && (
          <aside className="w-56 bg-white border-r border-border flex flex-col h-screen sticky top-16 transition-all duration-300">
            <SidebarContent 
              user={user} 
              onLogout={handleLogout}
              currentPath={location.pathname}
              selectedChild={selectedChild}
            />
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-screen overflow-auto transition-all duration-300">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Main Content */}
      <main className="lg:hidden pt-28 min-h-screen overflow-auto relative z-10">
        <div className="p-5">
          <ChildTabs />
          <Outlet />
        </div>
      </main>

      {/* User Profile Modal */}
      <UserProfileModal 
        open={profileModalOpen} 
        onOpenChange={setProfileModalOpen} 
      />
    </div>
  );
}

interface SidebarContentProps {
  user: any;
  onLogout: () => void;
  onClose?: () => void;
  currentPath: string;
  selectedChild?: any;
}

function SidebarContent({ user, onLogout, onClose, currentPath, selectedChild }: SidebarContentProps) {
  return (
    <>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm shadow-md">
              趣
            </div>
            <div className="ml-2">
              <h1 className="font-bold text-foreground text-base">趣学伴</h1>
            </div>
          </div>
        </div>

      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3">
        <nav className="space-y-1.5">
          {navItems.filter(item => item.path !== '/parent/settings').map((item) => {
            // 对于概览(/parent)，只精确匹配，不匹配子路径
            // 对于其他路径，匹配当前路径或以该路径开头的子路径
            const isActive = item.path === '/parent'
              ? currentPath === '/parent'
              : currentPath === item.path || currentPath.startsWith(`${item.path}/`);
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                  isActive
                    ? 'bg-primary text-white font-medium shadow-sm'
                    : 'text-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <div className={cn(
                  'w-7 h-7 rounded flex items-center justify-center transition-all duration-200',
                  isActive ? 'bg-white/20' : 'bg-muted group-hover:bg-muted/50'
                )}>
                  <Icon className={cn(
                    'size-4 transition-transform duration-200',
                    isActive ? '' : 'group-hover:scale-105'
                  )} />
                </div>
                <span className="text-sm transition-all duration-200">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User Info */}
      <div className="p-3 border-t border-gray-200/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="size-10 ring-2 ring-white shadow-sm">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white text-sm font-medium">
                  {user?.name?.charAt(0) || 'P'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full ring-2 ring-white" />
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">{user?.name || '家长'}</p>
              <p className="text-xs text-gray-500">在线</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded-xl hover:bg-gray-100 transition-all">
                <ChevronDown className="size-4 text-gray-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="p-2 border-b border-gray-100">
                <p className="font-medium text-gray-900 text-sm">{user?.name || '家长'}</p>
                <p className="text-xs text-gray-500">在线</p>
              </div>
              <DropdownMenuItem className="cursor-pointer">
                <Settings className="size-4 mr-2" />
                <span>设置</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-red-600" onClick={onLogout}>
                <LogOut className="size-4 mr-2" />
                <span>退出登录</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  );
}
