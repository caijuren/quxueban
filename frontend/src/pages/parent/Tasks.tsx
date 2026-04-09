import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, BookOpen, Calculator, Dumbbell, GraduationCap, Languages, BookMarked, Users, Star, ListTodo, Download, Send } from 'lucide-react';
import { useSelectedChild } from '@/contexts/SelectedChildContext';
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
import { ExportDialog } from '@/components/ExportDialog';

type TaskCategory = '校内巩固' | '校内拔高' | '课外课程' | '英语阅读' | '体育运动' | '中文阅读';
type TaskType = '固定' | '灵活' | '跟随学校';
type ScheduleRule = 'daily' | 'school' | 'weekend' | 'flexible';

// 映射对象
const subjectReverseMap: Record<string, string> = {
  'chinese': '语文',
  'math': '数学',
  'english': '英语',
  'sports': '体育'
};
const parentRoleReverseMap: Record<string, string> = {
  'independent': '独立完成',
  'accompany': '家长陪伴',
  'parent-led': '家长主导'
};

export interface Task {
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
    scheduleRule?: ScheduleRule;
    weeklyFrequency?: number;
  };
  appliesTo?: number[];
  // 精细化记录字段
  trackingType?: 'simple' | 'numeric' | 'progress';
  trackingUnit?: string;
  targetValue?: number;
}

const tagConfig: Record<string, { icon: any; color: string }> = {
  '校内巩固': { icon: BookOpen, color: 'bg-blue-100 text-blue-600' },
  '校内拔高': { icon: BookOpen, color: 'bg-blue-100 text-blue-600' },
  '课外课程': { icon: Star, color: 'bg-orange-100 text-orange-600' },
  '英语阅读': { icon: BookMarked, color: 'bg-purple-100 text-purple-600' },
  '中文阅读': { icon: BookMarked, color: 'bg-pink-100 text-pink-600' },
  '体育运动': { icon: Dumbbell, color: 'bg-green-100 text-green-600' },
  '语文': { icon: Languages, color: 'bg-red-100 text-red-600' },
  '数学': { icon: Calculator, color: 'bg-blue-100 text-blue-600' },
  '英语': { icon: Languages, color: 'bg-purple-100 text-purple-600' },
  '体育': { icon: Dumbbell, color: 'bg-green-100 text-green-600' },
  '独立完成': { icon: Users, color: 'bg-cyan-100 text-cyan-600' },
  '家长陪伴': { icon: Users, color: 'bg-cyan-100 text-cyan-600' },
  '家长主导': { icon: Users, color: 'bg-cyan-100 text-cyan-600' },
};

async function fetchTasks(childId?: number): Promise<Task[]> {
  const params = childId ? { childId } : {};
  const r = await apiClient.get('/tasks', { params });
  return r.data.data || [];
}
async function deleteTask(id: number): Promise<void> {
  await apiClient.delete('/tasks/' + id);
}
async function pushTaskToDingtalk(taskId: number, childId: number): Promise<void> {
  await apiClient.post(`/dingtalk/tasks/${taskId}/push-to-dingtalk`, { childId });
}

