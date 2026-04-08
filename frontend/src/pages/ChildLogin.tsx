import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function ChildLogin() {
  const { childLogin, isLoading } = useAuth();
  const [formData, setFormData] = useState({
    childName: '',
    childPin: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      console.log('发送登录请求:', {
        childName: formData.childName,
        childPin: formData.childPin
      });
      await childLogin({
        childName: formData.childName,
        childPin: formData.childPin
      });
      toast.success('登录成功！');
    } catch (error) {
      console.error('登录失败:', error);
      toast.error('登录失败，请检查姓名和PIN码');
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-72 h-72 bg-purple-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl" />
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
              <span className="text-2xl">🦊</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">欢迎回来</h1>
            <p className="text-gray-500 mt-1 text-sm">孩子登录</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label className="text-sm font-medium text-gray-700">姓名</Label>
              <Input
                type="text"
                placeholder="输入孩子姓名"
                value={formData.childName}
                onChange={(e) => setFormData({ ...formData, childName: e.target.value })}
                className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-purple-500 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">PIN码</Label>
              <Input
                type="password"
                placeholder="输入4位数字PIN码"
                value={formData.childPin}
                onChange={(e) => setFormData({ ...formData, childPin: e.target.value })}
                className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-purple-500 focus:ring-purple-500"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-medium shadow-lg shadow-purple-200 mt-2"
            >
              {isLoading ? '登录中...' : '登录'}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              家长登录？{' '}
              <a href="/login" className="text-purple-600 hover:text-purple-700 font-medium">
                点击这里
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
