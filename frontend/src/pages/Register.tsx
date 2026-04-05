import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type UserRole = 'parent' | 'child';

export default function Register() {
  const { register, isLoading } = useAuth();
  const [role, setRole] = useState<UserRole>('parent');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('两次输入的密码不一致');
      return;
    }
    
    if (formData.password.length < 6) {
      toast.error('密码至少6位');
      return;
    }

    try {
      await register({
        username: formData.username,
        password: formData.password,
        role
      });
      toast.success('注册成功！');
    } catch {
      toast.error('注册失败，请重试');
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Main card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-200">
              <span className="text-2xl">🐛</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">创建账号</h1>
            <p className="text-gray-500 mt-1 text-sm">开始你的学习之旅</p>
          </div>

          {/* Role selection */}
          <div className="mb-6">
            <Label className="text-sm font-medium text-gray-700 mb-3 block">选择身份</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('parent')}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                  role === 'parent'
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                )}
              >
                <span className="text-2xl">👨‍👩‍👧</span>
                <span className="text-sm font-medium">家长</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('child')}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                  role === 'child'
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                )}
              >
                <span className="text-2xl">🧒</span>
                <span className="text-sm font-medium">孩子</span>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">用户名</Label>
              <Input
                type="text"
                placeholder="输入用户名"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-purple-500 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">密码</Label>
              <Input
                type="password"
                placeholder="至少6位密码"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-purple-500 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">确认密码</Label>
              <Input
                type="password"
                placeholder="再次输入密码"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-purple-500 focus:ring-purple-500"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-medium shadow-lg shadow-purple-200 mt-2"
            >
              {isLoading ? '注册中...' : '创建账号'}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              已有账号？{' '}
              <a href="/login" className="text-purple-600 hover:text-purple-700 font-medium">
                立即登录
              </a>
            </p>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className="flex justify-center gap-2 mt-6">
          <div className="w-2 h-2 rounded-full bg-purple-400" />
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <div className="w-2 h-2 rounded-full bg-green-400" />
        </div>
      </motion.div>
    </div>
  );
}
