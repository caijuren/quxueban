import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, BookOpen, Calculator, Dumbbell, GraduationCap, Languages, BookMarked, X, Check, Calendar, Clock, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type TaskCategory = '校内巩固' | '校内拔高' | '课外课程' | '英语阅读' | '体育运动' | '中文阅读';
type TaskType = '固定' | '灵活' | '跟随学校';
type ScheduleRule = 'daily' | 'school' | 'weekend' | 'flexible';
type DisplayCategory = '校内任务' | '课外课程' | '阅读任务' | '体育运动';

interface Task {
  id: number;
  name: string;
  category: TaskCategory;
  type: TaskType;
  timePerUnit: number;
  scheduleRule?: ScheduleRule;
  weeklyFrequency?: number;
  tags?: {
    subject?: string;
    difficulty?: string;
    parentRole?: string;
  };
  appliesTo?: number[];
}

const displayCategories: DisplayCategory[] = ['校内任务', '课外课程', '阅读任务', '体育运动'];

const schoolSubCategories: Record<string, { label: string; icon: any; gradient: string }> = {
  '校内巩固': { label: '巩固', icon: BookOpen, gradient: 'from-rose-400 to-orange-400' },
  '校内拔高': { label: '拔高', icon: Calculator, gradient: 'from-blue-400 to-cyan-400' },
};

const readingSubCategories: Record<string, { label: string; icon: any; gradient: string }> = {
  '英语阅读': { label: '英语', icon: Languages, gradient: 'from-violet-400 to-purple-400' },
  '中文阅读': { label: '中文', icon: BookMarked, gradient: 'from-pink-400 to-rose-400' },
};

const typeConfig: Record<TaskType, { label: string; gradient: string }> = {
  '固定': { label: '固定任务', gradient: 'from-orange-400 to-amber-400' },
  '灵活': { label: '灵活任务', gradient: 'from-blue-400 to-cyan-400' },
  '跟随学校': { label: '跟随学校', gradient: 'from-emerald-400 to-teal-400' }
};

const scheduleRuleConfig: Record<ScheduleRule, { label: string; description: string }> = {
  'daily': { label: '每天', description: '周一至周日' },
  'school': { label: '在校日', description: '周一至周五' },
  'weekend': { label: '周末', description: '周六、周日' },
  'flexible': { label: '灵活', description: '自定义次数' },
};

async function fetchTasks(): Promise<Task[]> {
  const r = await apiClient.get('/tasks');
  return r.data.data || [];
}
async function deleteTask(id: number): Promise<void> {
  await apiClient.delete('/tasks/' + id);
}

