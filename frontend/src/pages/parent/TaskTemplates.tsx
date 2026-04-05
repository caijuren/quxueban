import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Edit2, Trash2, BookOpen, Calculator, Dumbbell, GraduationCap, Languages, BookMarked,
  Calendar, Clock, User, Check, X, ChevronDown, Settings2, Copy, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================
// 类型定义
// ============================================

type TaskType = '校内任务' | '阅读任务' | '体育运动' | '课外课程';
type ScheduleRule = 'daily' | 'school_day' | 'flexible' | 'weekend';
type Subject = 'chinese' | 'math' | 'english' | 'sports' | null;

interface TaskTemplate {
  id: number;
  name: string;
  type: TaskType;
  subject: Subject;
  singleDuration: number;
  difficulty: string;
  description: string | null;
  scheduleRule: ScheduleRule;
  defaultWeeklyTarget: number | null;
  isActive: boolean;
}

interface ChildTask {
  id: number;
  childId: number;
  taskTemplateId: number;
  customName: string | null;
  customDuration: number | null;
  customScheduleRule: ScheduleRule | null;
  weeklyTarget: number | null;
  status: 'active' | 'paused';
  skipHolidays: boolean;
  excludeDays: string | null;
  templateName: string;
  templateType: TaskType;
  subject: Subject;
  templateDuration: number;
}

interface Child {
  id: number;
  name: string;
  avatar: string;
}

// ============================================
// 配置常量
// ============================================

const SCHEDULE_RULE_CONFIG: Record<ScheduleRule, { label: string; description: string; days: string }> = {
  'daily': { label: '每天', description: '周一至周日', days: '一二三四五六日' },
  'school_day': { label: '在校日', description: '周一至周五', days: '一二三四五' },
  'weekend': { label: '周末', description: '周六、周日', days: '六日' },
  'flexible': { label: '灵活', description: '自定义次数', days: '' },
};

const TYPE_CONFIG: Record<TaskType, { icon: any; gradient: string; color: string }> = {
  '校内任务': { icon: BookOpen, gradient: 'from-blue-400 to-cyan-400', color: 'text-blue-600' },
  '阅读任务': { icon: BookMarked, gradient: 'from-purple-400 to-pink-400', color: 'text-purple-600' },
  '体育运动': { icon: Dumbbell, gradient: 'from-green-400 to-emerald-400', color: 'text-green-600' },
  '课外课程': { icon: GraduationCap, gradient: 'from-orange-400 to-amber-400', color: 'text-orange-600' },
};

const SUBJECT_CONFIG: Record<string, { label: string; icon: any }> = {
  'chinese': { label: '语文', icon: BookOpen },
  'math': { label: '数学', icon: Calculator },
  'english': { label: '英语', icon: Languages },
  'sports': { label: '体育', icon: Dumbbell },
};

// ============================================
// API 函数
// ============================================

async function fetchTemplates(): Promise<TaskTemplate[]> {
  const r = await apiClient.get('/task-templates/templates');
  return r.data.data || [];
}

async function fetchChildren(): Promise<Child[]> {
  const r = await apiClient.get('/children');
  return r.data.data || [];
}

async function fetchChildTasks(childId: number): Promise<ChildTask[]> {
  const r = await apiClient.get(`/task-templates/children/${childId}/tasks`);
  return r.data.data || [];
}

async function createTemplate(data: Partial<TaskTemplate>): Promise<TaskTemplate> {
  const r = await apiClient.post('/task-templates/templates', data);
  return r.data.data;
}

async function updateTemplate(id: number, data: Partial<TaskTemplate>): Promise<TaskTemplate> {
  const r = await apiClient.put(`/task-templates/templates/${id}`, data);
  return r.data.data;
}

async function deleteTemplate(id: number): Promise<void> {
  await apiClient.delete(`/task-templates/templates/${id}`);
}

async function assignTaskToChild(childId: number, data: Partial<ChildTask>): Promise<ChildTask> {
  const r = await apiClient.post(`/task-templates/children/${childId}/tasks`, data);
  return r.data.data;
}

