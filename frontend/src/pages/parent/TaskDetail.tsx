import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, BarChart3, Clock, Target, BookOpen, History, Edit, Trash2, Send, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useSelectedChild } from '@/contexts/SelectedChildContext';
import { EmptyPanel, PageToolbar, PageToolbarTitle } from '@/components/parent/PageToolbar';

// 类型定义
type TaskCategory = '校内巩固' | '校内拔高' | '课外课程' | '英语阅读' | '体育运动' | '中文阅读';
type TaskType = '固定' | '灵活' | '跟随学校';
type ScheduleRule = 'daily' | 'school' | 'weekend' | 'flexible';

// 映射对象
const subjectMap: Record<string, string> = {
  '语文': 'chinese',
  '数学': 'math',
  '英语': 'english',
  '体育': 'sports'
};

const subjectReverseMap: Record<string, string> = {
  'chinese': '语文',
  'math': '数学',
  'english': '英语',
  'sports': '体育'
};

const parentRoleMap: Record<string, string> = {
  '独立完成': 'independent',
  '家长陪伴': 'accompany',
  '家长主导': 'parent-led'
};

const parentRoleReverseMap: Record<string, string> = {
  'independent': '独立完成',
  'accompany': '家长陪伴',
  'parent-led': '家长主导'
};

const difficultyMap: Record<string, string> = {
  '基础': 'basic',
  '提高': 'advanced',
  '挑战': 'challenge'
};

const difficultyReverseMap: Record<string, string> = {
  'basic': '基础',
  'advanced': '提高',
  'challenge': '挑战'
};

interface Task {
  id: number;
  name: string;
  category: TaskCategory;
  type: TaskType;
  timePerUnit: number;
  scheduleRule?: ScheduleRule;
  weeklyFrequency?: number;
  tags: {
    subject?: string;
    parentRole?: string;
    difficulty?: string;
    scheduleRule?: ScheduleRule;
    weeklyFrequency?: number;
  };
  appliesTo: number[];
  createdAt: string;
  updatedAt: string;
  // 累计进度字段
  totalCompleted?: number;
  totalTarget?: number;
  progress?: number;
  // 初始数据字段
  initialCompleted?: number;
  initialUnit?: string;
  // 精细化记录字段
  trackingType?: 'simple' | 'numeric' | 'progress';
  trackingUnit?: string;
  targetValue?: number;
}

const subjectColor = (s?: string) => {
  const map: Record<string, string> = {
    'chinese': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    'math': 'bg-blue-50 text-blue-700 border border-blue-200',
    'english': 'bg-purple-50 text-purple-700 border border-purple-200',
    'sports': 'bg-orange-50 text-orange-700 border border-orange-200'
  };
  return map[s || ''] || 'bg-gray-50 text-gray-600 border border-gray-200';
};

const ruleLabel = (r?: string) => {
  const map: Record<string, string> = {
    'daily': '每日任务',
    'school': '在校日任务',
    'flexible': '智能分配',
    'weekend': '周末任务'
  };
  return map[r || ''] || '每日任务';
};

async function fetchTaskDetail(taskId: number): Promise<Task> {
  const { data } = await apiClient.get(`/tasks/${taskId}`);
  return data.data;
}

async function updateTask(taskId: number, updates: Partial<Task>): Promise<Task> {
  const { data } = await apiClient.put(`/tasks/${taskId}`, updates);
  return data.data;
}

async function deleteTask(taskId: number, childId: number): Promise<void> {
  await apiClient.delete(`/tasks/${taskId}`, { params: { childId } });
}

async function pushTaskToDingtalk(taskId: number, childId: number): Promise<void> {
  await apiClient.post(`/dingtalk/tasks/${taskId}/push-to-dingtalk`, { childId });
}

