import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
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
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/parent', label: '概览', icon: LayoutDashboard },
  { path: '/parent/tasks', label: '任务配置', icon: ListTodo },
  { path: '/parent/plans', label: '计划管理', icon: CalendarDays },
  { path: '/parent/library', label: '图书馆', icon: Library },
  { path: '/parent/reading', label: '阅读管理', icon: BookOpen },
  { path: '/parent/achievements', label: '成就配置', icon: Trophy },
  { path: '/parent/children', label: '孩子管理', icon: Users },
  { path: '/parent/statistics', label: '数据统计', icon: BarChart3 },
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
  const { user, logout, isAuthenticated, isInitializing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 路由守卫：未登录时跳转到登录页
  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      navigate('/login', { replace: true, state: { from: location } });
    }
  }, [isInitializing, isAuthenticated, navigate, location]);

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

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-purple-200/40 to-blue-200/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-blue-200/30 to-purple-200/30 rounded-full blur-3xl" />
      </div>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="flex items-center justify-between h-16 px-5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 hover:bg-gray-100"
          >
            <Menu className="size-5" />
          </Button>
          <h1 className="font-semibold text-gray-900">小书虫</h1>
          <Avatar className="size-9 ring-2 ring-white shadow-sm">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white text-sm font-medium">
              {user?.name?.charAt(0) || 'P'}
            </AvatarFallback>
          </Avatar>
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
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Layout */}
      <div className="hidden lg:flex min-h-screen relative z-10">
        {/* Desktop Sidebar */}
        <aside className="w-64 bg-white/80 backdrop-blur-xl border-r border-gray-200/50 flex flex-col h-screen sticky top-0">
          <SidebarContent 
            user={user} 
            onLogout={handleLogout}
            currentPath={location.pathname}
          />
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen overflow-auto">
          <div className="p-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Main Content */}
      <main className="lg:hidden pt-16 min-h-screen overflow-auto relative z-10">
        <div className="p-5">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

interface SidebarContentProps {
  user: any;
  onLogout: () => void;
  onClose?: () => void;
  currentPath: string;
}

function SidebarContent({ user, onLogout, onClose, currentPath }: SidebarContentProps) {
  return (
    <>
      {/* Header */}
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/25">
              🐛
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-lg">小书虫</h1>
              <p className="text-xs text-gray-500">学习计划</p>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="size-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
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
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                  isActive
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium shadow-lg shadow-purple-500/25'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <Icon className={cn(
                  'size-5 transition-transform duration-200',
                  isActive ? '' : 'group-hover:scale-110'
                )} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User Section */}
      <div className="p-4 mt-auto">
        <div className="space-y-3">
          {/* Current User Card */}
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200/50">
            <div className="relative">
              <Avatar className="size-11 ring-2 ring-white shadow-md">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white font-semibold">
                  {user?.name?.charAt(0) || 'P'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full ring-2 ring-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{user?.name || '家长'}</p>
              <p className="text-xs text-gray-500">在线</p>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200 group"
          >
            <LogOut className="size-5 group-hover:scale-110 transition-transform" />
            <span className="font-medium">退出登录</span>
          </button>
        </div>
      </div>
    </>
  );
}