export default function TasksPage() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const { selectedChildId, selectedChild } = useSelectedChild();
  const [formData, setFormData] = useState({
    name: '',
    category: '校内巩固' as TaskCategory,
    type: '固定' as TaskType,
    timePerUnit: 30,
    scheduleRule: 'daily' as ScheduleRule,
    weeklyFrequency: 5,
    subject: '语文' as string,
    parentRole: '独立完成' as string,
    difficulty: '基础' as string,
    totalUnits: 0,
    completedUnits: 0,
    totalPages: 0,
    completedPages: 0,
    // 精细化记录字段
    trackingType: 'simple' as 'simple' | 'numeric' | 'progress',
    trackingUnit: '' as string,
    targetValue: 0 as number,
  });
  // 使用localStorage存储当前选中的选项卡
  const [activeTab, setActiveTab] = useState<'all' | 'subject' | 'type' | 'completion'>(() => {
    const savedTab = localStorage.getItem('tasksActiveTab');
    return (savedTab as 'all' | 'subject' | 'type' | 'completion') || 'all';
  });

  // 当选项卡变化时，保存到localStorage
  useEffect(() => {
    localStorage.setItem('tasksActiveTab', activeTab);
  }, [activeTab]);

  const queryClient = useQueryClient();
  const { data: tasks = [], isLoading } = useQuery({ 
    queryKey: ['tasks', selectedChildId], 
    queryFn: () => fetchTasks(selectedChildId) 
  });

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
    mutationFn: async (data: any) => {
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

  // Push task to DingTalk mutation
  const pushTaskToDingtalkMutation = useMutation({
    mutationFn: ({ taskId, childId }: { taskId: number; childId: number }) =>
      pushTaskToDingtalk(taskId, childId),
    onSuccess: () => toast.success('任务已推送至钉钉'),
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const resetForm = () => {
    setFormData({
      name: '',
      category: '校内巩固',
      type: '固定',
      timePerUnit: 30,
      scheduleRule: 'daily',
      weeklyFrequency: 5,
      subject: '语文',
      parentRole: '独立完成',
      difficulty: '基础',
      totalUnits: 0,
      completedUnits: 0,
      totalPages: 0,
      completedPages: 0,
      // 精细化记录字段
      trackingType: 'simple',
      trackingUnit: '',
      targetValue: 0,
    });
  };

  const handleEdit = (task: Task) => {
    setTaskToEdit(task);
    // 反向映射后端返回的英文值到前端显示的中文值
    const subject = task.tags?.subject ? subjectReverseMap[task.tags.subject] || '语文' : '语文';
    const parentRole = task.tags?.parentRole ? parentRoleReverseMap[task.tags.parentRole] || '独立完成' : '独立完成';
    const difficultyMap: Record<string, string> = {
      'basic': '基础',
      'advanced': '提高',
      'challenge': '挑战'
    };
    const difficulty = task.tags?.difficulty ? difficultyMap[task.tags.difficulty] || '基础' : '基础';
    
    setFormData({
      name: task.name,
      category: task.category,
      type: task.type,
      timePerUnit: task.timePerUnit,
      scheduleRule: (task.scheduleRule as ScheduleRule) || 'daily',
      weeklyFrequency: task.weeklyFrequency || 5,
      subject: subject,
      parentRole: parentRole,
      difficulty: difficulty,
      totalUnits: 0,
      completedUnits: 0,
      totalPages: 0,
      completedPages: 0,
      // 精细化记录字段 - 从task中获取
      trackingType: (task as any).trackingType || 'simple',
      trackingUnit: (task as any).trackingUnit || '',
      targetValue: (task as any).targetValue || 0,
    });
    setEditDialogOpen(true);
  };

  const handleCreate = () => {
    if (!formData.name.trim()) {
      toast.error('请输入任务名称');
      return;
    }
    const subjectMap: Record<string, string> = {
      '语文': 'chinese',
      '数学': 'math',
      '英语': 'english',
      '体育': 'sports'
    };
    const parentRoleMap: Record<string, string> = {
      '独立完成': 'independent',
      '家长陪伴': 'accompany',
      '家长主导': 'parent-led'
    };
    const difficultyMap: Record<string, string> = {
      '基础': 'basic',
      '提高': 'advanced',
      '挑战': 'challenge'
    };
    createMutation.mutate({
      name: formData.name,
      category: formData.category,
      type: formData.type,
      timePerUnit: formData.timePerUnit,
      tags: {
        subject: subjectMap[formData.subject],
        parentRole: parentRoleMap[formData.parentRole],
        difficulty: difficultyMap[formData.difficulty],
        scheduleRule: formData.scheduleRule,
        weeklyFrequency: formData.weeklyFrequency,
      },
      appliesTo: selectedChildId ? [selectedChildId] : [],
      // 精细化记录字段
      trackingType: formData.trackingType,
      trackingUnit: formData.trackingUnit,
      targetValue: formData.targetValue,
    });
  };

  const handleUpdate = () => {
    if (!taskToEdit || !formData.name.trim()) {
      toast.error('请输入任务名称');
      return;
    }
    const subjectMap: Record<string, string> = {
      '语文': 'chinese',
      '数学': 'math',
      '英语': 'english',
      '体育': 'sports'
    };
    const parentRoleMap: Record<string, string> = {
      '独立完成': 'independent',
      '家长陪伴': 'accompany',
      '家长主导': 'parent-led'
    };
    const difficultyMap: Record<string, string> = {
      '基础': 'basic',
      '提高': 'advanced',
      '挑战': 'challenge'
    };
    updateMutation.mutate({ 
      id: taskToEdit.id, 
      updates: {
        name: formData.name,
        category: formData.category,
        type: formData.type,
        timePerUnit: formData.timePerUnit,
        scheduleRule: formData.scheduleRule,
        weeklyFrequency: formData.weeklyFrequency,
        tags: {
          subject: subjectMap[formData.subject],
          parentRole: parentRoleMap[formData.parentRole],
          difficulty: difficultyMap[formData.difficulty],
        },
        appliesTo: selectedChildId ? [selectedChildId] : [],
        // 精细化记录字段
        trackingType: formData.trackingType,
        trackingUnit: formData.trackingUnit,
        targetValue: formData.targetValue,
      }
    });
  };

  const getSubjectGroups = () => {
    const subjectReverseMap: Record<string, string> = {
      'chinese': '语文',
      'math': '数学',
      'english': '英语',
      'sports': '体育'
    };
    const subjects = ['语文', '数学', '英语', '体育'];
    return subjects.map(subject => {
      const subjectKey = Object.keys(subjectReverseMap).find(key => subjectReverseMap[key] === subject) || subject;
      const subjectTasks = tasks.filter(task => {
        const taskSubject = task.tags?.subject;
        if (taskSubject) {
          return taskSubject === subject || taskSubject === subjectKey;
        }
        return false;
      });
      return { subject, tasks: subjectTasks };
    }).filter(group => group.tasks.length > 0);
  };

  const getTypeGroups = () => {
    const types = ['校内巩固', '校内拔高', '课外课程', '英语阅读', '中文阅读', '体育运动'];
    return types.map(type => {
      const typeTasks = tasks.filter(task => task.category === type);
      return { type, tasks: typeTasks };
    }).filter(group => group.tasks.length > 0);
  };

  const getCompletionGroups = () => {
    const parentRoleReverseMap: Record<string, string> = {
      'independent': '独立完成',
      'accompany': '家长陪伴',
      'parent-led': '家长主导'
    };
    const completionTypes = ['独立完成', '家长陪伴', '家长主导'];
    return completionTypes.map(type => {
      const typeKey = Object.keys(parentRoleReverseMap).find(key => parentRoleReverseMap[key] === type) || type;
      const typeTasks = tasks.filter(task => {
        const taskRole = task.tags?.parentRole;
        if (taskRole) {
          return taskRole === type || taskRole === typeKey;
        }
        return false;
      });
      return { type, tasks: typeTasks };
    }).filter(group => group.tasks.length > 0);
  };

  const handlePushTaskToDingtalk = (taskId: number) => {
    if (!selectedChildId) {
      toast.error('请先选择一个孩子');
      return;
    }
    pushTaskToDingtalkMutation.mutate({ taskId, childId: selectedChildId });
  };

  const renderTags = (task: Task) => {
    const subjectReverseMap: Record<string, string> = {
      'chinese': '语文',
      'math': '数学',
      'english': '英语',
      'sports': '体育'
    };
    const parentRoleReverseMap: Record<string, string> = {
      'independent': '独立完成',
      'accompany': '家长陪伴',
      'parent-led': '家长主导'
    };
    const tags: string[] = [task.category];
    if (task.tags?.subject) {
      const subject = subjectReverseMap[task.tags.subject as string] || task.tags.subject;
      tags.push(subject);
    }
    if (task.tags?.parentRole) {
      const parentRole = parentRoleReverseMap[task.tags.parentRole as string] || task.tags.parentRole;
      tags.push(parentRole);
    }
    return tags.map(tag => {
      const config = tagConfig[tag];
      const Icon = config?.icon || BookOpen;
      return (
        <span key={tag} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
          <Icon className="w-3 h-3" />
          {tag}
        </span>
      );
    });
  };

  return (
    <div className="space-y-6" ref={pageRef}>
      {/* Page Control Bar */}
      <div className="bg-muted/50 border border-border rounded-lg p-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1">
            <button
              onClick={() => setActiveTab('all')}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg',
                activeTab === 'all'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              )}
            >
              全部任务
            </button>
            <button
              onClick={() => setActiveTab('subject')}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg',
                activeTab === 'subject'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              )}
            >
              按学科
            </button>
            <button
              onClick={() => setActiveTab('type')}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg',
                activeTab === 'type'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              )}
            >
              按类型
            </button>
            <button
              onClick={() => setActiveTab('completion')}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg',
                activeTab === 'completion'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              )}
            >
              完成方式
            </button>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setExportDialogOpen(true)}
              className="h-10 rounded-lg border-border hover:bg-muted min-w-20"
            >
              <Download className="w-4 h-4 mr-1.5 text-primary" />
              <span className="text-sm">导出</span>
            </Button>
            <Button
              onClick={() => { resetForm(); setCreateDialogOpen(true); }}
              className="h-10 rounded-lg bg-primary hover:bg-primary/90 text-white shadow-sm min-w-20"
            >
              <Plus className="size-4 mr-1.5" />
              <span className="text-sm">新建任务</span>
            </Button>
          </div>
        </div>
      </div>
      {/* Task Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : (
        <div>
          {/* All Tasks */}
          {activeTab === 'all' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {tasks.map(task => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow group"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* 左侧图标 */}
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center">
                        {task.category === '校内巩固' && <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><BookOpen className="w-5 h-5 text-blue-600" /></div>}
                        {task.category === '校内拔高' && <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center"><GraduationCap className="w-5 h-5 text-purple-600" /></div>}
                        {task.category === '课外课程' && <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center"><Star className="w-5 h-5 text-orange-600" /></div>}
                        {task.category === '英语阅读' && <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center"><BookMarked className="w-5 h-5 text-purple-600" /></div>}
                        {task.category === '中文阅读' && <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center"><BookMarked className="w-5 h-5 text-pink-600" /></div>}
                        {task.category === '体育运动' && <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center"><Dumbbell className="w-5 h-5 text-green-600" /></div>}
                      </div>
                      
                      {/* 任务内容 */}
                      <div className="flex-1">
                        <h3 className="font-medium text-sm text-foreground mb-2">{task.name}</h3>
                        <div className="flex flex-wrap gap-1.5">
                          {task.category && (
                            <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-muted text-foreground">
                              {task.category}
                            </span>
                          )}
                          {task.tags?.subject && (
                            <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              {subjectReverseMap[task.tags.subject as string] || task.tags.subject}
                            </span>
                          )}
                          {task.tags?.parentRole && (
                            <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              {parentRoleReverseMap[task.tags.parentRole as string] || task.tags.parentRole}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* 操作按钮 */}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(task)}
                          className="p-1.5 rounded-lg hover:bg-primary/10 text-primary"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setTaskToDelete(task); setDeleteDialogOpen(true); }}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* By Subject */}
          {activeTab === 'subject' && (
            <div className="space-y-6">
              {getSubjectGroups().map(group => (
                <div key={group.subject}>
                  <h2 className="text-lg font-semibold text-foreground mb-3">{group.subject} ({group.tasks.length}个任务)</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {group.tasks.map(task => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow group"
                      >
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            {/* 左侧图标 */}
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center">
                              {task.category === '校内巩固' && <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><BookOpen className="w-5 h-5 text-blue-600" /></div>}
                              {task.category === '校内拔高' && <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center"><GraduationCap className="w-5 h-5 text-purple-600" /></div>}
                              {task.category === '课外课程' && <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center"><Star className="w-5 h-5 text-orange-600" /></div>}
                              {task.category === '英语阅读' && <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center"><BookMarked className="w-5 h-5 text-purple-600" /></div>}
                              {task.category === '中文阅读' && <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center"><BookMarked className="w-5 h-5 text-pink-600" /></div>}
                              {task.category === '体育运动' && <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center"><Dumbbell className="w-5 h-5 text-green-600" /></div>}
                            </div>
                            
                            {/* 任务内容 */}
                            <div className="flex-1">
                              <h3 className="font-medium text-sm text-foreground mb-2">{task.name}</h3>
                              <div className="flex flex-wrap gap-1.5">
                                {task.category && (
                                  <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-muted text-foreground">
                                    {task.category}
                                  </span>
                                )}
                                {task.tags?.subject && (
                                  <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                    {subjectReverseMap[task.tags.subject as string] || task.tags.subject}
                                  </span>
                                )}
                                {task.tags?.parentRole && (
                                  <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                    {parentRoleReverseMap[task.tags.parentRole as string] || task.tags.parentRole}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* 操作按钮 */}
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEdit(task)}
                                className="p-1.5 rounded-lg hover:bg-primary/10 text-primary"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handlePushTaskToDingtalk(task.id)}
                                className="p-1.5 rounded-lg hover:bg-green-100 text-green-600"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setTaskToDelete(task); setDeleteDialogOpen(true); }}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* By Type */}
          {activeTab === 'type' && (
            <div className="space-y-6">
              {getTypeGroups().map(group => (
                <div key={group.type}>
                  <h2 className="text-lg font-semibold text-foreground mb-3">{group.type} ({group.tasks.length}个任务)</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {group.tasks.map(task => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow group"
                      >
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            {/* 左侧图标 */}
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center">
                              {task.category === '校内巩固' && <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><BookOpen className="w-5 h-5 text-blue-600" /></div>}
                              {task.category === '校内拔高' && <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center"><GraduationCap className="w-5 h-5 text-purple-600" /></div>}
                              {task.category === '课外课程' && <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center"><Star className="w-5 h-5 text-orange-600" /></div>}
                              {task.category === '英语阅读' && <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center"><BookMarked className="w-5 h-5 text-purple-600" /></div>}
                              {task.category === '中文阅读' && <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center"><BookMarked className="w-5 h-5 text-pink-600" /></div>}
                              {task.category === '体育运动' && <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center"><Dumbbell className="w-5 h-5 text-green-600" /></div>}
                            </div>
                            
                            {/* 任务内容 */}
                            <div className="flex-1">
                              <h3 className="font-medium text-sm text-foreground mb-2">{task.name}</h3>
                              <div className="flex flex-wrap gap-1.5">
                                {task.category && (
                                  <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-muted text-foreground">
                                    {task.category}
                                  </span>
                                )}
                                {task.tags?.subject && (
                                  <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                    {subjectReverseMap[task.tags.subject as string] || task.tags.subject}
                                  </span>
                                )}
                                {task.tags?.parentRole && (
                                  <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                    {parentRoleReverseMap[task.tags.parentRole as string] || task.tags.parentRole}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* 操作按钮 */}
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEdit(task)}
                                className="p-1.5 rounded-lg hover:bg-primary/10 text-primary"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handlePushTaskToDingtalk(task.id)}
                                className="p-1.5 rounded-lg hover:bg-green-100 text-green-600"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setTaskToDelete(task); setDeleteDialogOpen(true); }}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* By Completion */}
          {activeTab === 'completion' && (
            <div className="space-y-6">
              {getCompletionGroups().map(group => (
                <div key={group.type}>
                  <h2 className="text-lg font-semibold text-foreground mb-3">{group.type} ({group.tasks.length}个任务)</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {group.tasks.map(task => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow group"
                      >
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            {/* 左侧图标 */}
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center">
                              {task.category === '校内巩固' && <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><BookOpen className="w-5 h-5 text-blue-600" /></div>}
                              {task.category === '校内拔高' && <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center"><GraduationCap className="w-5 h-5 text-purple-600" /></div>}
                              {task.category === '课外课程' && <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center"><Star className="w-5 h-5 text-orange-600" /></div>}
                              {task.category === '英语阅读' && <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center"><BookMarked className="w-5 h-5 text-purple-600" /></div>}
                              {task.category === '中文阅读' && <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center"><BookMarked className="w-5 h-5 text-pink-600" /></div>}
                              {task.category === '体育运动' && <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center"><Dumbbell className="w-5 h-5 text-green-600" /></div>}
                            </div>
                            
                            {/* 任务内容 */}
                            <div className="flex-1">
                              <h3 className="font-medium text-sm text-foreground mb-2">{task.name}</h3>
                              <div className="flex flex-wrap gap-1.5">
                                {task.category && (
                                  <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-muted text-foreground">
                                    {task.category}
                                  </span>
                                )}
                                {task.tags?.subject && (
                                  <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                    {subjectReverseMap[task.tags.subject as string] || task.tags.subject}
                                  </span>
                                )}
                                {task.tags?.parentRole && (
                                  <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                    {parentRoleReverseMap[task.tags.parentRole as string] || task.tags.parentRole}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* 操作按钮 */}
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEdit(task)}
                                className="p-1.5 rounded-lg hover:bg-primary/10 text-primary"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handlePushTaskToDingtalk(task.id)}
                                className="p-1.5 rounded-lg hover:bg-green-100 text-green-600"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setTaskToDelete(task); setDeleteDialogOpen(true); }}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        targetRef={pageRef}
        title="导出任务配置"
        filename="任务配置"
      />

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl border-0 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-red-600 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              确认删除
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 ml-[52px]">
              确定要删除任务「{taskToDelete?.name}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl h-11 px-6">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => taskToDelete && deleteMutation.mutate(taskToDelete.id)}
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl h-11 px-6"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto rounded-3xl border-0 shadow-2xl">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Plus className="w-5 h-5 text-white" />
              </div>
              新建任务
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 任务名称 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">任务名称 <span className="text-red-500">*</span></Label>
              <Input
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入任务名称"
                required
                className="rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* 分配规则 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">分配规则</Label>
              <div className="grid grid-cols-4 gap-2">
                <Button
                  variant={formData.scheduleRule === 'daily' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, scheduleRule: 'daily' })}
                  className={`rounded-xl ${formData.scheduleRule === 'daily' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  每日任务
                </Button>
                <Button
                  variant={formData.scheduleRule === 'school' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, scheduleRule: 'school' })}
                  className={`rounded-xl ${formData.scheduleRule === 'school' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  在校日任务
                </Button>
                <Button
                  variant={formData.scheduleRule === 'flexible' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, scheduleRule: 'flexible' })}
                  className={`rounded-xl ${formData.scheduleRule === 'flexible' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  智能分配
                </Button>
                <Button
                  variant={formData.scheduleRule === 'weekend' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, scheduleRule: 'weekend' })}
                  className={`rounded-xl ${formData.scheduleRule === 'weekend' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  周末任务
                </Button>
              </div>
              {formData.scheduleRule === 'flexible' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">每周次数</Label>
                  <Input
                    type="number"
                    value={formData.weeklyFrequency}
                    onChange={e => setFormData({ ...formData, weeklyFrequency: parseInt(e.target.value) || 1 })}
                    className="rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>

            {/* 任务分类 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">任务分类</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={formData.category === '校内巩固' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, category: '校内巩固' })}
                  className={`rounded-xl ${formData.category === '校内巩固' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  校内巩固
                </Button>
                <Button
                  variant={formData.category === '校内拔高' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, category: '校内拔高' })}
                  className={`rounded-xl ${formData.category === '校内拔高' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  校内拔高
                </Button>
                <Button
                  variant={formData.category === '课外课程' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, category: '课外课程' })}
                  className={`rounded-xl ${formData.category === '课外课程' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  课外课程
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={formData.category === '中文阅读' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, category: '中文阅读' })}
                  className={`rounded-xl ${formData.category === '中文阅读' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  中文阅读
                </Button>
                <Button
                  variant={formData.category === '英语阅读' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, category: '英语阅读' })}
                  className={`rounded-xl ${formData.category === '英语阅读' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  英文阅读
                </Button>
                <Button
                  variant={formData.category === '体育运动' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, category: '体育运动' })}
                  className={`rounded-xl ${formData.category === '体育运动' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  体育锻炼
                </Button>
              </div>
            </div>

            {/* 单项任务时长 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">单项任务时长（分钟）</Label>
              <Input
                type="number"
                value={formData.timePerUnit}
                onChange={e => setFormData({ ...formData, timePerUnit: parseInt(e.target.value) || 30 })}
                className="rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* 学科 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">学科</Label>
              <div className="grid grid-cols-4 gap-2">
                <Button
                  variant={formData.subject === '语文' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, subject: '语文' })}
                  className={`rounded-xl ${formData.subject === '语文' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  语文
                </Button>
                <Button
                  variant={formData.subject === '数学' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, subject: '数学' })}
                  className={`rounded-xl ${formData.subject === '数学' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  数学
                </Button>
                <Button
                  variant={formData.subject === '英语' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, subject: '英语' })}
                  className={`rounded-xl ${formData.subject === '英语' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  英语
                </Button>
                <Button
                  variant={formData.subject === '体育' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, subject: '体育' })}
                  className={`rounded-xl ${formData.subject === '体育' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  体育
                </Button>
              </div>
            </div>

            {/* 完成方式 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">完成方式</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={formData.parentRole === '独立完成' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, parentRole: '独立完成' })}
                  className={`rounded-xl ${formData.parentRole === '独立完成' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  自主完成
                </Button>
                <Button
                  variant={formData.parentRole === '家长陪伴' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, parentRole: '家长陪伴' })}
                  className={`rounded-xl ${formData.parentRole === '家长陪伴' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  家长陪伴
                </Button>
                <Button
                  variant={formData.parentRole === '家长主导' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, parentRole: '家长主导' })}
                  className={`rounded-xl ${formData.parentRole === '家长主导' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  家长主导
                </Button>
              </div>
            </div>

            {/* 任务难度 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">任务难度</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={formData.difficulty === '基础' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, difficulty: '基础' })}
                  className={`rounded-xl ${formData.difficulty === '基础' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  基础
                </Button>
                <Button
                  variant={formData.difficulty === '提高' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, difficulty: '提高' })}
                  className={`rounded-xl ${formData.difficulty === '提高' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  提高
                </Button>
                <Button
                  variant={formData.difficulty === '挑战' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, difficulty: '挑战' })}
                  className={`rounded-xl ${formData.difficulty === '挑战' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  挑战
                </Button>
              </div>
            </div>

            {/* 总单元数 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">总单元数</Label>
              <div className="flex gap-4">
                <Input
                  type="number"
                  value={formData.totalUnits}
                  onChange={e => setFormData({ ...formData, totalUnits: parseInt(e.target.value) || 0 })}
                  className="flex-1 rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">已完成：</span>
                  <Input
                    type="number"
                    value={formData.completedUnits}
                    onChange={e => setFormData({ ...formData, completedUnits: parseInt(e.target.value) || 0 })}
                    className="w-24 rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* 总页数 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">总页数</Label>
              <div className="flex gap-4">
                <Input
                  type="number"
                  value={formData.totalPages}
                  onChange={e => setFormData({ ...formData, totalPages: parseInt(e.target.value) || 0 })}
                  className="flex-1 rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">已完成：</span>
                  <Input
                    type="number"
                    value={formData.completedPages}
                    onChange={e => setFormData({ ...formData, completedPages: parseInt(e.target.value) || 0 })}
                    className="w-24 rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* 记录方式设置 */}
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                记录方式设置
              </Label>
              
              {/* 记录方式选择 */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">记录类型</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={formData.trackingType === 'simple' ? 'default' : 'outline'}
                    onClick={() => setFormData({ ...formData, trackingType: 'simple', trackingUnit: '', targetValue: 0 })}
                    className={`rounded-xl ${formData.trackingType === 'simple' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    简单记录
                  </Button>
                  <Button
                    variant={formData.trackingType === 'numeric' ? 'default' : 'outline'}
                    onClick={() => setFormData({ ...formData, trackingType: 'numeric' })}
                    className={`rounded-xl ${formData.trackingType === 'numeric' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    数值记录
                  </Button>
                  <Button
                    variant={formData.trackingType === 'progress' ? 'default' : 'outline'}
                    onClick={() => setFormData({ ...formData, trackingType: 'progress' })}
                    className={`rounded-xl ${formData.trackingType === 'progress' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    进度记录
                  </Button>
                </div>
              </div>

              {/* 单位和目标值（仅在数值记录或进度记录时显示） */}
              {formData.trackingType !== 'simple' && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">计量单位</Label>
                      <Select
                        value={formData.trackingUnit}
                        onValueChange={(value) => setFormData({ ...formData, trackingUnit: value })}
                      >
                        <SelectTrigger className="rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                          <SelectValue placeholder="选择单位" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="页">页</SelectItem>
                          <SelectItem value="次">次</SelectItem>
                          <SelectItem value="分钟">分钟</SelectItem>
                          <SelectItem value="道">道</SelectItem>
                          <SelectItem value="篇">篇</SelectItem>
                          <SelectItem value="个">个</SelectItem>
                          <SelectItem value="组">组</SelectItem>
                          <SelectItem value="字">字</SelectItem>
                          <SelectItem value="词">词</SelectItem>
                          <SelectItem value="句">句</SelectItem>
                          <SelectItem value="段">段</SelectItem>
                          <SelectItem value="章">章</SelectItem>
                          <SelectItem value="本">本</SelectItem>
                          <SelectItem value="套">套</SelectItem>
                          <SelectItem value="卷">卷</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">目标值（可选）</Label>
                      <Input
                        type="number"
                        value={formData.targetValue || ''}
                        onChange={e => setFormData({ ...formData, targetValue: parseInt(e.target.value) || 0 })}
                        placeholder="如：100"
                        className="rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  
                  {/* 预览提示 */}
                  <div className="bg-purple-50 rounded-lg p-3 text-sm text-purple-700">
                    <p className="flex items-center gap-2">
                      <span className="text-lg">💡</span>
                      <span>
                        孩子完成时将看到：
                        {formData.trackingType === 'numeric' 
                          ? `输入本次完成的${formData.trackingUnit || '数量'}${formData.targetValue ? `（目标：${formData.targetValue}${formData.trackingUnit}）` : ''}`
                          : `输入当前进度${formData.trackingUnit ? `（${formData.trackingUnit}）` : ''}${formData.targetValue ? `，目标${formData.targetValue}${formData.trackingUnit}` : ''}`
                        }
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="border-t border-gray-100 pt-6 gap-3">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="rounded-xl h-11 px-6 border-gray-200 hover:bg-gray-50">取消</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="rounded-xl h-11 px-6 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg shadow-purple-500/25">
              {createMutation.isPending ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto rounded-3xl border-0 shadow-2xl">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Edit2 className="w-5 h-5 text-white" />
              </div>
              编辑任务
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 任务名称 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">任务名称 <span className="text-red-500">*</span></Label>
              <Input
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入任务名称"
                required
                className="rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* 分配规则 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">分配规则</Label>
              <div className="grid grid-cols-4 gap-2">
                <Button
                  variant={formData.scheduleRule === 'daily' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, scheduleRule: 'daily' })}
                  className={`rounded-xl ${formData.scheduleRule === 'daily' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  每日任务
                </Button>
                <Button
                  variant={formData.scheduleRule === 'school' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, scheduleRule: 'school' })}
                  className={`rounded-xl ${formData.scheduleRule === 'school' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  在校日任务
                </Button>
                <Button
                  variant={formData.scheduleRule === 'flexible' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, scheduleRule: 'flexible' })}
                  className={`rounded-xl ${formData.scheduleRule === 'flexible' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  智能分配
                </Button>
                <Button
                  variant={formData.scheduleRule === 'weekend' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, scheduleRule: 'weekend' })}
                  className={`rounded-xl ${formData.scheduleRule === 'weekend' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  周末任务
                </Button>
              </div>
              {formData.scheduleRule === 'flexible' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">每周次数</Label>
                  <Input
                    type="number"
                    value={formData.weeklyFrequency}
                    onChange={e => setFormData({ ...formData, weeklyFrequency: parseInt(e.target.value) || 1 })}
                    className="rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>

            {/* 任务分类 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">任务分类</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={formData.category === '校内巩固' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, category: '校内巩固' })}
                  className={`rounded-xl ${formData.category === '校内巩固' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  校内巩固
                </Button>
                <Button
                  variant={formData.category === '校内拔高' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, category: '校内拔高' })}
                  className={`rounded-xl ${formData.category === '校内拔高' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  校内拔高
                </Button>
                <Button
                  variant={formData.category === '课外课程' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, category: '课外课程' })}
                  className={`rounded-xl ${formData.category === '课外课程' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  课外课程
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={formData.category === '中文阅读' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, category: '中文阅读' })}
                  className={`rounded-xl ${formData.category === '中文阅读' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  中文阅读
                </Button>
                <Button
                  variant={formData.category === '英语阅读' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, category: '英语阅读' })}
                  className={`rounded-xl ${formData.category === '英语阅读' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  英文阅读
                </Button>
                <Button
                  variant={formData.category === '体育运动' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, category: '体育运动' })}
                  className={`rounded-xl ${formData.category === '体育运动' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  体育锻炼
                </Button>
              </div>
            </div>

            {/* 单项任务时长 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">单项任务时长（分钟）</Label>
              <Input
                type="number"
                value={formData.timePerUnit}
                onChange={e => setFormData({ ...formData, timePerUnit: parseInt(e.target.value) || 30 })}
                className="rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* 学科 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">学科</Label>
              <div className="grid grid-cols-4 gap-2">
                <Button
                  variant={formData.subject === '语文' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, subject: '语文' })}
                  className={`rounded-xl ${formData.subject === '语文' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  语文
                </Button>
                <Button
                  variant={formData.subject === '数学' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, subject: '数学' })}
                  className={`rounded-xl ${formData.subject === '数学' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  数学
                </Button>
                <Button
                  variant={formData.subject === '英语' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, subject: '英语' })}
                  className={`rounded-xl ${formData.subject === '英语' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  英语
                </Button>
                <Button
                  variant={formData.subject === '体育' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, subject: '体育' })}
                  className={`rounded-xl ${formData.subject === '体育' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  体育
                </Button>
              </div>
            </div>

            {/* 完成方式 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">完成方式</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={formData.parentRole === '独立完成' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, parentRole: '独立完成' })}
                  className={`rounded-xl ${formData.parentRole === '独立完成' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  自主完成
                </Button>
                <Button
                  variant={formData.parentRole === '家长陪伴' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, parentRole: '家长陪伴' })}
                  className={`rounded-xl ${formData.parentRole === '家长陪伴' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  家长陪伴
                </Button>
                <Button
                  variant={formData.parentRole === '家长主导' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, parentRole: '家长主导' })}
                  className={`rounded-xl ${formData.parentRole === '家长主导' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  家长主导
                </Button>
              </div>
            </div>

            {/* 任务难度 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">任务难度</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={formData.difficulty === '基础' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, difficulty: '基础' })}
                  className={`rounded-xl ${formData.difficulty === '基础' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  基础
                </Button>
                <Button
                  variant={formData.difficulty === '提高' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, difficulty: '提高' })}
                  className={`rounded-xl ${formData.difficulty === '提高' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  提高
                </Button>
                <Button
                  variant={formData.difficulty === '挑战' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, difficulty: '挑战' })}
                  className={`rounded-xl ${formData.difficulty === '挑战' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  挑战
                </Button>
              </div>
            </div>

            {/* 总单元数 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">总单元数</Label>
              <div className="flex gap-4">
                <Input
                  type="number"
                  value={formData.totalUnits}
                  onChange={e => setFormData({ ...formData, totalUnits: parseInt(e.target.value) || 0 })}
                  className="flex-1 rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">已完成：</span>
                  <Input
                    type="number"
                    value={formData.completedUnits}
                    onChange={e => setFormData({ ...formData, completedUnits: parseInt(e.target.value) || 0 })}
                    className="w-24 rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* 总页数 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">总页数</Label>
              <div className="flex gap-4">
                <Input
                  type="number"
                  value={formData.totalPages}
                  onChange={e => setFormData({ ...formData, totalPages: parseInt(e.target.value) || 0 })}
                  className="flex-1 rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">已完成：</span>
                  <Input
                    type="number"
                    value={formData.completedPages}
                    onChange={e => setFormData({ ...formData, completedPages: parseInt(e.target.value) || 0 })}
                    className="w-24 rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* 记录方式设置 */}
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                记录方式设置
              </Label>
              
              {/* 记录方式选择 */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">记录类型</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={formData.trackingType === 'simple' ? 'default' : 'outline'}
                    onClick={() => setFormData({ ...formData, trackingType: 'simple', trackingUnit: '', targetValue: 0 })}
                    className={`rounded-xl ${formData.trackingType === 'simple' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    简单记录
                  </Button>
                  <Button
                    variant={formData.trackingType === 'numeric' ? 'default' : 'outline'}
                    onClick={() => setFormData({ ...formData, trackingType: 'numeric' })}
                    className={`rounded-xl ${formData.trackingType === 'numeric' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    数值记录
                  </Button>
                  <Button
                    variant={formData.trackingType === 'progress' ? 'default' : 'outline'}
                    onClick={() => setFormData({ ...formData, trackingType: 'progress' })}
                    className={`rounded-xl ${formData.trackingType === 'progress' ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    进度记录
                  </Button>
                </div>
              </div>

              {/* 单位和目标值（仅在数值记录或进度记录时显示） */}
              {formData.trackingType !== 'simple' && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">计量单位</Label>
                      <Select
                        value={formData.trackingUnit}
                        onValueChange={(value) => setFormData({ ...formData, trackingUnit: value })}
                      >
                        <SelectTrigger className="rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                          <SelectValue placeholder="选择单位" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="页">页</SelectItem>
                          <SelectItem value="次">次</SelectItem>
                          <SelectItem value="分钟">分钟</SelectItem>
                          <SelectItem value="道">道</SelectItem>
                          <SelectItem value="篇">篇</SelectItem>
                          <SelectItem value="个">个</SelectItem>
                          <SelectItem value="组">组</SelectItem>
                          <SelectItem value="字">字</SelectItem>
                          <SelectItem value="词">词</SelectItem>
                          <SelectItem value="句">句</SelectItem>
                          <SelectItem value="段">段</SelectItem>
                          <SelectItem value="章">章</SelectItem>
                          <SelectItem value="本">本</SelectItem>
                          <SelectItem value="套">套</SelectItem>
                          <SelectItem value="卷">卷</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">目标值（可选）</Label>
                      <Input
                        type="number"
                        value={formData.targetValue || ''}
                        onChange={e => setFormData({ ...formData, targetValue: parseInt(e.target.value) || 0 })}
                        placeholder="如：100"
                        className="rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  
                  {/* 预览提示 */}
                  <div className="bg-purple-50 rounded-lg p-3 text-sm text-purple-700">
                    <p className="flex items-center gap-2">
                      <span className="text-lg">💡</span>
                      <span>
                        孩子完成时将看到：
                        {formData.trackingType === 'numeric' 
                          ? `输入本次完成的${formData.trackingUnit || '数量'}${formData.targetValue ? `（目标：${formData.targetValue}${formData.trackingUnit}）` : ''}`
                          : `输入当前进度${formData.trackingUnit ? `（${formData.trackingUnit}）` : ''}${formData.targetValue ? `，目标${formData.targetValue}${formData.trackingUnit}` : ''}`
                        }
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="border-t border-gray-100 pt-6 gap-3">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="rounded-xl h-11 px-6 border-gray-200 hover:bg-gray-50">取消</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending} className="rounded-xl h-11 px-6 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg shadow-purple-500/25">
              {updateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}