import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface ThemeToggleProps {
  className?: string;
}

type ThemeType = 'light' | 'dark' | 'blue' | 'green';

export function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeType>('light');

  useEffect(() => {
    // 检查本地存储中的主题偏好
    const savedTheme = localStorage.getItem('theme') as ThemeType;
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      // 检查系统偏好
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initialTheme = prefersDark ? 'dark' : 'light';
      setTheme(initialTheme);
      applyTheme(initialTheme);
    }
  }, []);

  const applyTheme = (newTheme: ThemeType) => {
    // 清除所有主题类
    document.documentElement.classList.remove('dark', 'theme-blue', 'theme-green');
    
    // 应用新主题
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (newTheme === 'blue') {
      document.documentElement.classList.add('theme-blue');
    } else if (newTheme === 'green') {
      document.documentElement.classList.add('theme-green');
    }
    
    // 保存主题偏好
    localStorage.setItem('theme', newTheme);
  };

  const handleThemeChange = (newTheme: ThemeType) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'dark':
        return <Sun className="size-5 text-yellow-400" />;
      case 'blue':
        return <Palette className="size-5 text-blue-500" />;
      case 'green':
        return <Palette className="size-5 text-green-500" />;
      default:
        return <Moon className="size-5 text-gray-600" />;
    }
  };

  return (
    <motion.div
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={className}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full transition-all duration-300 hover:bg-muted"
          >
            {getThemeIcon()}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem onClick={() => handleThemeChange('light')}>
            <Sun className="size-4 mr-2" />
            <span>浅色模式</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleThemeChange('dark')}>
            <Moon className="size-4 mr-2" />
            <span>深色模式</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleThemeChange('blue')}>
            <Palette className="size-4 mr-2 text-blue-500" />
            <span>蓝色主题</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleThemeChange('green')}>
            <Palette className="size-4 mr-2 text-green-500" />
            <span>绿色主题</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.div>
  );
}
