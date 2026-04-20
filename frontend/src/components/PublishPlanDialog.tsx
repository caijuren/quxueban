import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Send, Check, Clock, AlertCircle, RefreshCw, Trash2, Settings, CalendarOff, User } from 'lucide-react';
import { format, startOfWeek, addWeeks } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { toast } from 'sonner';

interface Task {
  id: number;
  name: string;
  category: string;
  timePerUnit: number;
  scheduleRule?: string;
  tags: { subject?: string | string[]; participation?: string; difficulty?: string };
}

interface PublishPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  selectedChildId: number;
  selectedChildName?: string;
  onSuccess?: () => void;
}

const RULE_OPTIONS = [
  { id: 'daily', label: '每日任务', desc: '每天1次，周一至周日（7天）', frequency: 7 },
  { id: 'school', label: '在校日任务', desc: '每周4次，周一/二/四/五（避开周三）', frequency: 4 },
  { id: 'flexible', label: '智能分配', desc: '智能分配3次，周一至周五均匀分散', frequency: 3 },
  { id: 'weekend', label: '周末任务', desc: '每周2次，周六和周日', frequency: 2 },
];

const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export function PublishPlanDialog({ open, onOpenChange, tasks, selectedChildId, selectedChildName, onSuccess }: PublishPlanDialogProps) {
  const [step, setStep] = useState(1);
  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);
  const [taskRules, setTaskRules] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    tasks.forEach(t => { initial[t.id] = t.scheduleRule || 'daily'; });
    return initial;
  });
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState<string>('next');
  const [customWeekStart, setCustomWeekStart] = useState<Date>(startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }));
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [skipHolidays, setSkipHolidays] = useState(true);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      const initialRules: Record<number, string> = {};
      tasks.forEach(t => { initialRules[t.id] = t.scheduleRule || 'daily'; });
      setTaskRules(initialRules);
    }
  }, [open, tasks]);

  useEffect(() => {
    setTaskRules(prev => {
      const newRules = { ...prev };
      let changed = false;
      selectedTasks.forEach(taskId => {
        if (!newRules[taskId]) {
          const task = tasks.find(t => t.id === taskId);
          if (task) {
            newRules[taskId] = task.scheduleRule || 'daily';
            changed = true;
          }
        }
      });
      return changed ? newRules : prev;
    });
  }, [selectedTasks, tasks]);

  const getSelectedWeekStart = () => {
    if (selectedWeek === 'this') {
      return startOfWeek(new Date(), { weekStartsOn: 1 });
    } else if (selectedWeek === 'next') {
      return startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 });
    } else {
      return customWeekStart;
    }
  };

  const publishMutation = useMutation({
    mutationFn: async () => {
      const selectedWeekStart = getSelectedWeekStart();
      const weekNo = format(selectedWeekStart, 'yyyy-ww');

      const rules: Record<number, string> = {};
      selectedTasks.forEach(taskId => {
        const task = tasks.find(t => t.id === taskId);
        const currentRule = taskRules[taskId] || task?.scheduleRule || 'daily';
        rules[taskId] = currentRule;
      });

      await apiClient.post('/tasks/publish', {
        childIds: [selectedChildId],
        weekNo,
        selectedTaskIds: selectedTasks,
        taskRules: rules,
        skipHolidays,
      });
    },
    onSuccess: () => {
      toast.success('下周计划发布成功！');
      queryClient.invalidateQueries({ queryKey: ['weekly-plan'] });
      handleClose();
      onSuccess?.();
    },
    onError: (e: any) => toast.error(getErrorMessage(e)),
  });

  const handleClose = () => {
    setStep(1);
    setSelectedTasks([]);
    setTaskRules({});
    setShowAdvancedSettings(false);
    setSkipHolidays(true);
    onOpenChange(false);
  };

  const toggleTask = (taskId: number) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const removeTask = (taskId: number) => {
    setSelectedTasks(prev => prev.filter(id => id !== taskId));
    setTaskRules(prev => {
      const newRules = { ...prev };
      delete newRules[taskId];
      return newRules;
    });
  };

  const selectAllTasks = () => setSelectedTasks(tasks.map(t => t.id));
  const clearTasks = () => setSelectedTasks([]);

  const canProceed = () => {
    if (step === 1) return true;
    if (step === 2) return selectedTasks.length > 0;
    return true;
  };

  const handlePublish = () => {
    if (!selectedChildId) {
      toast.error('请先选择当前孩子');
      return;
    }
    publishMutation.mutate();
  };

  const previewSchedule = useMemo(() => {
    if (selectedTasks.length === 0) return [];
    
    const schedule: { day: string; date: string; tasks: string[]; overloaded: boolean }[] = [];
    const dayMinutes = [0, 0, 0, 0, 0, 0, 0];

    const selectedWeekStart = getSelectedWeekStart();

    selectedTasks.forEach(taskId => {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      const rule = taskRules[taskId] || task?.scheduleRule || 'daily';
      
      if (rule === 'daily') {
        [0, 1, 2, 3, 4, 5, 6].forEach(d => dayMinutes[d] += task.timePerUnit);
      }
      else if (rule === 'school') {
        [0, 1, 3, 4].forEach(d => dayMinutes[d] += task.timePerUnit);
      }
      else if (rule === 'flexible') {
      }
      else if (rule === 'weekend') {
        [5, 6].forEach(d => dayMinutes[d] += task.timePerUnit);
      }
    });

    const shuffledFlexible: { taskId: number; time: number }[] = [];
    selectedTasks.forEach(taskId => {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      const rule = taskRules[taskId] || task?.scheduleRule || 'daily';
      if (rule === 'flexible') {
        shuffledFlexible.push({ taskId, time: task.timePerUnit });
      }
    });

    shuffledFlexible.sort((a, b) => ((a.taskId * 7 + shuffleSeed) % 5) - ((b.taskId * 7 + shuffleSeed) % 5));
    const weekDays5 = [0, 1, 2, 3, 4];
    shuffledFlexible.forEach(({ time }) => {
      if (weekDays5.length > 0) {
        const minDay = weekDays5.reduce((a, b) => dayMinutes[a] <= dayMinutes[b] ? a : b);
        dayMinutes[minDay] += time;
      }
    });

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(selectedWeekStart);
      currentDate.setDate(currentDate.getDate() + i);
      const dateStr = format(currentDate, 'yyyy-MM-dd');

      const dayTasks: string[] = [];
      selectedTasks.forEach(taskId => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        const rule = taskRules[taskId] || task?.scheduleRule || 'daily';
        let allowedDays: number[] = [];
        if (rule === 'daily') allowedDays = [0, 1, 2, 3, 4, 5, 6];
        else if (rule === 'school') allowedDays = [0, 1, 3, 4];
        else if (rule === 'flexible') allowedDays = [0, 1, 2, 3, 4];
        else if (rule === 'weekend') allowedDays = [5, 6];
        
        if (allowedDays.includes(i)) {
          dayTasks.push(task.name);
        }
      });

      schedule.push({
        day: weekDays[i],
        date: dateStr,
        tasks: dayTasks,
        overloaded: dayMinutes[i] > 120,
      });
    }
    return schedule;
  }, [selectedTasks, taskRules, tasks, shuffleSeed, skipHolidays]);

  const stats = useMemo(() => {
    const totalTasks = selectedTasks.length;
    const totalMinutes = selectedTasks.reduce((sum, taskId) => {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return sum;
      const rule = taskRules[taskId] || task?.scheduleRule || 'daily';
      let weeklyCount = 7;
      if (rule === 'school') weeklyCount = 4;
      else if (rule === 'flexible') weeklyCount = 3;
      else if (rule === 'weekend') weeklyCount = 2;
      return sum + task.timePerUnit * weeklyCount;
    }, 0);
    
    return { totalTasks, totalMinutes };
  }, [selectedTasks, taskRules, tasks]);

  if (!open) return null;

  return (
    <div className='fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className='bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden'
      >
        {/* Header */}
        <div className='px-6 py-5 bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-between'>
          <div>
            <h2 className='text-xl font-semibold text-white'>发布下周学习计划</h2>
            <div className='flex items-center gap-2 mt-2'>
              {['选择时间', '选择任务', '预览发布'].map((s, i) => (
                <div key={i} className='flex items-center'>
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                    step > i + 1 ? 'bg-white text-purple-600' : step === i + 1 ? 'bg-white text-purple-600' : 'bg-white/30 text-white'
                  )}>
                    {step > i + 1 ? <Check className='w-4 h-4' /> : i + 1}
                  </div>
                  <span className={cn('ml-1 text-sm', step === i + 1 ? 'text-white' : 'text-white/70')}>{s}</span>
                  {i < 2 && <ChevronRight className='w-4 h-4 mx-2 text-white/50' />}
                </div>
              ))}
            </div>
          </div>
          <Button variant='ghost' onClick={handleClose} className='text-white/80 hover:text-white hover:bg-white/20'>✕</Button>
        </div>

        {/* Content */}
        <div className='p-6 pb-20 min-h-[400px] max-h-[60vh] overflow-y-auto'>
          <AnimatePresence mode='wait'>
            {/* Step 1: 选择时间 */}
            {step === 1 && (
              <motion.div key='step1' initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className='flex items-center justify-center min-h-[320px]'>
                <div className='w-full max-w-2xl'>
                  <div className='grid grid-cols-3 gap-4'>
                    <button 
                      onClick={() => setSelectedWeek('this')} 
                      className={cn('p-6 rounded-xl border-2 text-left transition-all', 
                        selectedWeek === 'this' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className='text-3xl mb-2'>📅</div>
                      <div className='font-semibold text-gray-900 mb-1'>本周</div>
                      <div className='text-sm text-gray-500'>
                        {format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MM月dd日', { locale: zhCN })} - {format(addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1), 'MM月dd日', { locale: zhCN })}
                      </div>
                    </button>
                    <button 
                      onClick={() => setSelectedWeek('next')} 
                      className={cn('p-6 rounded-xl border-2 text-left transition-all', 
                        selectedWeek === 'next' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className='text-3xl mb-2'>📆</div>
                      <div className='font-semibold text-gray-900 mb-1'>下周</div>
                      <div className='text-sm text-gray-500'>
                        {format(startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }), 'MM月dd日', { locale: zhCN })} - {format(addWeeks(startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }), 1), 'MM月dd日', { locale: zhCN })}
                      </div>
                    </button>
                    <button 
                      onClick={() => setSelectedWeek('custom')} 
                      className={cn('p-6 rounded-xl border-2 text-left transition-all', 
                        selectedWeek === 'custom' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className='text-3xl mb-2'>🗓️</div>
                      <div className='font-semibold text-gray-900 mb-1'>自定义</div>
                      <div className='text-sm text-gray-500'>选择日期</div>
                    </button>
                  </div>
                  {selectedWeek === 'custom' && (
                    <div className='mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200'>
                      <label className='block text-sm font-medium text-gray-700 mb-2'>选择周一开始日期</label>
                      <input 
                        type='date' 
                        value={format(customWeekStart, 'yyyy-MM-dd')} 
                        onChange={(e) => setCustomWeekStart(startOfWeek(new Date(e.target.value), { weekStartsOn: 1 }))} 
                        className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 outline-none'
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 2: 选择任务 */}
            {step === 2 && (
              <motion.div key='step2' initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className='flex gap-6'>
                  <div className='flex-1'>
                    <div className='flex items-center justify-between mb-3'>
                      <h3 className='font-medium text-gray-700'>任务库（{tasks.length}个）</h3>
                      <div className='flex gap-2'>
                        <Button size='sm' variant='outline' onClick={selectAllTasks}>全选</Button>
                        <Button size='sm' variant='outline' onClick={clearTasks}>清空</Button>
                      </div>
                    </div>
                    <div className='space-y-2 max-h-[300px] overflow-y-auto'>
                      {tasks.map(task => (
                        <label key={task.id} className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                          selectedTasks.includes(task.id) ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                        )}>
                          <Checkbox checked={selectedTasks.includes(task.id)} onCheckedChange={() => toggleTask(task.id)} />
                          <div className='flex-1'>
                            <span className='font-medium text-gray-900'>{task.name}</span>
                            <div className='flex gap-1 mt-1'>
                              <Badge variant='secondary' className='text-xs'>{task.category}</Badge>
                              {task.tags?.subject && <Badge variant='outline' className='text-xs'>{Array.isArray(task.tags.subject) ? task.tags.subject[0] : task.tags.subject}</Badge>}
                            </div>
                          </div>
                          <span className='text-sm text-gray-500'>{task.timePerUnit}分钟</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className='w-64 border-l pl-6'>
                    <div className='flex items-center justify-between mb-3'>
                      <h3 className='font-medium text-gray-700'>已选任务（{selectedTasks.length}个）</h3>
                      {selectedTasks.length > 0 && (
                        <Button 
                          size='sm' 
                          variant='outline' 
                          onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                          className='gap-1.5'
                        >
                          <Settings className='w-3.5 h-3.5' />
                          高级设置
                        </Button>
                      )}
                    </div>
                    <div className='mb-3 rounded-xl border border-purple-200 bg-purple-50 px-3 py-3'>
                      <div className='flex items-center gap-2 text-sm font-medium text-gray-900'>
                        <User className='w-4 h-4 text-purple-600' />
                        发布对象：{selectedChildName || '当前孩子'}
                      </div>
                      <p className='mt-1 text-xs text-gray-500'>计划会直接发布到当前孩子，不需要额外选择。</p>
                    </div>
                    <div className='space-y-2 max-h-[300px] overflow-y-auto'>
                      {selectedTasks.length === 0 ? (
                        <p className='text-sm text-gray-400 text-center py-8'>请选择任务</p>
                      ) : (
                        selectedTasks.map(taskId => {
                          const task = tasks.find(t => t.id === taskId);
                          if (!task) return null;
                          const currentRule = taskRules[taskId] || task.scheduleRule || 'daily';
                          const ruleLabel = RULE_OPTIONS.find(r => r.id === currentRule)?.label || '每日任务';
                          return (
                            <div key={taskId} className='flex flex-col gap-1'>
                              <div className='flex items-center justify-between p-2 bg-gray-50 rounded-lg group'>
                                <span className='text-sm text-gray-700 truncate flex-1'>{task.name}</span>
                                <Button 
                                  size='sm' 
                                  variant='ghost' 
                                  className='h-6 w-6 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity' 
                                  onClick={() => removeTask(taskId)}
                                  title='移除任务'
                                >
                                  <Trash2 className='w-3.5 h-3.5' />
                                </Button>
                              </div>
                              {showAdvancedSettings ? (
                                <select 
                                  value={currentRule} 
                                  onChange={(e) => setTaskRules(prev => ({ ...prev, [taskId]: e.target.value }))}
                                  className='px-2 py-1 border border-gray-200 rounded-lg bg-white text-xs focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 outline-none w-full'
                                >
                                  {RULE_OPTIONS.map(r => (
                                    <option key={r.id} value={r.id}>{r.label}</option>
                                  ))}
                                </select>
                              ) : (
                                <div className='px-2 py-1 text-xs text-gray-500 bg-gray-100 rounded-lg'>
                                  默认规则：{ruleLabel}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                    {selectedTasks.length > 0 && (
                      <p className='text-xs text-gray-400 mt-2 text-center'>共 {stats.totalMinutes} 分钟/周</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: 预览发布 */}
            {step === 3 && (
              <motion.div key='step3' initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className='flex items-center justify-between mb-3'>
                  <h3 className='font-medium text-gray-700'>{selectedWeek === 'this' ? '本周' : selectedWeek === 'next' ? '下周' : '自定义周'}预览（{format(getSelectedWeekStart(), 'MM月dd日', { locale: zhCN })} 起）</h3>
                  <button onClick={() => setShuffleSeed(s => s + 1)} className='flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700 font-medium px-3 py-1.5 rounded-lg hover:bg-purple-50 transition-colors'>
                    <RefreshCw className='w-4 h-4' />
                    重新生成排期
                  </button>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-3 gap-3 mb-4'>
                  <div className='rounded-xl border border-gray-200 bg-gray-50 px-4 py-3'>
                    <div className='text-xs text-gray-500'>发布对象</div>
                    <div className='mt-1 text-sm font-semibold text-gray-900'>{selectedChildName || '当前孩子'}</div>
                  </div>
                  <div className='rounded-xl border border-gray-200 bg-gray-50 px-4 py-3'>
                    <div className='text-xs text-gray-500'>任务总数</div>
                    <div className='mt-1 text-sm font-semibold text-gray-900'>{stats.totalTasks} 项</div>
                  </div>
                  <div className='rounded-xl border border-gray-200 bg-gray-50 px-4 py-3'>
                    <div className='text-xs text-gray-500'>总预计时长</div>
                    <div className='mt-1 text-sm font-semibold text-gray-900'>{stats.totalMinutes} 分钟/周</div>
                  </div>
                </div>

                <div className='mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3'>
                  <label className='flex items-center gap-3 cursor-pointer'>
                    <Checkbox checked={skipHolidays} onCheckedChange={(checked) => setSkipHolidays(Boolean(checked))} />
                    <div>
                      <div className='flex items-center gap-2 text-sm font-medium text-gray-900'>
                        <CalendarOff className='w-4 h-4 text-amber-600' />
                        避开法定节假日
                      </div>
                      <p className='mt-1 text-xs text-gray-500'>当前仅避开国家法定节假日，不包含学校自定义校历或调休。</p>
                    </div>
                  </label>
                </div>
                
                <div className='grid grid-cols-7 gap-2'>
                  {previewSchedule.map((day, i) => (
                    <div key={i} className={cn(
                      'p-3 rounded-xl border-2 min-h-[120px] transition-all',
                      day.overloaded ? 'border-amber-300 bg-amber-50' : 
                      'border-gray-200'
                    )}>
                      <div className='flex items-center justify-between mb-2'>
                        <span className='font-medium text-gray-900 text-sm'>{day.day}</span>
                      </div>
                      
                      {day.overloaded && (
                        <div className='text-xs text-amber-600 flex items-center justify-center gap-1 mb-1'>
                          <AlertCircle className='w-3 h-3' />高负荷
                        </div>
                      )}
                      <div className='space-y-1'>
                        {day.tasks.slice(0, 3).map((task, j) => (
                          <div key={j} className='text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded truncate'>{task}</div>
                        ))}
                        {day.tasks.length > 3 && (
                          <div className='text-xs text-gray-400 text-center'>+{day.tasks.length - 3}个</div>
                        )}
                        {day.tasks.length === 0 && (
                          <div className='text-xs text-gray-400 text-center py-4'>无任务</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className='mt-4 p-4 bg-blue-50 rounded-xl flex items-start gap-3'>
                  <Clock className='w-5 h-5 text-blue-500 mt-0.5' />
                  <div className='text-sm text-blue-700'>
                    <p>计划发布后，系统将自动分配至孩子的每日待办列表。</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className='sticky bottom-0 px-6 py-4 bg-white border-t border-gray-200 flex justify-between shadow-[0_-2px_10px_rgba(0,0,0,0.05)] -mx-0 mt-[-16px]'>
          <Button variant='outline' onClick={step === 1 ? handleClose : () => setStep(step - 1)} className='rounded-xl px-5'>
            {step === 1 ? '取消' : '上一步'}
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}
              className='bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl px-5'>
              下一步
            </Button>
          ) : (
            <Button onClick={handlePublish} disabled={publishMutation.isPending}
              className='bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl px-5'>
              <Send className='w-4 h-4 mr-2' />
              {publishMutation.isPending ? '发布中...' : '确认发布'}
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