async function updateChildTask(childId: number, taskId: number, data: Partial<ChildTask>): Promise<ChildTask> {
  const r = await apiClient.put(`/task-templates/children/${childId}/tasks/${taskId}`, data);
  return r.data.data;
}

async function deleteChildTask(childId: number, taskId: number): Promise<void> {
  await apiClient.delete(`/task-templates/children/${childId}/tasks/${taskId}`);
}

async function batchAssign(templateId: number, childIds: number[]): Promise<any> {
  const r = await apiClient.post(`/task-templates/templates/${templateId}/assign`, { childIds });
  return r.data.data;
}

// ============================================
// 主组件
// ============================================

export default function TaskTemplatesPage() {
  const queryClient = useQueryClient();
  
  // 状态管理
  const [activeTab, setActiveTab] = useState<'templates' | 'children'>('templates');
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editTaskDialogOpen, setEditTaskDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [selectedTask, setSelectedTask] = useState<ChildTask | null>(null);
  
  // 表单数据
  const [templateForm, setTemplateForm] = useState({
    name: '',
    type: '校内任务' as TaskType,
    subject: null as Subject,
    singleDuration: 30,
    scheduleRule: 'daily' as ScheduleRule,
    defaultWeeklyTarget: null as number | null,
    description: '',
  });

  // 数据查询
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['task-templates'],
    queryFn: fetchTemplates,
  });

  const { data: children = [] } = useQuery({
    queryKey: ['children'],
    queryFn: fetchChildren,
  });

  const { data: childTasks = [], isLoading: childTasksLoading } = useQuery({
    queryKey: ['child-tasks', selectedChildId],
    queryFn: () => selectedChildId ? fetchChildTasks(selectedChildId) : Promise.resolve([]),
    enabled: !!selectedChildId,
  });

  // 自动选择第一个孩子
  useMemo(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  // Mutations
  const createTemplateMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-templates'] });
      toast.success('模板创建成功');
      setTemplateDialogOpen(false);
      resetTemplateForm();
    },
    onError: (e: any) => toast.error(getErrorMessage(e)),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: (data: { id: number; data: Partial<TaskTemplate> }) => updateTemplate(data.id, data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-templates'] });
      toast.success('模板更新成功');
      setTemplateDialogOpen(false);
    },
    onError: (e: any) => toast.error(getErrorMessage(e)),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-templates'] });
      toast.success('模板已删除');
      setDeleteDialogOpen(false);
    },
    onError: (e: any) => toast.error(getErrorMessage(e)),
  });

  const assignTaskMutation = useMutation({
    mutationFn: (data: { childId: number; data: Partial<ChildTask> }) => assignTaskToChild(data.childId, data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['child-tasks', selectedChildId] });
      toast.success('任务分配成功');
      setAssignDialogOpen(false);
    },
    onError: (e: any) => toast.error(getErrorMessage(e)),
  });

  const updateChildTaskMutation = useMutation({
    mutationFn: (data: { childId: number; taskId: number; data: Partial<ChildTask> }) => 
      updateChildTask(data.childId, data.taskId, data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['child-tasks', selectedChildId] });
      toast.success('任务更新成功');
      setEditTaskDialogOpen(false);
    },
    onError: (e: any) => toast.error(getErrorMessage(e)),
  });

  const deleteChildTaskMutation = useMutation({
    mutationFn: (data: { childId: number; taskId: number }) => deleteChildTask(data.childId, data.taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['child-tasks', selectedChildId] });
      toast.success('任务已移除');
      setDeleteDialogOpen(false);
    },
    onError: (e: any) => toast.error(getErrorMessage(e)),
  });

  const batchAssignMutation = useMutation({
    mutationFn: (data: { templateId: number; childIds: number[] }) => batchAssign(data.templateId, data.childIds),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['child-tasks'] });
      toast.success(`已为 ${result.filter((r: any) => r.status === 'created').length} 个孩子分配任务`);
      setAssignDialogOpen(false);
    },
    onError: (e: any) => toast.error(getErrorMessage(e)),
  });

  // 辅助函数
  const resetTemplateForm = () => {
    setTemplateForm({
      name: '',
      type: '校内任务',
      subject: null,
      singleDuration: 30,
      scheduleRule: 'daily',
      defaultWeeklyTarget: null,
      description: '',
    });
    setSelectedTemplate(null);
  };

  const handleEditTemplate = (template: TaskTemplate) => {
    setSelectedTemplate(template);
    setTemplateForm({
      name: template.name,
      type: template.type,
      subject: template.subject,
      singleDuration: template.singleDuration,
      scheduleRule: template.scheduleRule,
      defaultWeeklyTarget: template.defaultWeeklyTarget,
      description: template.description || '',
    });
    setTemplateDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!templateForm.name.trim()) {
      toast.error('请输入任务名称');
      return;
    }
    if (selectedTemplate) {
      updateTemplateMutation.mutate({ id: selectedTemplate.id, data: templateForm });
    } else {
      createTemplateMutation.mutate(templateForm);
    }
  };

  const handleAssignTask = (template: TaskTemplate) => {
    setSelectedTemplate(template);
    setAssignDialogOpen(true);
  };

  const handleEditChildTask = (task: ChildTask) => {
    setSelectedTask(task);
    setEditTaskDialogOpen(true);
  };

  const handleDeleteChildTask = (task: ChildTask) => {
    setSelectedTask(task);
    setDeleteDialogOpen(true);
  };

  const getChildName = (childId: number) => {
    return children.find(c => c.id === childId)?.name || '未知';
  };

  // 按类型分组模板
  const templatesByType = useMemo(() => {
    const grouped: Record<TaskType, TaskTemplate[]> = {
      '校内任务': [],
      '阅读任务': [],
      '体育运动': [],
      '课外课程': [],
    };
    templates.forEach(t => {
      if (grouped[t.type]) {
        grouped[t.type].push(t);
      }
    });
    return grouped;
  }, [templates]);

  const selectedChild = children.find(c => c.id === selectedChildId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">任务管理中心</h1>
            <p className="text-gray-500 mt-1">智能任务模板库 + 多孩子实例化管理</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
          <TabsList className="bg-white shadow-sm">
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              任务模板库
            </TabsTrigger>
            <TabsTrigger value="children" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              孩子任务实例
            </TabsTrigger>
          </TabsList>

          {/* ============================================ */}
          {/* 任务模板库 Tab */}
          {/* ============================================ */}
          <TabsContent value="templates">
            <div className="flex justify-end mb-4">
              <Button
                onClick={() => { resetTemplateForm(); setTemplateDialogOpen(true); }}
                className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                创建模板
              </Button>
            </div>

            {templatesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64 rounded-2xl" />)}
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-20 text-gray-500">
                <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">暂无任务模板</p>
                <p className="text-sm mt-2">点击上方"创建模板"按钮开始</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {(Object.entries(templatesByType) as [TaskType, TaskTemplate[]][]).map(([type, typeTemplates]) => (
                  <motion.div
                    key={type}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl shadow-lg overflow-hidden"
                  >
                    <div className={cn(
                      "px-4 py-3 bg-gradient-to-r",
                      TYPE_CONFIG[type]?.gradient || 'from-gray-400 to-gray-500'
                    )}>
                      <div className="flex items-center gap-2 text-white">
                        {TYPE_CONFIG[type] ? (
                          (() => {
                            const IconComponent = TYPE_CONFIG[type].icon;
                            return <IconComponent className="w-5 h-5" />;
                          })()
                        ) : null}
                        <h2 className="font-semibold">{type}</h2>
                      </div>
                      <p className="text-white/70 text-sm">{typeTemplates.length} 个模板</p>
                    </div>
                    <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                      {typeTemplates.length === 0 ? (
                        <p className="text-gray-400 text-center py-4 text-sm">暂无模板</p>
                      ) : (
                        typeTemplates.map(template => {
                          const Icon = TYPE_CONFIG[template.type]?.icon || BookOpen;
                          return (
                            <motion.div
                              key={template.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-100/50 transition-colors group"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br",
                                    TYPE_CONFIG[template.type]?.gradient
                                  )}>
                                    <Icon className="w-4 h-4 text-white" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900 text-sm">{template.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant="outline" className="text-xs">
                                        {SCHEDULE_RULE_CONFIG[template.scheduleRule]?.label}
                                      </Badge>
                                      <span className="text-xs text-gray-500 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {template.singleDuration}分钟
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-blue-600"
                                  onClick={() => handleEditTemplate(template)}
                                >
                                  <Edit2 className="w-3 h-3 mr-1" />
                                  编辑
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-green-600"
                                  onClick={() => handleAssignTask(template)}
                                >
                                  <User className="w-3 h-3 mr-1" />
                                  分配
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-red-600"
                                  onClick={() => { setSelectedTemplate(template); setDeleteDialogOpen(true); }}
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  删除
                                </Button>
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ============================================ */}
          {/* 孩子任务实例 Tab */}
          {/* ============================================ */}
          <TabsContent value="children">
            {/* 孩子切换器 */}
            <div className="flex items-center gap-4 mb-6">
              <span className="text-gray-600 font-medium">选择孩子：</span>
              <div className="flex gap-2">
                {children.map(child => (
                  <Button
                    key={child.id}
                    variant={selectedChildId === child.id ? 'default' : 'outline'}
                    size="lg"
                    onClick={() => setSelectedChildId(child.id)}
                    className={cn(
                      "flex items-center gap-2",
                      selectedChildId === child.id && "bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
                    )}
                  >
                    <span className="text-xl">{child.avatar}</span>
                    {child.name}
                  </Button>
                ))}
              </div>
            </div>

            {selectedChild && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">{selectedChild.avatar}</span>
                    {selectedChild.name} 的任务列表
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (templates.length > 0) {
                        setSelectedTemplate(null);
                        setAssignDialogOpen(true);
                      } else {
                        toast.error('请先创建任务模板');
                      }
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    添加任务
                  </Button>
                </CardHeader>
                <CardContent>
                  {childTasksLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
                    </div>
                  ) : childTasks.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>暂无任务实例</p>
                      <p className="text-sm mt-1">点击"添加任务"为孩子分配任务</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {childTasks.map(task => (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "p-4 rounded-xl border transition-all",
                            task.status === 'paused' 
                              ? "bg-gray-100 border-gray-200 opacity-60" 
                              : "bg-white border-gray-100 hover:shadow-md"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
<div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br",
                                TYPE_CONFIG[task.templateType]?.gradient
                              )}>
                                {TYPE_CONFIG[task.templateType] ? (
                                  (() => {
                                    const IconComponent = TYPE_CONFIG[task.templateType].icon;
                                    return <IconComponent className="w-5 h-5 text-white" />;
                                  })()
                                ) : null}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {task.customName || task.templateName}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant={task.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                                    {task.status === 'active' ? '生效中' : '已暂停'}
                                  </Badge>
                                  <span className="text-xs text-gray-500">
                                    {SCHEDULE_RULE_CONFIG[task.customScheduleRule || 'daily']?.label}
                                    {task.customScheduleRule === 'flexible' && task.weeklyTarget && ` (${task.weeklyTarget}次/周)`}
                                  </span>
                                  <span className="text-xs text-gray-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {task.customDuration || task.templateDuration}分钟
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditChildTask(task)}
                              >
                                <Settings2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600"
                                onClick={() => handleDeleteChildTask(task)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ============================================ */}
      {/* 创建/编辑模板对话框 */}
      {/* ============================================ */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedTemplate ? '编辑模板' : '创建任务模板'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>任务名称 *</Label>
              <Input
                value={templateForm.name}
                onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                placeholder="例如：语文作业、数学练习..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>任务类型</Label>
                <Select value={templateForm.type} onValueChange={v => setTemplateForm({ ...templateForm, type: v as TaskType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="校内任务">校内任务</SelectItem>
                    <SelectItem value="阅读任务">阅读任务</SelectItem>
                    <SelectItem value="体育运动">体育运动</SelectItem>
                    <SelectItem value="课外课程">课外课程</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>单次时长(分钟)</Label>
                <Input
                  type="number"
                  value={templateForm.singleDuration}
                  onChange={e => setTemplateForm({ ...templateForm, singleDuration: parseInt(e.target.value) || 30 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>安排规则</Label>
              <Select value={templateForm.scheduleRule} onValueChange={v => setTemplateForm({ ...templateForm, scheduleRule: v as ScheduleRule })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SCHEDULE_RULE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div>
                        <span>{config.label}</span>
                        <span className="text-gray-400 text-xs ml-2">({config.description})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {templateForm.scheduleRule === 'flexible' && (
              <div className="space-y-2">
                <Label>默认每周次数</Label>
                <Input
                  type="number"
                  value={templateForm.defaultWeeklyTarget || ''}
                  onChange={e => setTemplateForm({ ...templateForm, defaultWeeklyTarget: parseInt(e.target.value) || null })}
                  placeholder="例如：3"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>备注说明</Label>
              <Input
                value={templateForm.description}
                onChange={e => setTemplateForm({ ...templateForm, description: e.target.value })}
                placeholder="可选"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>取消</Button>
            <Button onClick={handleSaveTemplate} disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}>
              {createTemplateMutation.isPending || updateTemplateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* 分配任务对话框 */}
      {/* ============================================ */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {activeTab === 'children' ? '为孩子添加任务' : '分配任务给多个孩子'}
            </DialogTitle>
          </DialogHeader>
          {activeTab === 'templates' ? (
            // 从模板库分配
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>选择孩子（可多选）</Label>
                <div className="space-y-2">
                  {children.map(child => (
                    <label key={child.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" className="rounded" />
                      <span className="text-xl">{child.avatar}</span>
                      <span>{child.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // 从孩子实例管理添加
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>选择任务模板</Label>
                <Select onValueChange={v => setSelectedTemplate(templates.find(t => t.id === parseInt(v)) || null)}>
                  <SelectTrigger><SelectValue placeholder="选择一个模板" /></SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>取消</Button>
            <Button 
              onClick={() => {
                if (activeTab === 'children' && selectedTemplate && selectedChildId) {
                  assignTaskMutation.mutate({
                    childId: selectedChildId,
                    data: { taskTemplateId: selectedTemplate.id }
                  });
                }
              }}
              disabled={assignTaskMutation.isPending}
            >
              {assignTaskMutation.isPending ? '分配中...' : '确认分配'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* 编辑孩子任务对话框 */}
      {/* ============================================ */}
      <Dialog open={editTaskDialogOpen} onOpenChange={setEditTaskDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>个性化配置</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-gray-500">
                原模板：{selectedTask.templateName} ({selectedTask.templateDuration}分钟)
              </p>
              <div className="space-y-2">
                <Label>自定义名称（可选）</Label>
                <Input placeholder={selectedTask.templateName} />
              </div>
              <div className="space-y-2">
                <Label>自定义时长（可选）</Label>
                <Input type="number" placeholder={selectedTask.templateDuration.toString()} />
              </div>
              <div className="flex items-center justify-between">
                <Label>避开节假日</Label>
                <Switch defaultChecked={selectedTask.skipHolidays} />
              </div>
              <div className="space-y-2">
                <Label>任务状态</Label>
                <Select defaultValue={selectedTask.status}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">生效中</SelectItem>
                    <SelectItem value="paused">已暂停</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTaskDialogOpen(false)}>取消</Button>
            <Button onClick={() => {
              if (selectedTask && selectedChildId) {
                updateChildTaskMutation.mutate({
                  childId: selectedChildId,
                  taskId: selectedTask.id,
                  data: { status: 'active' }
                });
              }
            }}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* 删除确认对话框 */}
      {/* ============================================ */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              {activeTab === 'templates' 
                ? `确定要删除模板「${selectedTemplate?.name}」吗？此操作不可撤销。`
                : `确定要移除任务「${selectedTask?.customName || selectedTask?.templateName}」吗？`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (activeTab === 'templates' && selectedTemplate) {
                  deleteTemplateMutation.mutate(selectedTemplate.id);
                } else if (selectedTask && selectedChildId) {
                  deleteChildTaskMutation.mutate({ childId: selectedChildId, taskId: selectedTask.id });
                }
              }}
              className="bg-red-500 hover:bg-red-600"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}