export default function TasksPage() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '校内巩固' as TaskCategory,
    type: '固定' as TaskType,
    timePerUnit: 30,
    scheduleRule: 'daily' as ScheduleRule,
    weeklyFrequency: 5,
  });

  const queryClient = useQueryClient();
  const { data: tasks = [], isLoading } = useQuery({ queryKey: ['tasks'], queryFn: fetchTasks });

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('删除成功');
      setDeleteDialogOpen(false);
    },
    onError: (e: any) => toast.error(getErrorMessage(e))
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const r = await apiClient.post('/tasks', data);
      return r.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('创建成功');
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(getErrorMessage(e))
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<Task> }) => {
      const r = await apiClient.put('/tasks/' + data.id, data.updates);
      return r.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('更新成功');
      setEditDialogOpen(false);
    },
    onError: (e: any) => toast.error(getErrorMessage(e))
  });

  const resetForm = () => {
    setFormData({
      name: '',
      category: '校内巩固',
      type: '固定',
      timePerUnit: 30,
      scheduleRule: 'daily',
      weeklyFrequency: 5,
    });
  };

  const handleEdit = (task: Task) => {
    setTaskToEdit(task);
    setFormData({
      name: task.name,
      category: task.category,
      type: task.type,
      timePerUnit: task.timePerUnit,
      scheduleRule: (task.scheduleRule as ScheduleRule) || 'daily',
      weeklyFrequency: task.weeklyFrequency || 5,
    });
    setEditDialogOpen(true);
  };

  const handleCreate = () => {
    if (!formData.name.trim()) {
      toast.error('请输入任务名称');
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!taskToEdit || !formData.name.trim()) {
      toast.error('请输入任务名称');
      return;
    }
    updateMutation.mutate({ id: taskToEdit.id, updates: formData });
  };

  const getCategoryTasks = (displayCat: DisplayCategory): Task[] => {
    const mapping: Record<DisplayCategory, TaskCategory[]> = {
      '校内任务': ['校内巩固', '校内拔高'],
      '课外课程': ['课外课程'],
      '阅读任务': ['英语阅读', '中文阅读'],
      '体育运动': ['体育运动'],
    };
    return tasks.filter(t => mapping[displayCat].includes(t.category));
  };

  const getSubCategoryConfig = (cat: TaskCategory) => {
    return schoolSubCategories[cat] || readingSubCategories[cat] || {
      label: cat.replace('课程', ''),
      icon: cat === '体育运动' ? Dumbbell : GraduationCap,
      gradient: 'from-emerald-400 to-teal-400'
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">任务配置</h1>
            <p className="text-gray-500 mt-1">配置学习任务和计划规则</p>
          </div>
          <Button
            onClick={() => { resetForm(); setCreateDialogOpen(true); }}
            className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            新建任务
          </Button>
        </div>

        {/* Task Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayCategories.map(displayCat => {
              const categoryTasks = getCategoryTasks(displayCat);
              return (
                <motion.div
                  key={displayCat}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-3">
                    <h2 className="text-white font-semibold">{displayCat}</h2>
                    <p className="text-white/70 text-sm">{categoryTasks.length} 个任务</p>
                  </div>
                  <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                    <AnimatePresence>
                      {categoryTasks.length === 0 ? (
                        <p className="text-gray-400 text-center py-4">暂无任务</p>
                      ) : (
                        categoryTasks.map(task => {
                          const config = getSubCategoryConfig(task.category);
                          const Icon = config.icon;
                          return (
                            <motion.div
                              key={task.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className={cn(
                                "p-3 rounded-xl border border-gray-100 bg-gray-50/50",
                                "hover:bg-gray-100/50 transition-colors group"
                              )}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center",
                                    `bg-gradient-to-br ${config.gradient}`
                                  )}>
                                    <Icon className="w-4 h-4 text-white" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900 text-sm">{task.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className={cn(
                                        "text-xs px-2 py-0.5 rounded-full",
                                        `bg-gradient-to-r ${typeConfig[task.type].gradient} text-white`
                                      )}>
                                        {typeConfig[task.type].label}
                                      </span>
                                      <span className="text-xs text-gray-500 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {task.timePerUnit}分钟
                                      </span>
                                    </div>
                                    {task.scheduleRule && (
                                      <span className="text-xs text-gray-400 mt-1 block">
                                        {scheduleRuleConfig[task.scheduleRule as ScheduleRule]?.label}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => handleEdit(task)}
                                    className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-500"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => { setTaskToDelete(task); setDeleteDialogOpen(true); }}
                                    className="p-1.5 rounded-lg hover:bg-red-100 text-red-500"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除任务「{taskToDelete?.name}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => taskToDelete && deleteMutation.mutate(taskToDelete.id)}
              className="bg-red-500 hover:bg-red-600"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>任务名称</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="输入任务名称"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>分类</Label>
                <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v as TaskCategory })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="校内巩固">校内巩固</SelectItem>
                    <SelectItem value="校内拔高">校内拔高</SelectItem>
                    <SelectItem value="课外课程">课外课程</SelectItem>
                    <SelectItem value="英语阅读">英语阅读</SelectItem>
                    <SelectItem value="中文阅读">中文阅读</SelectItem>
                    <SelectItem value="体育运动">体育运动</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>类型</Label>
                <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v as TaskType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="固定">固定</SelectItem>
                    <SelectItem value="灵活">灵活</SelectItem>
                    <SelectItem value="跟随学校">跟随学校</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>时长（分钟）</Label>
                <Input
                  type="number"
                  value={formData.timePerUnit}
                  onChange={e => setFormData({ ...formData, timePerUnit: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="space-y-2">
                <Label>安排规则</Label>
                <Select value={formData.scheduleRule} onValueChange={v => setFormData({ ...formData, scheduleRule: v as ScheduleRule })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">每天</SelectItem>
                    <SelectItem value="school">在校日</SelectItem>
                    <SelectItem value="weekend">周末</SelectItem>
                    <SelectItem value="flexible">灵活</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formData.scheduleRule === 'flexible' && (
              <div className="space-y-2">
                <Label>每周次数</Label>
                <Input
                  type="number"
                  value={formData.weeklyFrequency}
                  onChange={e => setFormData({ ...formData, weeklyFrequency: parseInt(e.target.value) || 1 })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>任务名称</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>分类</Label>
                <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v as TaskCategory })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="校内巩固">校内巩固</SelectItem>
                    <SelectItem value="校内拔高">校内拔高</SelectItem>
                    <SelectItem value="课外课程">课外课程</SelectItem>
                    <SelectItem value="英语阅读">英语阅读</SelectItem>
                    <SelectItem value="中文阅读">中文阅读</SelectItem>
                    <SelectItem value="体育运动">体育运动</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>类型</Label>
                <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v as TaskType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="固定">固定</SelectItem>
                    <SelectItem value="灵活">灵活</SelectItem>
                    <SelectItem value="跟随学校">跟随学校</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>时长（分钟）</Label>
                <Input
                  type="number"
                  value={formData.timePerUnit}
                  onChange={e => setFormData({ ...formData, timePerUnit: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="space-y-2">
                <Label>安排规则</Label>
                <Select value={formData.scheduleRule} onValueChange={v => setFormData({ ...formData, scheduleRule: v as ScheduleRule })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">每天</SelectItem>
                    <SelectItem value="school">在校日</SelectItem>
                    <SelectItem value="weekend">周末</SelectItem>
                    <SelectItem value="flexible">灵活</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}