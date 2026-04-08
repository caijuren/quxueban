import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Clock, Calendar, BookOpen, Dumbbell, Star, ChevronDown, ChevronUp, Award, X, ArrowLeft, Camera, Image, Mic, ListTodo } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ChildTask {
  planId: number;
  taskId: number;
  name: string;
  category: string;
  type: string;
  timePerUnit: number;
  target?: number;
  progress?: number;
  completedToday?: boolean;
  todayStatus?: string | null;
  checkinId?: number;
  originalStatus?: string;
  currentProgress?: number;
  // 精细化记录字段
  trackingType?: 'simple' | 'numeric' | 'progress';
  trackingUnit?: string | null;
  targetValue?: number | null;
}

const typeConfig: Record<string, { icon: any; color: string; gradient: string }> = {
  '校内任务': { icon: BookOpen, color: 'bg-blue-100 text-blue-600', gradient: 'from-blue-500 to-cyan-500' },
  '阅读任务': { icon: BookOpen, color: 'bg-purple-100 text-purple-600', gradient: 'from-purple-500 to-violet-500' },
  '体育运动': { icon: Dumbbell, color: 'bg-green-100 text-green-600', gradient: 'from-emerald-500 to-teal-500' },
  '课外课程': { icon: Star, color: 'bg-orange-100 text-orange-600', gradient: 'from-orange-500 to-amber-500' },
};

