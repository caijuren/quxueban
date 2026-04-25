import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  Clock,
  Target,
  Users,
  BookOpen,
  Activity,
  PieChart as PieChartIcon,
  Calendar,
  AlertTriangle,
  Download,
  ChevronDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import { useSelectedChild } from '@/contexts/SelectedChildContext';

// ============================================
// 统一视觉规范 - Design Token
// ============================================
const DESIGN_TOKENS = {
  // 学科颜色体系（固定不变）
  subjects: {
    '语文': { color: '#10b981', light: '#d1fae5', name: '语文' },
    '数学': { color: '#3b82f6', light: '#dbeafe', name: '数学' },
    '英语': { color: '#f97316', light: '#ffedd5', name: '英语' },
    '体育': { color: '#ef4444', light: '#fee2e2', name: '体育' },
  },
  // 分类颜色体系
  categories: {
    '校内巩固': '#f97316',
    '校内拔高': '#3b82f6',
    '课外课程': '#10b981',
    '英语阅读': '#8b5cf6',
    '体育运动': '#f59e0b',
    '中文阅读': '#ec4899',
  },
  // 图表色板（渐变色系）
  chartPalette: ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'],
  // 状态色
  status: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
  // 字体规范
  font: {
    hero: 'text-3xl font-bold',
    title: 'text-lg font-semibold',
    body: 'text-sm',
    caption: 'text-xs text-gray-500',
  },
  // 圆角规范
  radius: {
    card: 'rounded-2xl',
    button: 'rounded-xl',
    badge: 'rounded-full',
  },
};

// 时间筛选选项
const TIME_FILTERS = [
  { value: 'week', label: '本周', days: 7 },
  { value: 'month', label: '近一月', days: 30 },
  { value: 'semester', label: '本学期', days: 120 },
] as const;

// ============================================
// 接口定义
// ============================================
interface StatisticsData {
  summary: {
    totalTasks: number;
    totalTarget: number;
    totalProgress: number;
    completionRate: number;
    totalTime: number;
  };
  byCategory: Array<{ name: string; value: number; percentage: number }>;
  bySubject: Array<{ name: string; value: number; percentage: number }>;
  byFormat: Array<{ name: string; value: number; percentage: number }>;
  byParticipation: Array<{ name: string; value: number; percentage: number }>;
  dailyCompletion: Array<{ day: string; completed: number; total: number; rate: number }>;
  children: Array<{ id: number; name: string; avatar: string }>;
}

interface TrendsData {
  trends: Array<{
    weekNo: string;
    completionRate: number;
    totalTasks: number;
    totalTime: number;
  }>;
}

// ============================================
// API 函数
// ============================================
async function fetchStatistics(childId?: number, days?: number): Promise<StatisticsData> {
  const params = new URLSearchParams();
  if (childId) params.append('childId', childId.toString());
  if (days) params.append('days', days.toString());
  const { data } = await apiClient.get(`/statistics/overview?${params}`);
  return data.data;
}

async function fetchTrends(childId?: number): Promise<TrendsData> {
  const params = new URLSearchParams();
  if (childId) params.append('childId', childId.toString());
  params.append('weeks', '4');
  const { data } = await apiClient.get(`/statistics/trends?${params}`);
  return data.data;
}

// ============================================
// 自定义 Tooltip 组件（统一风格）
// ============================================
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; payload?: Record<string, unknown> }>;
  label?: string;
  unit?: string;
}

function CustomTooltip({ active, payload, unit = '分钟' }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-200 shadow-xl rounded-xl p-3 text-sm">
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: (entry.payload as { fill?: string })?.fill || '#888' }}
          />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-semibold text-gray-900">
            {Math.round(entry.value)} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================
// KPI 卡片组件（顶部指标）
// ============================================
interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  trend?: { value: number; isUp: boolean };
  delay?: number;
  alert?: boolean;
}

