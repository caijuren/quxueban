import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/ThemeToggle';

const navItems = [
  { path: '/parent', label: '概览', icon: LayoutDashboard },
  { path: '/parent/tasks', label: '任务', icon: ListTodo },
  { path: '/parent/plans', label: '计划', icon: CalendarDays },
  { path: '/parent/children', label: '孩子', icon: Users },
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

export default function SimpleParentLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed] = useState(true);
  const { user, logout, isAuthenticated, isInitializing } = useAuth();
  const navigate = useNavigate();

  // 初始化中显示加载状态，避免子组件访问未定义数据
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white font-bold text-xl shadow-sm animate-pulse">
            🐛
          </div>
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  // 未登录不渲染任何内容（会由useEffect重定向）
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white font-bold text-xl shadow-sm animate-pulse">
            🐛
          </div>
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="w-full min-h-screen bg-[var(--color-background)]">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-[var(--color-primary)]/5 to-[var(--color-primary)]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-[var(--color-primary)]/5 to-[var(--color-primary)]/10 rounded-full blur-3xl" />
      </div>

      {/* Global Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--color-card)] border-b border-[var(--color-border)] shadow-[var(--shadow-card)] h-16">
        <div className="flex items-center justify-between h-full px-6">
          {/* Left: Brand + Navigation + Child Tabs */}
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-[var(--radius-button)] bg-[var(--color-primary)] flex items-center justify-center text-white font-bold text-sm shadow-[var(--shadow-card)]">
                趣
              </div>
              <h1 className="ml-2 font-semibold text-[var(--color-text-primary)] text-base">趣学伴</h1>
            </div>
            <nav className="hidden md:flex items-center gap-2 ml-6">
              {navItems.map((item) => {
                const isActive = item.path === '/parent'
                  ? window.location.pathname === '/parent'
                  : window.location.pathname === item.path || window.location.pathname.startsWith(`${item.path}/`);
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-[var(--radius-button)] text-sm font-medium transition-all duration-[var(--transition-fast)] group',
                      isActive
                        ? 'bg-[var(--color-primary)] text-white shadow-[var(--shadow-card)]'
                        : 'text-[var(--color-text-primary)] hover:bg-[var(--color-border)]'
                    )}
                  >
                    <div className={cn(
                      'w-7 h-7 rounded flex items-center justify-center transition-all duration-[var(--transition-fast)]',
                      isActive ? 'bg-white/20' : 'bg-[var(--color-background)] group-hover:bg-[var(--color-border)]'
                    )}>
                      <Icon className={cn(
                        'size-4 transition-transform duration-[var(--transition-fast)]',
                        isActive ? '' : 'group-hover:scale-105'
                      )} />
                    </div>
                    <span className="text-sm transition-all duration-[var(--transition-fast)]">{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Right: Theme Toggle + Notifications + Child Switcher + User */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="text-[var(--color-text-primary)] hover:bg-[var(--color-border)]">
              <Bell className="size-5" />
            </Button>
            
            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 rounded-[var(--radius-button)] hover:bg-[var(--color-border)] transition-colors duration-[var(--transition-fast)]">
                  <Avatar className="size-8 ring-2 ring-[var(--color-card)] shadow-[var(--shadow-card)]">
                    <AvatarFallback className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary-blue)] text-white text-sm font-medium">
                      {user?.name?.charAt(0) || 'P'}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 border border-[var(--color-border)] rounded-[var(--radius-card)] shadow-[var(--shadow-hover)] p-1">
                <DropdownMenuItem className="cursor-pointer text-[var(--color-secondary-red)] rounded-[var(--radius-button)] hover:bg-[var(--color-border)] transition-colors duration-[var(--transition-fast)]" onClick={handleLogout}>
                  <LogOut className="size-4 mr-2" />
                  <span>退出登录</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-16 left-0 right-0 z-40 bg-[var(--color-card)] border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between h-12 px-5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="text-[var(--color-text-primary)] hover:bg-[var(--color-border)]"
          >
            <Menu className="size-5" />
          </Button>
          <h1 className="font-semibold text-[var(--color-text-primary)] text-base">趣学伴</h1>
          <Button variant="ghost" size="icon" className="text-[var(--color-text-primary)] hover:bg-[var(--color-border)]">
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
                onLogout={handleLogout} 
                onClose={closeSidebar}
                currentPath={window.location.pathname}
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
              onLogout={handleLogout}
              currentPath={window.location.pathname}
            />
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-screen overflow-auto transition-all duration-300">
          <div className="p-6">
            <h1>Test</h1>
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Main Content */}
      <main className="lg:hidden pt-28 min-h-screen overflow-auto relative z-10">
        <div className="p-5 sm:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

interface SidebarContentProps {
  onLogout: () => void;
  onClose?: () => void;
  currentPath: string;
}

function SidebarContent({ onLogout, onClose, currentPath }: SidebarContentProps) {
  return (
    <>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-[var(--radius-button)] bg-[var(--color-primary)] flex items-center justify-center text-white font-bold text-sm shadow-[var(--shadow-card)]">
              趣
            </div>
            <div className="ml-2">
              <h1 className="font-bold text-[var(--color-text-primary)] text-base">趣学伴</h1>
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
                onClick={onClose && (() => onClose())}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-button)] transition-all duration-[var(--transition-fast)] group',
                  isActive
                    ? 'bg-[var(--color-primary)] text-white font-medium shadow-[var(--shadow-card)]'
                    : 'text-[var(--color-text-primary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)]'
                )}
              >
                <div className={cn(
                  'w-7 h-7 rounded flex items-center justify-center transition-all duration-[var(--transition-fast)]',
                  isActive ? 'bg-white/20' : 'bg-[var(--color-background)] group-hover:bg-[var(--color-border)]'
                )}>
                  <Icon className={cn(
                    'size-4 transition-transform duration-[var(--transition-fast)]',
                    isActive ? '' : 'group-hover:scale-105'
                  )} />
                </div>
                <span className="text-sm transition-all duration-[var(--transition-fast)]">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User Info */}
      <div className="p-3 border-t border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="size-10 ring-2 ring-[var(--color-card)] shadow-[var(--shadow-card)]">
                <AvatarFallback className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary-blue)] text-white text-sm font-medium">
                  P
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[var(--color-secondary-green)] rounded-full ring-2 ring-[var(--color-card)]" />
            </div>
            <div>
              <p className="font-medium text-[var(--color-text-primary)] text-sm">家长</p>
              <p className="text-xs text-[var(--color-text-secondary)]">在线</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded-[var(--radius-button)] hover:bg-[var(--color-border)] transition-all duration-[var(--transition-fast)]">
                <ChevronDown className="size-4 text-[var(--color-text-secondary)]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 border border-[var(--color-border)] rounded-[var(--radius-card)] shadow-[var(--shadow-hover)]">
              <div className="p-2 border-b border-[var(--color-border)]">
                <p className="font-medium text-[var(--color-text-primary)] text-sm">家长</p>
                <p className="text-xs text-[var(--color-text-secondary)]">在线</p>
              </div>
              <DropdownMenuItem className="cursor-pointer rounded-[var(--radius-button)] hover:bg-[var(--color-border)] transition-colors duration-[var(--transition-fast)]">
                <Settings className="size-4 mr-2" />
                <span className="text-[var(--color-text-primary)]">设置</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-[var(--color-secondary-red)] rounded-[var(--radius-button)] hover:bg-[var(--color-border)] transition-colors duration-[var(--transition-fast)]" onClick={onLogout}>
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