async function updateTaskInitialData(taskId: number, initialCompleted: number, initialUnit: string, childId: number): Promise<Task> {
  const { data } = await apiClient.put(`/tasks/${taskId}`, {
    initialCompleted,
    initialUnit,
    childId
  });
  return data.data;
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const taskId = id ? parseInt(id) : 0;
  const { selectedChildId } = useSelectedChild();

  // 初始数据状态
  const [initialCompleted, setInitialCompleted] = useState(0);
  const [initialUnit, setInitialUnit] = useState('页');
  const [isEditingInitial, setIsEditingInitial] = useState(false);

  // 任务编辑状态
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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
    // 精细化记录字段
    trackingType: 'simple' as 'simple' | 'numeric' | 'progress',
    trackingUnit: '',
    targetValue: 0,
  });

  const { data: task, isLoading, error } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => fetchTaskDetail(taskId),
    enabled: !!taskId
  });

  const updateInitialDataMutation = useMutation({
    mutationFn: () => updateTaskInitialData(taskId, initialCompleted, initialUnit, selectedChildId!),
    onSuccess: () => {
      toast.success('初始数据设置成功');
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setIsEditingInitial(false);
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const updateTaskMutation = useMutation({
    mutationFn: () => {
      return updateTask(taskId, {
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
          scheduleRule: formData.scheduleRule,
          weeklyFrequency: formData.weeklyFrequency,
        },
        appliesTo: task?.appliesTo || [],
        // 精细化记录字段
        trackingType: formData.trackingType,
        trackingUnit: formData.trackingUnit,
        targetValue: formData.targetValue,
      });
    },
    onSuccess: (updatedTask) => {
      toast.success('任务更新成功');
      // 直接使用返回的更新后任务数据更新本地状态
      setFormData({
        name: updatedTask.name,
        category: updatedTask.category,
        type: updatedTask.type,
        timePerUnit: updatedTask.timePerUnit,
        scheduleRule: (updatedTask.scheduleRule as ScheduleRule) || 'daily',
        weeklyFrequency: updatedTask.weeklyFrequency || 5,
        subject: updatedTask.tags?.subject ? subjectReverseMap[updatedTask.tags.subject] || '语文' : '语文',
        parentRole: updatedTask.tags?.parentRole ? parentRoleReverseMap[updatedTask.tags.parentRole] || '独立完成' : '独立完成',
        difficulty: updatedTask.tags?.difficulty ? difficultyReverseMap[updatedTask.tags.difficulty] || '基础' : '基础',
        trackingType: (updatedTask.trackingType || 'simple') as 'simple' | 'numeric' | 'progress',
        trackingUnit: updatedTask.trackingUnit || '',
        targetValue: updatedTask.targetValue || 0,
      });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setIsEditingTask(false);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: () => deleteTask(taskId, selectedChildId!),
    onSuccess: () => {
      toast.success('任务删除成功');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      navigate('/parent/tasks');
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const pushTaskToDingtalkMutation = useMutation({
    mutationFn: () => pushTaskToDingtalk(taskId, selectedChildId!),
    onSuccess: () => {
      toast.success('任务已推送到钉钉');
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  useEffect(() => {
    if (task) {
      setInitialCompleted(task.initialCompleted || 0);
      setInitialUnit(task.initialUnit || '页');
      
      // 从tags中提取scheduleRule作为备选
      const tagsScheduleRule = task.tags?.scheduleRule;
      
      // 更新表单数据
      setFormData({
        name: task.name,
        category: task.category,
        type: task.type,
        timePerUnit: task.timePerUnit,
        scheduleRule: (task.scheduleRule as ScheduleRule) || tagsScheduleRule || 'daily',
        weeklyFrequency: task.weeklyFrequency || 5,
        subject: task.tags?.subject ? subjectReverseMap[task.tags.subject] || '语文' : '语文',
        parentRole: task.tags?.parentRole ? parentRoleReverseMap[task.tags.parentRole] || '独立完成' : '独立完成',
        difficulty: task.tags?.difficulty ? difficultyReverseMap[task.tags.difficulty] || '基础' : '基础',
        // 精细化记录字段
        trackingType: (task.trackingType || 'simple') as 'simple' | 'numeric' | 'progress',
        trackingUnit: task.trackingUnit || '',
        targetValue: task.targetValue || 0,
      });
    }
  }, [task]);

  const handleSaveInitialData = () => {
    updateInitialDataMutation.mutate();
  };

  const handleSaveTask = () => {
    if (!formData.name.trim()) {
      toast.error('请输入任务名称');
      return;
    }
    updateTaskMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1360px] pb-24">
        <div className="space-y-5">
          <Skeleton className="h-10 w-48" />
          <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-6 w-48" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="mx-auto max-w-[1360px] pb-24">
        <EmptyPanel
          icon={AlertTriangle}
          title="任务不存在"
          description="该任务可能已经删除，或当前孩子没有访问权限。"
          action={<Button onClick={() => navigate('/parent/tasks')}><ArrowLeft className="w-4 h-4" />返回任务列表</Button>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1360px] space-y-5 pb-24">
      <PageToolbar
        left={
          <PageToolbarTitle
            icon={BookOpen}
            title={task.name}
            description="查看任务配置、执行规则、累计进度和历史记录"
          />
        }
        right={
          <>
          <Button 
            variant="outline" 
            className="h-11 rounded-xl bg-white"
            onClick={() => navigate('/parent/tasks')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回任务列表
          </Button>
            <Button 
              variant="outline" 
              className="h-11 rounded-xl bg-white"
              onClick={() => setIsEditingTask(!isEditingTask)}
              disabled={updateTaskMutation.isPending}
            >
              <Edit className="w-4 h-4 mr-2" />
              {isEditingTask ? '取消编辑' : '编辑任务'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => pushTaskToDingtalkMutation.mutate()}
              disabled={pushTaskToDingtalkMutation.isPending}
              className="h-11 rounded-xl border-blue-100 bg-white text-blue-600 hover:bg-blue-50"
            >
              <Send className="w-4 h-4 mr-2" />
              钉钉推送
            </Button>
          </>
        }
      />
        
        {!isEditingTask ? (
          <>
            <div className="flex flex-wrap gap-2">
              <span className={cn('text-sm px-3 py-1 rounded-full border font-medium', subjectColor(task.tags.subject))}>
                {subjectReverseMap[task.tags.subject || ''] || '其他'}
              </span>
              {task.tags.difficulty && (
                <span className='text-sm px-3 py-1 rounded-full bg-gray-50 text-gray-600 border border-gray-200'>
                  {difficultyReverseMap[task.tags.difficulty] || ''}
                </span>
              )}
              {task.tags.parentRole && (
                <span className='text-sm px-3 py-1 rounded-full bg-green-50 text-green-600 border border-green-200'>
                  {parentRoleReverseMap[task.tags.parentRole] || ''}
                </span>
              )}
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs text-muted-foreground">分配规则</div>
                <div className="mt-2 text-base font-semibold text-foreground">{ruleLabel(task.scheduleRule || task.tags?.scheduleRule)}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {(task.scheduleRule || task.tags?.scheduleRule) === 'daily' && '每天安排'}
                  {(task.scheduleRule || task.tags?.scheduleRule) === 'school' && '周一 / 周二 / 周四 / 周五'}
                  {(task.scheduleRule || task.tags?.scheduleRule) === 'flexible' && '工作日均匀安排'}
                  {(task.scheduleRule || task.tags?.scheduleRule) === 'weekend' && '周六 / 周日安排'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs text-muted-foreground">单次时长</div>
                <div className="mt-2 text-base font-semibold text-foreground">{task.timePerUnit} 分钟</div>
                <p className="mt-1 text-xs text-muted-foreground">每次执行的建议时长</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs text-muted-foreground">累计进度</div>
                <div className="mt-2 text-base font-semibold text-foreground">
                  {task.totalCompleted || 0} / {task.totalTarget || 0} {task.initialUnit || '页'}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">基于当前累计记录自动计算</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs text-muted-foreground">适用孩子</div>
                <div className="mt-2 text-base font-semibold text-foreground">{task.appliesTo?.length || 0} 个</div>
                <p className="mt-1 text-xs text-muted-foreground">当前任务的分配对象数量</p>
              </div>
            </div>
          </>
        ) : (
          <Card className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>编辑任务</CardTitle>
              <p className="text-sm text-muted-foreground">修改基础信息、执行规则和进阶配置。</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">基础信息</h3>
                  <div className="space-y-4">
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
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-gray-700">任务分类</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          variant={formData.category === '校内巩固' ? 'default' : 'outline'}
                          onClick={() => setFormData({ ...formData, category: '校内巩固' })}
                          className={`rounded-xl ${formData.category === '校内巩固' ? 'bg-primary text-primary-foreground' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          校内巩固
                        </Button>
                        <Button
                          variant={formData.category === '校内拔高' ? 'default' : 'outline'}
                          onClick={() => setFormData({ ...formData, category: '校内拔高' })}
                          className={`rounded-xl ${formData.category === '校内拔高' ? 'bg-primary text-primary-foreground' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          校内拔高
                        </Button>
                        <Button
                          variant={formData.category === '课外课程' ? 'default' : 'outline'}
                          onClick={() => setFormData({ ...formData, category: '课外课程' })}
                          className={`rounded-xl ${formData.category === '课外课程' ? 'bg-primary text-primary-foreground' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          课外课程
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          variant={formData.category === '中文阅读' ? 'default' : 'outline'}
                          onClick={() => setFormData({ ...formData, category: '中文阅读' })}
                          className={`rounded-xl ${formData.category === '中文阅读' ? 'bg-primary text-primary-foreground' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          中文阅读
                        </Button>
                        <Button
                          variant={formData.category === '英语阅读' ? 'default' : 'outline'}
                          onClick={() => setFormData({ ...formData, category: '英语阅读' })}
                          className={`rounded-xl ${formData.category === '英语阅读' ? 'bg-primary text-primary-foreground' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          英文阅读
                        </Button>
                        <Button
                          variant={formData.category === '体育运动' ? 'default' : 'outline'}
                          onClick={() => setFormData({ ...formData, category: '体育运动' })}
                          className={`rounded-xl ${formData.category === '体育运动' ? 'bg-primary text-primary-foreground' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          体育锻炼
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-gray-700">学科</Label>
                      <div className="grid grid-cols-4 gap-2">
                        <Button
                          variant={formData.subject === '语文' ? 'default' : 'outline'}
                          onClick={() => setFormData({ ...formData, subject: '语文' })}
                          className={`rounded-xl ${formData.subject === '语文' ? 'bg-primary text-primary-foreground' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          语文
                        </Button>
                        <Button
                          variant={formData.subject === '数学' ? 'default' : 'outline'}
                          onClick={() => setFormData({ ...formData, subject: '数学' })}
                          className={`rounded-xl ${formData.subject === '数学' ? 'bg-primary text-primary-foreground' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          数学
                        </Button>
                        <Button
                          variant={formData.subject === '英语' ? 'default' : 'outline'}
                          onClick={() => setFormData({ ...formData, subject: '英语' })}
                          className={`rounded-xl ${formData.subject === '英语' ? 'bg-primary text-primary-foreground' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          英语
                        </Button>
                        <Button
                          variant={formData.subject === '体育' ? 'default' : 'outline'}
                          onClick={() => setFormData({ ...formData, subject: '体育' })}
                          className={`rounded-xl ${formData.subject === '体育' ? 'bg-primary text-primary-foreground' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          体育
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">执行规则</h3>
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-gray-700">分配规则</Label>
                      <div className="grid grid-cols-4 gap-2">
                        <Button
                          variant={formData.scheduleRule === 'daily' ? 'default' : 'outline'}
                          onClick={() => setFormData({ ...formData, scheduleRule: 'daily' })}
                          className={`rounded-xl ${formData.scheduleRule === 'daily' ? 'bg-primary text-primary-foreground' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          每日任务
                        </Button>
                        <Button
                          variant={formData.scheduleRule === 'school' ? 'default' : 'outline'}
                          onClick={() => setFormData({ ...formData, scheduleRule: 'school' })}
                          className={`rounded-xl ${formData.scheduleRule === 'school' ? 'bg-primary text-primary-foreground' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          在校日任务
                        </Button>
                        <Button
                          variant={formData.scheduleRule === 'flexible' ? 'default' : 'outline'}
                          onClick={() => setFormData({ ...formData, scheduleRule: 'flexible' })}
                          className={`rounded-xl ${formData.scheduleRule === 'flexible' ? 'bg-primary text-primary-foreground' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          智能分配
                        </Button>
                        <Button
                          variant={formData.scheduleRule === 'weekend' ? 'default' : 'outline'}
                          onClick={() => setFormData({ ...formData, scheduleRule: 'weekend' })}
                          className={`rounded-xl ${formData.scheduleRule === 'weekend' ? 'bg-primary text-primary-foreground' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          周末任务
                        </Button>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                        <p className="text-center">每天安排</p>
                        <p className="text-center">周一/二/四/五</p>
                        <p className="text-center">工作日均匀安排</p>
                        <p className="text-center">周六/日安排</p>
                      </div>
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
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">单项任务时长（分钟）</Label>
                      <Input
                        type="number"
                        value={formData.timePerUnit}
                        onChange={e => setFormData({ ...formData, timePerUnit: parseInt(e.target.value) || 30 })}
                        className="rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-gray-700">完成方式</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          variant={formData.parentRole === '独立完成' ? 'default' : 'outline'}
                          onClick={() => setFormData({ ...formData, parentRole: '独立完成' })}
                          className={`rounded-xl ${formData.parentRole === '独立完成' ? 'bg-primary text-primary-foreground' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          独立完成
                        </Button>
                        <Button
                          variant={formData.parentRole === '家长陪伴' ? 'default' : 'outline'}
                          onClick={() => setFormData({ ...formData, parentRole: '家长陪伴' })}
                          className={`rounded-xl ${formData.parentRole === '家长陪伴' ? 'bg-primary text-primary-foreground' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          家长陪伴
                        </Button>
                        <Button
                          variant={formData.parentRole === '家长主导' ? 'default' : 'outline'}
                          onClick={() => setFormData({ ...formData, parentRole: '家长主导' })}
                          className={`rounded-xl ${formData.parentRole === '家长主导' ? 'bg-primary text-primary-foreground' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          家长主导
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">进阶配置</h3>
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-gray-700">难度</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          variant={formData.difficulty === '基础' ? 'default' : 'outline'}
                          onClick={() => setFormData({ ...formData, difficulty: '基础' })}
                          className={`rounded-xl ${formData.difficulty === '基础' ? 'bg-primary text-primary-foreground' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          基础
                        </Button>
                        <Button
                          variant={formData.difficulty === '提高' ? 'default' : 'outline'}
                          onClick={() => setFormData({ ...formData, difficulty: '提高' })}
                          className={`rounded-xl ${formData.difficulty === '提高' ? 'bg-primary text-primary-foreground' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          提高
                        </Button>
                        <Button
                          variant={formData.difficulty === '挑战' ? 'default' : 'outline'}
                          onClick={() => setFormData({ ...formData, difficulty: '挑战' })}
                          className={`rounded-xl ${formData.difficulty === '挑战' ? 'bg-primary text-primary-foreground' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          挑战
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 保存按钮 */}
                <Button 
                  onClick={handleSaveTask}
                  disabled={updateTaskMutation.isPending}
                  className="w-full"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateTaskMutation.isPending ? '保存中...' : '保存任务'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

      {!isEditingTask && (
        <>
          {/* Task Info */}
          <Card className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <div className='flex items-start justify-between gap-4'>
                <div>
                  <CardTitle>任务信息</CardTitle>
                  <p className='text-sm text-muted-foreground mt-1'>快速查看当前任务的执行方式、进度和关键配置。</p>
                </div>
                <div className='flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700'>
                  <AlertTriangle className='w-3.5 h-3.5' />
                  删除等高风险操作已下沉
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                <div className='flex items-center gap-3 rounded-xl bg-gray-50 p-4'>
                  <div className='w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center'>
                    <Clock className='w-4 h-4 text-primary' />
                  </div>
                  <div className='flex-1'>
                    <div className='text-xs text-gray-500'>每次时长</div>
                    <div className='text-sm font-semibold text-gray-900'>{task.timePerUnit} 分钟</div>
                  </div>
                </div>

                <div className='flex items-center gap-3 rounded-xl bg-gray-50 p-4'>
                  <div className='w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center'>
                    <Target className='w-4 h-4 text-primary' />
                  </div>
                  <div className='flex-1'>
                    <div className='text-xs text-gray-500'>分配规则</div>
                    <div className='text-sm font-semibold text-gray-900'>{ruleLabel(task.scheduleRule || task.tags?.scheduleRule)}</div>
                    <div className='text-xs text-muted-foreground mt-1'>
                      {(task.scheduleRule || task.tags?.scheduleRule) === 'daily' && '每天安排'}
                      {(task.scheduleRule || task.tags?.scheduleRule) === 'school' && '周一/二/四/五'}
                      {(task.scheduleRule || task.tags?.scheduleRule) === 'flexible' && '工作日均匀安排'}
                      {(task.scheduleRule || task.tags?.scheduleRule) === 'weekend' && '周六/日安排'}
                    </div>
                  </div>
                </div>

                <div className='flex items-center gap-3 rounded-xl bg-gray-50 p-4'>
                  <div className='w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center'>
                    <BookOpen className='w-4 h-4 text-emerald-600' />
                  </div>
                  <div className='flex-1'>
                    <div className='text-xs text-gray-500'>累计进度</div>
                    <div className='text-sm font-semibold text-gray-900'>
                      已完成 {task.totalCompleted || 0} / {task.totalTarget || 0} {task.initialUnit || '页'}
                    </div>
                  </div>
                </div>

                <div className='flex items-center gap-3 rounded-xl bg-gray-50 p-4'>
                  <div className='w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center'>
                    <BarChart3 className='w-4 h-4 text-blue-600' />
                  </div>
                  <div className='flex-1'>
                    <div className='text-xs text-gray-500'>适用孩子</div>
                    <div className='text-sm font-semibold text-gray-900'>{task.appliesTo?.length || 0} 个</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Initial Data Setting */}
          <Card className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <div className='flex items-center justify-between'>
                <div>
                  <CardTitle>初始数据设置</CardTitle>
                  <p className='text-sm text-muted-foreground mt-1'>用于设置累计型任务的起始完成量，仅在需要时修改。</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsEditingInitial(!isEditingInitial)}
                  disabled={updateInitialDataMutation.isPending}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  {isEditingInitial ? '取消' : '编辑'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label className="text-sm font-medium text-gray-700">初始完成量</Label>
                  {isEditingInitial ? (
                    <Input
                      type="number"
                      value={initialCompleted}
                      onChange={(e) => setInitialCompleted(parseInt(e.target.value) || 0)}
                      min="0"
                      className="rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  ) : (
                    <div className='p-3 bg-gray-50 rounded-xl'>
                      <div className='text-sm font-semibold text-gray-900'>{initialCompleted}</div>
                    </div>
                  )}
                </div>
                <div className='space-y-2'>
                  <Label className="text-sm font-medium text-gray-700">单位</Label>
                  {isEditingInitial ? (
                    <Select value={initialUnit} onValueChange={setInitialUnit}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="选择单位" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="页">页</SelectItem>
                        <SelectItem value="题">题</SelectItem>
                        <SelectItem value="道">道</SelectItem>
                        <SelectItem value="篇">篇</SelectItem>
                        <SelectItem value="章">章</SelectItem>
                        <SelectItem value="节">节</SelectItem>
                        <SelectItem value="分钟">分钟</SelectItem>
                        <SelectItem value="次">次</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className='p-3 bg-gray-50 rounded-xl'>
                      <div className='text-sm font-semibold text-gray-900'>{initialUnit}</div>
                    </div>
                  )}
                </div>
              </div>
              {isEditingInitial && (
                <div className='mt-4'>
                  <Button 
                    onClick={handleSaveInitialData}
                    disabled={updateInitialDataMutation.isPending}
                    className="w-full"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {updateInitialDataMutation.isPending ? '保存中...' : '保存初始数据'}
                  </Button>
                </div>
              )}
              <div className='text-xs text-gray-500 mt-2'>
                初始数据用于设置任务的起始完成量，会影响累计进度的计算。
              </div>
            </CardContent>
          </Card>

          {/* Task History */}
          <Card className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>任务历史</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='p-8 text-center text-gray-500'>
                <History className='w-12 h-12 mx-auto mb-4 text-gray-300' />
                <p className='text-base font-medium text-gray-700'>还没有打卡记录</p>
                <p className='text-sm mt-2 text-gray-500'>完成任务后，会在这里展示执行历史和累计数据。</p>
                <Button variant="outline" className='mt-5' onClick={() => navigate('/parent')}>
                  去首页打卡
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="rounded-xl border border-red-200 bg-red-50/50 shadow-sm">
            <CardHeader>
              <CardTitle className='text-red-700'>危险操作</CardTitle>
            </CardHeader>
            <CardContent className='flex items-center justify-between gap-4'>
              <div>
                <p className='text-sm font-medium text-red-700'>删除任务</p>
                <p className='text-sm text-red-600/80 mt-1'>删除后任务配置和相关计划不可恢复，请谨慎操作。</p>
              </div>
              <Button 
                variant="destructive" 
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                删除任务
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl border border-slate-200 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-red-600 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              确认删除
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 ml-[52px]">
              确定要删除任务「{task?.name}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl h-11 px-6">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTaskMutation.mutate()}
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl h-11 px-6"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
