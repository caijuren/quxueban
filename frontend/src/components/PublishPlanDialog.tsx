import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Send, Check, Clock, AlertCircle, RefreshCw, Trash2, CalendarOff } from 'lucide-react';
import { format, startOfWeek, addWeeks, isWeekend } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

interface Child {
  id: number;
  name: string;
  avatar?: string;
}

interface Holiday {
  date: string;
  name: string;
  isHoliday: boolean;
}

interface PublishPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  onSuccess?: () => void;
}

const RULE_OPTIONS = [
  { id: 'daily', label: '每日任务', desc: '每天1次，周一至周日（7天）', frequency: 7 },
  { id: 'school', label: '在校日任务', desc: '每周4次，周一/二/四/五（避开周三）', frequency: 4 },
  { id: 'flexible', label: '灵活周任务', desc: '智能分配3次，周一至周五均匀分散', frequency: 3 },
  { id: 'weekend', label: '周末任务', desc: '每周2次，周六和周日', frequency: 2 },
];

const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// 中国节假日 API（使用 Timor Tech API）
async function fetchHolidays(startDate: Date, _endDate: Date): Promise<Holiday[]> {
  try {
    const year = startDate.getFullYear();
    const { data } = await apiClient.get(`/holidays/${year}`);
    return data.data || [];
  } catch (error) {
    console.warn('获取节假日失败，使用本地规则', error);
    return [];
  }
}

// 本地节假日判断（备用）
function isLocalHoliday(date: Date): { isHoliday: boolean; name?: string } {
  const _month = date.getMonth() + 1;
  const _day = date.getDate();
  
  // 2025年法定节假日（简化版）
  const holidays2025: Record<string, string> = {
    '2025-01-01': '元旦',
    '2025-01-28': '春节',
    '2025-01-29': '春节',
    '2025-01-30': '春节',
    '2025-01-31': '春节',
    '2025-02-01': '春节',
    '2025-02-02': '春节',
    '2025-02-03': '春节',
    '2025-04-04': '清明节',
    '2025-04-05': '清明节',
    '2025-04-06': '清明节',
    '2025-05-01': '劳动节',
    '2025-05-02': '劳动节',
    '2025-05-03': '劳动节',
    '2025-05-04': '劳动节',
    '2025-05-05': '劳动节',
    '2025-05-31': '端午节',
    '2025-06-01': '端午节',
    '2025-06-02': '端午节',
    '2025-10-01': '国庆节',
    '2025-10-02': '国庆节',
    '2025-10-03': '国庆节',
    '2025-10-04': '国庆节',
    '2025-10-05': '国庆节',
    '2025-10-06': '国庆节',
    '2025-10-07': '国庆节',
    '2025-10-08': '国庆节',
  };
  
  const dateStr = format(date, 'yyyy-MM-dd');
  if (holidays2025[dateStr]) {
    return { isHoliday: true, name: holidays2025[dateStr] };
  }
  
  return { isHoliday: false };
}