function KPICard({ title, value, subtitle, icon, color, bgColor, trend, delay = 0, alert }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <Card className="border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-shadow">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-500">{title}</p>
                {alert && (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
              {subtitle && (
                <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
              )}
              {trend && (
                <div className={`flex items-center gap-1 mt-2 text-xs ${
                  trend.isUp ? 'text-emerald-500' : 'text-red-500'
                }`}>
                  <TrendingUp className={`w-3 h-3 ${!trend.isUp && 'rotate-180'}`} />
                  <span>{trend.isUp ? '+' : ''}{trend.value}%</span>
                  <span className="text-gray-400">vs 上周</span>
                </div>
              )}
            </div>
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: bgColor }}
            >
              <div style={{ color }}>{icon}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================
// 智能解读模块
// ============================================
// ============================================
// 主组件
// ============================================
export default function StatisticsPage() {
  const [timeFilter, setTimeFilter] = useState<typeof TIME_FILTERS[number]['value']>('week');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { selectedChildId } = useSelectedChild();
  
  const currentFilter = TIME_FILTERS.find(f => f.value === timeFilter);
  
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['statistics', selectedChildId, currentFilter?.days],
    queryFn: () => fetchStatistics(selectedChildId || undefined, currentFilter?.days),
  });
  
  const { data: trends, isLoading: isLoadingTrends } = useQuery({
    queryKey: ['trends', selectedChildId],
    queryFn: () => fetchTrends(selectedChildId || undefined),
  });
  
  if (isLoadingStats || isLoadingTrends) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }
  
  const summary = stats?.summary;
  
  return (
    <div className="space-y-6 pb-8">
      {/* Page Control Bar */}
      <div className="bg-muted/40 border border-border/70 rounded-2xl p-4 mb-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Empty space for alignment */}
          <div className="flex-1"></div>
          
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* 全局时间筛选器 - 核心功能 */}
            <div className="flex items-center bg-white rounded-lg p-0.5 shadow-sm">
              {TIME_FILTERS.map(filter => (
                <button
                  key={filter.value}
                  onClick={() => setTimeFilter(filter.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    timeFilter === filter.value
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-foreground hover:bg-muted/50'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            
            {/* 导出按钮 */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted/50 transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>导出周报</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              
              <AnimatePresence>
                {showExportMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 mt-2 w-40 bg-white border border-border rounded-lg shadow-lg overflow-hidden z-50"
                  >
                    <button className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted/50">
                      导出为 PNG
                    </button>
                    <button className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted/50">
                      导出为 PDF
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
      {/* ==================== 顶部 KPI 看板 ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="本周任务"
          value={summary?.totalTasks || 0}
          subtitle={`已完成 ${summary?.totalProgress || 0}/${summary?.totalTarget || 0}`}
          icon={<BookOpen className="w-6 h-6" />}
          color="#8b5cf6"
          bgColor="#f3e8ff"
          delay={0}
        />
        <KPICard
          title="完成率"
          value={`${summary?.completionRate || 0}%`}
          subtitle="本周总体完成情况"
          icon={<Target className="w-6 h-6" />}
          color="#10b981"
          bgColor="#d1fae5"
          delay={0.1}
          alert={summary?.completionRate === 0}
        />
        <KPICard
          title="预计时长"
          value={`${Math.round((summary?.totalTime || 0) / 60)}h`}
          subtitle={`${Math.round((summary?.totalTime || 0) % 60)} 分钟`}
          icon={<Clock className="w-6 h-6" />}
          color="#3b82f6"
          bgColor="#dbeafe"
          delay={0.2}
        />
        <KPICard
          title="完成进度"
          value={`${summary?.totalProgress || 0}`}
          subtitle={`目标: ${summary?.totalTarget || 0}`}
          icon={<TrendingUp className="w-6 h-6" />}
          color="#f59e0b"
          bgColor="#fef3c7"
          delay={0.3}
        />
      </div>
      
      {/* ==================== 时间分析区（时间相关图表组合） ==================== */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-500" />
          <h2 className="text-lg font-semibold text-gray-900">时间分析</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 时间分配（按分类）- 环形图 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-purple-500" />
                  时间分配（按分类）
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats?.byCategory || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        labelLine={false}
                        label={({ name, percentage }) => `${name} ${percentage}%`}
                      >
                        {(stats?.byCategory || []).map((entry) => (
                          <Cell
                            key={`cell-${entry.name}`}
                            fill={DESIGN_TOKENS.categories[entry.name as keyof typeof DESIGN_TOKENS.categories] || '#8884d8'}
                            stroke="none"
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip unit="分钟" />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* 图例 */}
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {(stats?.byCategory || []).slice(0, 4).map((entry) => (
                    <div key={entry.name} className="flex items-center gap-1.5">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ 
                          backgroundColor: DESIGN_TOKENS.categories[entry.name as keyof typeof DESIGN_TOKENS.categories] 
                        }}
                      />
                      <span className="text-xs text-gray-600">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
          
          {/* 学科投入分析 - 柱状图 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-500" />
                  学科投入分析
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={stats?.bySubject || []} 
                      layout="vertical"
                      margin={{ left: 20, right: 30 }}
                    >
                      <CartesianGrid horizontal stroke="#f0f0f0" />
                      <XAxis type="number" unit="分钟" tick={{ fontSize: 12 }} />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={60}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip content={<CustomTooltip unit="分钟" />} />
                      <Bar 
                        dataKey="value" 
                        radius={[0, 6, 6, 0]}
                        maxBarSize={40}
                      >
                        {(stats?.bySubject || []).map((entry) => {
                          const subjectConfig = DESIGN_TOKENS.subjects[entry.name as keyof typeof DESIGN_TOKENS.subjects];
                          return (
                            <Cell 
                              key={`cell-${entry.name}`}
                              fill={subjectConfig?.color || '#8884d8'}
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* 学科图例 */}
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {(stats?.bySubject || []).map((entry) => {
                    const config = DESIGN_TOKENS.subjects[entry.name as keyof typeof DESIGN_TOKENS.subjects];
                    return (
                      <div key={entry.name} className="flex items-center gap-1.5">
                        <div 
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: config?.color }}
                        />
                        <span className="text-xs text-gray-600">
                          {entry.name} {entry.percentage.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
      
      {/* ==================== 行为分析区（行为相关图表组合） ==================== */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-semibold text-gray-900">行为分析</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 执行形式分布 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-500" />
                  执行形式分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats?.byFormat || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {(stats?.byFormat || []).map((_, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={DESIGN_TOKENS.chartPalette[index % DESIGN_TOKENS.chartPalette.length]}
                            stroke="none"
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip unit="分钟" />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* 图例 */}
                <div className="flex flex-wrap justify-center gap-3 mt-4">
                  {(stats?.byFormat || []).map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-1.5">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ 
                          backgroundColor: DESIGN_TOKENS.chartPalette[index % DESIGN_TOKENS.chartPalette.length] 
                        }}
                      />
                      <span className="text-xs text-gray-600">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
          
          {/* 陪伴方式统计 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-500" />
                  陪伴方式统计
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats?.byParticipation || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {(stats?.byParticipation || []).map((_, index) => (
                          <Cell 
                            key={`cell-${index}`}
                            fill={['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'][index % 4]}
                            stroke="none"
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip unit="分钟" />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* 图例 */}
                <div className="flex flex-wrap justify-center gap-3 mt-4">
                  {(stats?.byParticipation || []).map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-1.5">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ 
                          backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'][index % 4]
                        }}
                      />
                      <span className="text-xs text-gray-600">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
      
      {/* ==================== 趋势分析区 ==================== */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-semibold text-gray-900">趋势分析</h2>
        </div>
        
        {/* 完成率趋势 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-500" />
                完成率趋势（近4周）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={trends?.trends || []}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="weekNo" 
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis 
                      unit="%" 
                      domain={[0, 100]} 
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white/95 backdrop-blur-sm border border-gray-200 shadow-xl rounded-xl p-3 text-sm">
                            <p className="font-semibold text-gray-900">{data.weekNo}</p>
                            <p className="text-purple-600">完成率: {data.completionRate}%</p>
                            <p className="text-gray-500 text-xs mt-1">
                              任务数: {data.totalTasks} | 时长: {Math.round(data.totalTime / 60)}h
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="completionRate"
                      stroke="#8b5cf6"
                      strokeWidth={3}
                      dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 5 }}
                      activeDot={{ r: 7, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        {/* 每日完成情况 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                每日完成情况
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={stats?.dailyCompletion || []}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="day" 
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis 
                      unit="%" 
                      domain={[0, 100]} 
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white/95 backdrop-blur-sm border border-gray-200 shadow-xl rounded-xl p-3 text-sm">
                            <p className="font-semibold text-gray-900">{data.day}</p>
                            <p className="text-blue-600">完成率: {data.rate}%</p>
                            <p className="text-gray-500 text-xs mt-1">
                              已完成 {data.completed}/{data.total}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Bar 
                      dataKey="rate" 
                      fill="#3b82f6" 
                      radius={[6, 6, 0, 0]}
                      maxBarSize={50}
                    >
                      {(stats?.dailyCompletion || []).map((entry) => (
                        <Cell 
                          key={`cell-${entry.day}`}
                          fill={entry.rate >= 80 ? '#10b981' : entry.rate >= 50 ? '#3b82f6' : '#f59e0b'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* 颜色说明 */}
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-emerald-500" />
                  <span className="text-xs text-gray-600">≥80%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-blue-500" />
                  <span className="text-xs text-gray-600">50-79%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-amber-500" />
                  <span className="text-xs text-gray-600">&lt;50%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
