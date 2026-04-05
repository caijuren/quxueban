import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, BookOpen, Trophy, BarChart3 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { path: '/child', label: '首页', icon: Home, emoji: '🏠' },
  { path: '/child/library', label: '图书馆', icon: BookOpen, emoji: '📚' },
  { path: '/child/achievements', label: '成就', icon: Trophy, emoji: '🏆' },
  { path: '/child/reports', label: '报告', icon: BarChart3, emoji: '📊' },
];

export default function ChildLayout() {
  const { isAuthenticated, isInitializing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 路由守卫：未登录时跳转到登录页
  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      navigate('/login', { replace: true, state: { from: location } });
    }
  }, [isInitializing, isAuthenticated, navigate, location]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Main Content */}
      <main className="container max-w-lg mx-auto px-4 py-4">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <motion.nav
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg"
      >
        <div className="container max-w-lg mx-auto px-2">
          <div className="flex justify-around items-center h-16">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/child'}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all ${
                    isActive
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <motion.span
                      className="text-xl mb-0.5"
                      animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 0.3 }}
                    >
                      {item.emoji}
                    </motion.span>
                    <span className="text-xs font-medium">{item.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute -bottom-0.5 w-8 h-1 bg-primary rounded-full"
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </motion.nav>
    </div>
  );
}