export function PublishPlanDialog({ open, onOpenChange, tasks, onSuccess }: PublishPlanDialogProps) {
  const [step, setStep] = useState(1);
  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);
  const [selectedChildren, setSelectedChildren] = useState<number[]>([]);
  const [taskRules, setTaskRules] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    tasks.forEach(t => { initial[t.id] = t.scheduleRule || 'daily'; });
    return initial;
  });
  const [batchRule, setBatchRule] = useState<string>(() => {
    const counts: Record<string, number> = {};
    tasks.forEach(t => { const r = t.scheduleRule || 'daily'; counts[r] = (counts[r] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'daily';
  });
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [skipHolidays, setSkipHolidays] = useState(true);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  const { data: children = [] } = useQuery({
    queryKey: ['children'],
    queryFn: async () => {
      const res = await apiClient.get('/auth/children');
      return res.data.data || [];
    },
  });

  // 获取下周的节假日
  useEffect(() => {
    if (open && step === 3 && skipHolidays) {
      const nextWeekStart = startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 });
      const nextWeekEnd = new Date(nextWeekStart);
      nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);
      
      fetchHolidays(nextWeekStart, nextWeekEnd).then(data => {
        setHolidays(data);
        const holidaySet = new Set(data.filter(h => h.isHoliday).map(h => h.date));
        setHolidayDates(holidaySet);
      });
    }
  }, [open, step, skipHolidays]);

  const publishMutation = useMutation({
    mutationFn: async () => {
      const nextWeek = startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 });
      const weekNo = format(nextWeek, 'yyyy-ww');
      
      const rules: Record<number, string> = {};
      selectedTasks.forEach(taskId => {
        const task = tasks.find(t => t.id === taskId);
        const currentRule = taskRules[taskId] || batchRule;
        if (task && currentRule !== (task.scheduleRule || 'daily')) {
          rules[taskId] = currentRule;
        }
      });

      await apiClient.post('/tasks/publish', {
        childIds: selectedChildren,
        weekNo,
        taskRules: rules,
        skipHolidays,
        holidayDates: Array.from(holidayDates),
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
    setSelectedChildren([]);
    setTaskRules({});
    onOpenChange(false);
  };

  const toggleTask = (taskId: number) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  // 任务一：删除任务（从已选列表移除，回归待选状态）
  const removeTask = (taskId: number) => {
    setSelectedTasks(prev => prev.filter(id => id !== taskId));
    // 清除该任务的自定义规则，回归默认
    setTaskRules(prev => {
      const newRules = { ...prev };
      delete newRules[taskId];
      return newRules;
    });
  };

  const toggleChild = (childId: number) => {
    setSelectedChildren(prev =>
      prev.includes(childId) ? prev.filter(id => id !== childId) : [...prev, childId]
    );
  };

  const selectAllTasks = () => setSelectedTasks(tasks.map(t => t.id));
  const clearTasks = () => setSelectedTasks([]);

  const canProceed = () => {
    if (step === 1) return selectedTasks.length > 0;
    if (step === 2) return selectedChildren.length > 0;
    return true;
  };

  const handlePublish = () => {
    publishMutation.mutate();
  };

  // 任务二：智能排期增加避开节假日逻辑
  const previewSchedule = useMemo(() => {
    if (selectedTasks.length === 0) return [];
    
    const schedule: { day: string; date: string; tasks: string[]; overloaded: boolean; isHoliday: boolean; holidayName?: string }[] = [];
    const dayMinutes = [0, 0, 0, 0, 0, 0, 0];

    const nextWeekStart = startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 });

    // 计算每天的可用状态
    const dayAvailable: boolean[] = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(nextWeekStart);
      currentDate.setDate(currentDate.getDate() + i);
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      
      const localHoliday = isLocalHoliday(currentDate);
      const isApiHoliday = holidayDates.has(dateStr);
      const isWeekendDay = isWeekend(currentDate);
      
      // 如果开启了跳过节假日，检查是否需要跳过
      if (skipHolidays) {
        const shouldSkip = isApiHoliday || localHoliday.isHoliday;
        dayAvailable[i] = !shouldSkip;
      } else {
        dayAvailable[i] = true;
      }
    }

    // 分配任务时间
    const shuffledFlexible: { taskId: number; time: number }[] = [];
    selectedTasks.forEach(taskId => {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      const rule = taskRules[taskId] || batchRule;
      
      if (rule === 'daily') {
        [0,1,2,3,4,5,6].forEach(d => {
          if (dayAvailable[d]) dayMinutes[d] += task.timePerUnit;
        });
      }
      else if (rule === 'school') {
        [1,2,4,5].forEach(d => {
          if (dayAvailable[d]) dayMinutes[d] += task.timePerUnit;
        });
      }
      else if (rule === 'flexible') {
        shuffledFlexible.push({ taskId, time: task.timePerUnit });
      }
      else if (rule === 'weekend') {
        [0,6].forEach(d => {
          if (dayAvailable[d]) dayMinutes[d] += task.timePerUnit;
        });
      }
    });

    // 分配灵活任务（避开不可用日期）
    shuffledFlexible.sort((a, b) => ((a.taskId * 7 + shuffleSeed) % 5) - ((b.taskId * 7 + shuffleSeed) % 5));
    const weekDays5 = [1, 2, 3, 4, 5].filter(d => dayAvailable[d]);
    shuffledFlexible.forEach(({ time }) => {
      if (weekDays5.length > 0) {
        const minDay = weekDays5.reduce((a, b) => dayMinutes[a] <= dayMinutes[b] ? a : b);
        dayMinutes[minDay] += time;
      }
    });

    // 生成预览
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(nextWeekStart);
      currentDate.setDate(currentDate.getDate() + i);
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      
      const localHoliday = isLocalHoliday(currentDate);
      const isApiHoliday = holidayDates.has(dateStr);
      const isHolidayDay = localHoliday.isHoliday || isApiHoliday;

      const dayTasks: string[] = [];
      selectedTasks.forEach(taskId => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        const rule = taskRules[taskId] || batchRule;
        let allowedDays: number[] = [];
        if (rule === 'daily') allowedDays = [0, 1, 2, 3, 4, 5, 6];
        else if (rule === 'school') allowedDays = [1, 2, 4, 5];
        else if (rule === 'flexible') allowedDays = [1, 2, 3, 4, 5];
        else if (rule === 'weekend') allowedDays = [0, 6];
        
        // 只有当天可用且在允许日期内才添加任务
        if (allowedDays.includes(i) && dayAvailable[i]) {
          dayTasks.push(task.name);
        }
      });

      schedule.push({
        day: weekDays[i],
        date: dateStr,
        tasks: dayTasks,
        overloaded: dayMinutes[i] > 120,
        isHoliday: isHolidayDay,
        holidayName: localHoliday.name || holidays.find(h => h.date === dateStr)?.name,
      });
    }
    return schedule;
  }, [selectedTasks, taskRules, batchRule, tasks, shuffleSeed, skipHolidays, holidayDates, holidays]);

  // 统计信息
  const stats = useMemo(() => {
    const totalTasks = selectedTasks.length;
    const totalMinutes = selectedTasks.reduce((sum, taskId) => {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return sum;
      const rule = taskRules[taskId] || batchRule;
      let weeklyCount = 7;
      if (rule === 'school') weeklyCount = 4;
      else if (rule === 'flexible') weeklyCount = 3;
      else if (rule === 'weekend') weeklyCount = 2;
      return sum + task.timePerUnit * weeklyCount;
    }, 0);
    
    const holidayCount = previewSchedule.filter(d => d.isHoliday).length;
    const skippedDays = previewSchedule.filter(d => d.isHoliday || d.tasks.length === 0).length;
    
    return { totalTasks, totalMinutes, holidayCount, skippedDays };
  }, [selectedTasks, taskRules, batchRule, tasks, previewSchedule]);

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
              {['选择任务', '设置规则', '预览发布'].map((s, i) => (
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
            {/* Step 1: Select Tasks */}
            {step === 1 && (
              <motion.div key='step1' initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className='flex gap-6'>
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
                  <h3 className='font-medium text-gray-700 mb-3'>已选任务（{selectedTasks.length}个）</h3>
                  <div className='space-y-2 max-h-[300px] overflow-y-auto'>
                    {selectedTasks.length === 0 ? (
                      <p className='text-sm text-gray-400 text-center py-8'>请选择任务</p>
                    ) : (
                      selectedTasks.map(taskId => {
                        const task = tasks.find(t => t.id === taskId);
                        if (!task) return null;
                        return (
                          <div key={taskId} className='flex items-center justify-between p-2 bg-gray-50 rounded-lg group'>
                            <span className='text-sm text-gray-700 truncate flex-1'>{task.name}</span>
                            {/* 任务一：删除按钮 */}
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
                        );
                      })
                    )}
                  </div>
                  {selectedTasks.length > 0 && (
                    <p className='text-xs text-gray-400 mt-2 text-center'>共 {stats.totalMinutes} 分钟/周</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 2: Set Rules */}
            {step === 2 && (
              <motion.div key='step2' initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className='mb-6'>
                  <h3 className='font-medium text-gray-700 mb-3'>批量设置规则</h3>
                  <div className='grid grid-cols-2 gap-3'>
                    {RULE_OPTIONS.map(rule => (
                      <button key={rule.id} onClick={() => setBatchRule(rule.id)}
                        className={cn('p-4 rounded-xl border-2 text-left transition-all',
                          batchRule === rule.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                        )}>
                        <div className='font-medium text-gray-900'>{rule.label}</div>
                        <div className='text-sm text-gray-500 mt-1'>{rule.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* 任务二：节假日开关 */}
                <div className='mb-6 p-4 bg-amber-50 rounded-xl border border-amber-200'>
                  <label className='flex items-center gap-3 cursor-pointer'>
                    <Checkbox 
                      checked={skipHolidays} 
                      onCheckedChange={(checked) => setSkipHolidays(checked as boolean)} 
                    />
                    <div className='flex-1'>
                      <span className='font-medium text-gray-900'>避开法定节假日</span>
                      <p className='text-sm text-gray-500 mt-0.5'>开启后，任务不会安排在法定节假日当天</p>
                    </div>
                    <CalendarOff className='w-5 h-5 text-amber-500' />
                  </label>
                </div>
                
                <div className='mb-4'>
                  <h3 className='font-medium text-gray-700 mb-2'>已选任务规则 <span className='text-xs text-gray-400 font-normal'>（点击可修改，悬停显示删除）</span></h3>
                  <div className='space-y-1.5 max-h-[200px] overflow-y-auto'>
                    {selectedTasks.map(taskId => {
                      const task = tasks.find(t => t.id === taskId);
                      if (!task) return null;
                      const currentRule = taskRules[taskId] || task.scheduleRule || 'daily';
                      return (
                        <div key={taskId} className='flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors'>
                          <span className='text-sm text-gray-700 flex-1 truncate'>{task.name}</span>
                          <div className='flex items-center gap-2'>
                            <select value={currentRule} onChange={(e) => setTaskRules(prev => ({ ...prev, [taskId]: e.target.value }))}
                              className='px-2 py-1 border border-gray-200 rounded-lg bg-white text-xs focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 outline-none'>
                              {RULE_OPTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                            </select>
                            {/* 任务一：删除按钮 */}
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
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className='mb-6'>
                  <h3 className='font-medium text-gray-700 mb-3'>选择发布对象</h3>
                  <div className='flex gap-3'>
                    {children.map((child: Child) => (
                      <button key={child.id} onClick={() => toggleChild(child.id)}
                        className={cn('flex items-center gap-3 p-3 rounded-xl border-2 transition-all',
                          selectedChildren.includes(child.id) ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                        )}>
                        <Avatar className='w-10 h-10'><AvatarImage src={child.avatar} /><AvatarFallback>{child.name[0]}</AvatarFallback></Avatar>
                        <span className='font-medium'>{child.name}</span>
                        {selectedChildren.includes(child.id) && <Check className='w-5 h-5 text-purple-500' />}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Preview */}
            {step === 3 && (
              <motion.div key='step3' initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className='flex items-center justify-between mb-3'>
                  <h3 className='font-medium text-gray-700'>下周预览（{format(startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }), 'MM月dd日', { locale: zhCN })} 起）</h3>
                  <button onClick={() => setShuffleSeed(s => s + 1)} className='flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700 font-medium px-3 py-1.5 rounded-lg hover:bg-purple-50 transition-colors'>
                    <RefreshCw className='w-4 h-4' />
                    重新生成排期
                  </button>
                </div>
                
                {/* 任务二：节假日提示 */}
                {skipHolidays && stats.holidayCount > 0 && (
                  <div className='mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-center gap-2'>
                    <CalendarOff className='w-4 h-4 text-amber-600' />
                    <span className='text-sm text-amber-700'>
                      本周有 <strong>{stats.holidayCount}</strong> 天法定节假日，已自动跳过
                    </span>
                  </div>
                )}
                
                <div className='grid grid-cols-7 gap-2'>
                  {previewSchedule.map((day, i) => (
                    <div key={i} className={cn(
                      'p-3 rounded-xl border-2 min-h-[120px] transition-all',
                      day.isHoliday ? 'border-amber-300 bg-amber-50' :
                      day.overloaded ? 'border-amber-300 bg-amber-50' : 
                      'border-gray-200'
                    )}>
                      <div className='flex items-center justify-between mb-2'>
                        <span className='font-medium text-gray-900 text-sm'>{day.day}</span>
                        {day.isHoliday && (
                          <Badge variant='outline' className='text-xs bg-amber-100 text-amber-700 border-amber-300'>
                            {day.holidayName || '假日'}
                          </Badge>
                        )}
                      </div>
                      
                      {/* 任务二：跳过节假日提示 */}
                      {day.isHoliday ? (
                        <div className='text-xs text-amber-600 flex items-center justify-center gap-1 py-4'>
                          <CalendarOff className='w-3 h-3' />
                          休息日
                        </div>
                      ) : (
                        <>
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
                            {day.tasks.length === 0 && !day.isHoliday && (
                              <div className='text-xs text-gray-400 text-center py-4'>无任务</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className='mt-4 p-4 bg-blue-50 rounded-xl flex items-start gap-3'>
                  <Clock className='w-5 h-5 text-blue-500 mt-0.5' />
                  <div className='text-sm text-blue-700'>
                    <p>计划发布后，系统将自动分配至孩子的每日待办列表。</p>
                    {skipHolidays && <p className='mt-1'>已开启「避开节假日」，任务不会安排在法定节假日。</p>}
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