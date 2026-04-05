import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  CalendarDays,
  Trophy,
  Users,
  BarChart3,
  Library,
  ArrowRight,
  Sparkles,
  Target,
} from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: CalendarDays,
      title: '智能任务分配',
      desc: '根据任务类型自动分配到每天，周三不排校内作业，周末专注培优拔高',
      gradient: 'from-rose-400 to-orange-400',
    },
    {
      icon: CheckCircle2,
      title: '每日打卡',
      desc: '孩子轻松完成每日任务打卡，支持补做和提前完成，音效动画激励',
      gradient: 'from-emerald-400 to-teal-400',
    },
    {
      icon: BarChart3,
      title: '学习报告',
      desc: '自动生成每日/每周学习报告，支持钉钉推送，家长随时掌握进度',
      gradient: 'from-blue-400 to-cyan-400',
    },
    {
      icon: Library,
      title: '图书馆',
      desc: '记录阅读进度，培养阅读习惯，性格养成标签，封面展示',
      gradient: 'from-violet-400 to-purple-400',
    },
    {
      icon: Trophy,
      title: '成就系统',
      desc: '完成任务解锁成就，收集徽章，让学习更有成就感',
      gradient: 'from-amber-400 to-yellow-400',
    },
    {
      icon: Users,
      title: '多用户支持',
      desc: '一个家庭多个孩子，家长统一管理，每个孩子独立数据',
      gradient: 'from-pink-400 to-rose-400',
    },
  ];

  const stats = [
    { label: '任务类型', value: '6+', desc: '校内巩固、拔高、阅读等' },
    { label: '智能分配', value: '自动', desc: '根据规则自动排期' },
    { label: '多维度标签', value: '4类', desc: '学科、形式、参与、难度' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-purple-200/40 to-blue-200/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-blue-200/30 to-purple-200/30 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/25">
                🐛
              </div>
              <span className="font-bold text-xl text-gray-900">趣学伴</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => navigate('/login')}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl"
              >
                登录
              </Button>
              <Button
                onClick={() => navigate('/register')}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-xl px-6 shadow-lg shadow-purple-500/25"
              >
                注册家庭
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 text-purple-700 text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
                <span>专为小学生设计</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
                让学习变得
                <br />
                <span className="bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
                  有趣又高效
                </span>
              </h1>
              <p className="text-lg text-gray-600 mb-8 max-w-lg">
                智能任务分配、每日打卡、阅读管理、成就系统，帮助家长轻松管理孩子的学习计划
              </p>
              <div className="flex flex-wrap gap-4">
                <Button
                  size="lg"
                  onClick={() => navigate('/register')}
                  className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-xl px-8 h-14 text-base shadow-lg shadow-purple-500/25"
                >
                  开始使用
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate('/login')}
                  className="rounded-xl px-8 h-14 text-base border-gray-300 hover:bg-gray-50"
                >
                  已有账号
                </Button>
              </div>

              {/* Stats */}
              <div className="flex gap-8 mt-12 pt-8 border-t border-gray-200">
                {stats.map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                  >
                    <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                    <div className="text-sm font-medium text-gray-900">{stat.label}</div>
                    <div className="text-xs text-gray-500">{stat.desc}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Right Content - Preview Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="bg-white rounded-3xl shadow-2xl shadow-gray-200/50 p-6 border border-gray-100">
                {/* Card Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-bold text-gray-900">今日任务</h3>
                    <p className="text-sm text-gray-500">2026年4月2日 周三</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/25">
                    孩子
                  </div>
                </div>

                {/* Progress */}
                <div className="mb-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600">完成进度</span>
                    <span className="font-bold text-purple-600">67%</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full w-2/3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full" />
                  </div>
                </div>

                {/* Task List */}
                <div className="space-y-3">
                  {[
                    { name: '校内作业', done: true, icon: '📝', category: '校内巩固' },
                    { name: '英语阅读', done: true, icon: '🔤', category: '英语阅读' },
                    { name: '一课一练', done: false, icon: '📖', category: '校内巩固' },
                    { name: 'OD课程', done: false, icon: '🎬', category: '课外课程' },
                  ].map((task, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                        task.done
                          ? 'bg-emerald-50 border border-emerald-100'
                          : 'bg-gray-50 border border-gray-100'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          task.done
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white border-2 border-gray-300'
                        }`}
                      >
                        {task.done && <CheckCircle2 className="w-4 h-4" />}
                      </div>
                      <span className="text-lg">{task.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{task.name}</div>
                        <div className="text-xs text-gray-500">{task.category}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating badges */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 }}
                className="absolute -top-4 -right-4 bg-white rounded-2xl p-4 shadow-xl border border-gray-100"
              >
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-400 flex items-center justify-center text-xl">
                    🔥
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">连续打卡</div>
                    <div className="font-bold text-gray-900">7 天</div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 }}
                className="absolute -bottom-4 -left-4 bg-white rounded-2xl p-4 shadow-xl border border-gray-100"
              >
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-violet-400 flex items-center justify-center text-xl">
                    🏆
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">获得成就</div>
                    <div className="font-bold text-gray-900">阅读达人</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                核心功能
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                从任务管理到阅读跟踪，从成就激励到数据分析，全方位助力孩子学习成长
              </p>
            </motion.div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300"
              >
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-white mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}
                >
                  <feature.icon className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-xl text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                如何使用
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                简单三步，轻松管理孩子的学习计划
              </p>
            </motion.div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: '配置任务',
                desc: '在任务配置中添加学习任务，设置分类、类型和标签',
                icon: Target,
              },
              {
                step: '02',
                title: '发布计划',
                desc: '每周日发布下周计划，系统自动分配到每天',
                icon: CalendarDays,
              },
              {
                step: '03',
                title: '每日打卡',
                desc: '孩子完成任务后打卡，家长随时查看进度',
                icon: CheckCircle2,
              },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 h-full">
                  <div className="text-6xl font-bold text-gray-100 mb-4">
                    {item.step}
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white mb-5">
                    <item.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-xl text-gray-900 mb-3">
                    {item.title}
                  </h3>
                  <p className="text-gray-600">{item.desc}</p>
                </div>
                {index < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-px bg-gradient-to-r from-purple-300 to-blue-300" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-white/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-purple-500 to-blue-500 rounded-3xl p-12 text-center text-white shadow-2xl shadow-purple-500/25"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              准备好开始了吗？
            </h2>
            <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
              创建您的家庭账号，开启高效学习之旅，让孩子的学习更有规划、更有成就感
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button
                size="lg"
                onClick={() => navigate('/register')}
                className="bg-white text-purple-600 hover:bg-gray-100 rounded-xl px-8 h-14 text-base font-semibold"
              >
                立即开始
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/login')}
                className="bg-transparent border-2 border-white text-white hover:bg-white/10 rounded-xl px-8 h-14 text-base"
              >
                登录账号
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

    </div>
  );
};

export default Index;