export default function ChildTasks() {
  const [tasks, setTasks] = useState<ChildTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTask, setExpandedTask] = useState<number | null>(null);
  const { user } = useAuth();
  
  // 任务完成模态框状态
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<ChildTask | null>(null);
  const [completionStatus, setCompletionStatus] = useState<'completed' | 'partial' | 'postponed'>('completed');
  const [completedValue, setCompletedValue] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (user && user.role === 'child') {
      fetchTasks();
    }
  }, [user]);

  const fetchTasks = async () => {
    if (!user || user.role !== 'child') return;
    
    try {
      console.log('当前用户信息:', user);
      setLoading(true);
      const response = await apiClient.get('/plans/today');
      console.log('任务数据:', response.data);
      const { fixedTasks, flexibleTasks, makeupTasks, advanceTasks } = response.data.data;
      
      // 合并所有类型的任务
      const allTasks = [
        ...fixedTasks.map((task: any) => ({ ...task, type: 'fixed' })),
        ...flexibleTasks.map((task: any) => ({ ...task, type: 'flexible' })),
        ...makeupTasks.map((task: any) => ({ ...task, type: 'makeup' })),
        ...advanceTasks.map((task: any) => ({ ...task, type: 'advance' })),
      ];
      
      console.log('合并后的任务:', allTasks);
      setTasks(allTasks);
    } catch (error) {
      console.error('获取任务失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCompletionModal = (task: ChildTask) => {
    setCurrentTask(task);
    setCompletionStatus('completed');
    setCompletedValue(0);
    setNotes('');
    setCompletionModalOpen(true);
  };

  const handleTaskCompletion = async () => {
    if (!currentTask) return;

    try {
      // 调用后端API更新任务状态
      await apiClient.post('/plans/checkin', {
        taskId: currentTask.taskId,
        planId: currentTask.planId,
        status: completionStatus,
        value: 1,
        completedValue: completionStatus !== 'postponed' ? completedValue : null,
        notes: notes || null
      });

      // 关闭模态框
      setCompletionModalOpen(false);
      
      // 刷新任务列表
      fetchTasks();
      
      toast.success('任务完成记录已提交');
    } catch (error) {
      console.error('更新任务状态失败:', error);
      toast.error('提交失败，请重试');
    }
  };

  const toggleExpandTask = (planId: number) => {
    setExpandedTask(expandedTask === planId ? null : planId);
  };

  const getTaskName = (task: ChildTask) => {
    return task.name;
  };

  const getTaskDuration = (task: ChildTask) => {
    return task.timePerUnit;
  };

  const getTaskTypeConfig = (category: string) => {
    return typeConfig[category] || { icon: BookOpen, color: 'bg-gray-100 text-gray-600', gradient: 'from-gray-500 to-gray-600' };
  };

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.completedToday).length;
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  if (!user || user.role !== 'child') {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500">
        <CheckCircle2 className="w-16 h-16 mb-4 opacity-30" />
        <h2 className="text-xl font-semibold mb-2">请以孩子身份登录</h2>
        <p className="text-center max-w-md">只有孩子账号才能查看和完成任务</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ListTodo className="w-7 h-7 text-purple-500" />
            我的任务
          </h1>
          <p className="text-gray-500 mt-1">完成今日任务，获得成就感！</p>
        </div>
        <Button 
          variant="default"
          className="rounded-xl h-11 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg shadow-purple-500/25"
          onClick={fetchTasks}
        >
          刷新任务
        </Button>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-3xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              今日进度
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">完成率</span>
                <span className="text-sm font-bold text-purple-600">{Math.round(completionRate)}%</span>
              </div>
              <Progress value={completionRate} className="h-2 bg-gray-200" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>已完成 {completedTasks} 项</span>
                <span>共 {totalTasks} 项任务</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-3xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-4 pt-6 px-6">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <ListTodo className="size-4 text-white" />
              </div>
              任务列表
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="border-0 shadow-md">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-200 rounded animate-pulse" />
                          <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4" />
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>暂无任务</p>
                <p className="text-sm mt-1">家长还没有为你分配任务</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.map(task => {
                  const TypeIcon = getTaskTypeConfig(task.category).icon;
                  const typeColor = getTaskTypeConfig(task.category).color;
                  const typeGradient = getTaskTypeConfig(task.category).gradient;
                  
                  return (
                    <motion.div
                      key={task.planId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300 rounded-2xl overflow-hidden">
                        <CardContent className="p-0">
                          <div 
                            className="flex items-center justify-between p-5 cursor-pointer"
                            onClick={() => toggleExpandTask(task.planId)}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${typeGradient} flex items-center justify-center text-white`}>
                                <TypeIcon className="w-6 h-6" />
                              </div>
                              <div className="flex-1">
                                <h3 className="font-semibold text-gray-900">{getTaskName(task)}</h3>
                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{getTaskDuration(task)}分钟</span>
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>{task.type}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Button
                                variant={task.completedToday ? "default" : "outline"}
                                size="icon"
                                className={`w-10 h-10 rounded-full ${task.completedToday ? 'bg-green-500 hover:bg-green-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!task.completedToday) {
                                    openCompletionModal(task);
                                  }
                                }}
                              >
                                <CheckCircle2 className={`w-5 h-5 ${task.completedToday ? '' : 'text-gray-400'}`} />
                              </Button>
                              {expandedTask === task.planId ? (
                                <ChevronUp className="w-5 h-5 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                          </div>
                          {expandedTask === task.planId && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3 }}
                            >
                              <Separator />
                              <div className="p-5 space-y-4">
                                <div className="space-y-2">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">本周进度</span>
                                    <span className="font-medium text-purple-600">{task.progress || 0}/{task.target || 0}</span>
                                  </div>
                                  <Progress value={(task.progress || 0) / (task.target || 1) * 100} className="h-2 bg-gray-200" />
                                </div>
                                <div className="text-sm text-gray-600">
                                  <p><strong>任务类型：</strong>{task.category}</p>
                                  <p><strong>目标：</strong>本周完成 {task.target || 1} 次</p>
                                  {task.todayStatus && <p><strong>今日状态：</strong>{task.todayStatus}</p>}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* 任务完成模态框 */}
      <Dialog open={completionModalOpen} onOpenChange={setCompletionModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto rounded-3xl border-0 shadow-2xl">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-purple-500" />
              {currentTask?.trackingType === 'numeric' ? '提交完成记录' : 
               currentTask?.trackingType === 'progress' ? '更新进度' : 
               '完成任务'}
            </DialogTitle>
          </DialogHeader>
          
          {currentTask && (
            <div className="space-y-6 py-4">
              {/* 任务信息 */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">{currentTask.name}</h3>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{currentTask.timePerUnit}分钟</span>
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{currentTask.type}</span>
                </div>
              </div>

              {/* 状态选择 */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700">完成状态</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={completionStatus === 'completed' ? 'default' : 'outline'}
                    onClick={() => setCompletionStatus('completed')}
                    className={`rounded-xl ${completionStatus === 'completed' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    全部完成
                  </Button>
                  <Button
                    variant={completionStatus === 'partial' ? 'default' : 'outline'}
                    onClick={() => setCompletionStatus('partial')}
                    className={`rounded-xl ${completionStatus === 'partial' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    部分完成
                  </Button>
                  <Button
                    variant={completionStatus === 'postponed' ? 'default' : 'outline'}
                    onClick={() => setCompletionStatus('postponed')}
                    className={`rounded-xl ${completionStatus === 'postponed' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    推迟
                  </Button>
                </div>
              </div>

              {/* 动态表单：根据 tracking_type 渲染不同的输入组件 */}
              {completionStatus !== 'postponed' && (
                <>
                  {/* numeric 类型：显示引导问题 + 数字输入框 + 单位 + 进度提示 */}
                  {currentTask.trackingType === 'numeric' && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-gray-700">
                        本次完成了多少{currentTask.trackingUnit || '个'}？
                      </Label>
                      <div className="flex gap-3">
                        <Input
                          type="number"
                          value={completedValue || ''}
                          onChange={(e) => setCompletedValue(parseInt(e.target.value) || 0)}
                          min={0}
                          placeholder={`请输入数量`}
                          className="flex-1 rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        {currentTask.trackingUnit && (
                          <div className="flex items-center px-4 bg-gray-100 rounded-xl text-gray-600">
                            {currentTask.trackingUnit}
                          </div>
                        )}
                      </div>
                      {currentTask.targetValue && (
                        <div className="text-sm text-purple-600">
                          目标：{currentTask.targetValue}{currentTask.trackingUnit} · 已完成 {completedValue}{currentTask.trackingUnit}
                          {completedValue > 0 && currentTask.targetValue > 0 && (
                            <span className="ml-2">
                              ({Math.round((completedValue / currentTask.targetValue) * 100)}%)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* progress 类型：显示进度滑块 + 进度提示 */}
                  {currentTask.trackingType === 'progress' && (
                    <div className="space-y-4">
                      <Label className="text-sm font-medium text-gray-700">
                        当前进度是多少？
                      </Label>
                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={completedValue}
                            onChange={(e) => setCompletedValue(parseInt(e.target.value))}
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                          />
                          <span className="text-lg font-semibold text-purple-600 w-16 text-right">
                            {completedValue}%
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300"
                            style={{ width: `${completedValue}%` }}
                          />
                        </div>
                        {currentTask.targetValue && (
                          <div className="text-sm text-gray-500">
                            目标：{currentTask.targetValue}{currentTask.trackingUnit || '个'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* simple 类型：显示可选的文本输入框 */}
                  {currentTask.trackingType === 'simple' && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-gray-700">有什么想分享的吗？（可选）</Label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="记录下你的学习心得、遇到的问题或有趣的想法..."
                        rows={3}
                        className="w-full rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent p-3"
                      />
                    </div>
                  )}

                  {/* numeric/progress 类型：显示可选的备注输入 */}
                  {(currentTask.trackingType === 'numeric' || currentTask.trackingType === 'progress') && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-gray-700">备注（可选）</Label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="有什么想补充的吗？"
                        rows={2}
                        className="w-full rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent p-3"
                      />
                    </div>
                  )}

                  {/* 证据上传：以按钮形式展示 */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-gray-700">添加证据（可选）</Label>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1 rounded-xl border-dashed border-2 hover:border-purple-500 hover:bg-purple-50"
                        onClick={() => toast.info('拍照功能开发中')}
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        拍照
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 rounded-xl border-dashed border-2 hover:border-purple-500 hover:bg-purple-50"
                        onClick={() => toast.info('相册功能开发中')}
                      >
                        <Image className="w-4 h-4 mr-2" />
                        相册
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 rounded-xl border-dashed border-2 hover:border-purple-500 hover:bg-purple-50"
                        onClick={() => toast.info('录音功能开发中')}
                      >
                        <Mic className="w-4 h-4 mr-2" />
                        录音
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* 提交按钮 */}
              <Button
                onClick={handleTaskCompletion}
                className="w-full rounded-xl h-11 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg shadow-purple-500/25"
              >
                {currentTask.trackingType === 'numeric' ? '提交完成记录' : 
                 currentTask.trackingType === 'progress' ? '更新进度' : 
                 '提交完成状态'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
