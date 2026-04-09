import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, BookOpen, Trophy, BarChart3, CheckCircle2, CalendarDays, Menu, X, ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/child', label: '首页', icon: Home },
  { path: '/child/weekly-plan', label: '周计划', icon: CalendarDays },
  { path: '/child/tasks', label: '任务', icon: CheckCircle2 },
  { path: '/child/library', label: '图书馆', icon: BookOpen },
  { path: '/child/achievements', label: '成就', icon: Trophy },
  { path: '/child/reports', label: '报告', icon: BarChart3 },
];

const sidebarVariants = {
  closed: { x: '-100%', opacity: 0 },
  open: { x: 0, opacity: 1 }
};

const overlayVariants = {
  closed: { opacity: 0 },
  open: { opacity: 1 }
};

export default function ChildLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, isAuthenticated, isInitializing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 路由守卫：未登录时跳转到登录页，家长用户跳转到家长页面
  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      navigate('/login', { replace: true, state: { from: location } });
    } else if (!isInitializing && isAuthenticated && user?.role !== 'child') {
      // 家长用户访问孩子页面，重定向到家长首页
      navigate('/parent', { replace: true });
    }
  }, [isInitializing, isAuthenticated, user, navigate, location]);

  // 初始化中显示加载状态，避免子组件访问未定义数据
  if (isInitializing) {
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
    return null;
  }

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
          <h1 className="font-semibold text-gray-900 text-base">趣学伴</h1>
          <Avatar className="size-9 ring-2 ring-white shadow-sm">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white text-sm font-medium">
              {user?.name?.charAt(0) || 'C'}
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
        <aside className="w-56 bg-white/80 backdrop-blur-xl border-r border-gray-200/50 flex flex-col h-screen sticky top-0">
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
      <div className="p-4">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-500/25 hover:scale-105 transition-transform duration-300">
            🐛
          </div>
          <div className="ml-2">
            <h1 className="font-bold text-gray-900 text-base">趣学伴</h1>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3">
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            // 对于首页(/child)，只精确匹配，不匹配子路径
            // 对于其他路径，匹配当前路径或以该路径开头的子路径
            const isActive = item.path === '/child'
              ? currentPath === '/child'
              : currentPath === item.path || currentPath.startsWith(`${item.path}/`);
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden',
                  isActive
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium shadow-lg shadow-purple-500/25'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300',
                  isActive ? 'bg-white/20' : 'bg-gray-100/50 group-hover:bg-gray-100'
                )}>
                  <Icon className={cn(
                    'size-4 transition-transform duration-200',
                    isActive ? '' : 'group-hover:scale-110'
                  )} />
                </div>
                <span className="text-sm transition-all duration-200 group-hover:translate-x-1">{item.label}</span>
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-l-xl" />
                )}
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
                  {user?.name?.charAt(0) || 'C'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full ring-2 ring-white" />
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">{user?.name || '孩子'}</p>
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
                <p className="font-medium text-gray-900 text-sm">{user?.name || '孩子'}</p>
                <p className="text-xs text-gray-500">在线</p>
              </div>
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
