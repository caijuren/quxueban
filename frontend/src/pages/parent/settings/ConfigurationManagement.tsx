import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Settings, Download, Upload, Activity, Clock, Cloud, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { toast } from 'sonner';

// API functions
async function getBackupHistory(): Promise<any> {
  const response = await apiClient.get('/config/backup-history');
  return response.data;
}

async function getBackupSchedule(): Promise<any> {
  const response = await apiClient.get('/scheduler/backup-schedule');
  return response.data;
}

async function saveBackupSchedule(data: { frequency: string; time: string; enabled: boolean }): Promise<any> {
  const response = await apiClient.post('/scheduler/backup-schedule', data);
  return response.data;
}

async function getCloudStorageConfigs(): Promise<any> {
  const response = await apiClient.get('/cloud-storage/configs');
  return response.data;
}

async function saveCloudStorageConfig(data: any): Promise<any> {
  const response = await apiClient.post('/cloud-storage/configs', data);
  return response.data;
}

async function deleteCloudStorageConfig(id: string): Promise<any> {
  const response = await apiClient.delete(`/cloud-storage/configs/${id}`);
  return response.data;
}

async function syncBackupToCloud(backupFileName: string): Promise<any> {
  const response = await apiClient.post('/cloud-storage/sync-backup', { backupFileName });
  return response.data;
}

async function downloadBackupFromCloud(backupFileName: string): Promise<any> {
  const response = await apiClient.post('/cloud-storage/download-backup', { backupFileName });
  return response.data;
}

async function deleteBackup(fileName: string): Promise<any> {
  const response = await apiClient.delete(`/config/delete-backup/${fileName}`);
  return response.data;
}

async function downloadBackup(fileName: string): Promise<any> {
  const response = await apiClient.get(`/config/download-backup/${fileName}`, {
    responseType: 'blob'
  });
  return response;
}

async function checkSystemStatus(): Promise<any> {
  const response = await apiClient.get('/config/system-status');
  return response.data;
}

export default function ConfigurationManagement() {
  // Configuration management state
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [systemStatus, setSystemStatus] = useState<any>(null);

  const [deletingBackup, setDeletingBackup] = useState<string | null>(null);
  
  // Auto backup settings
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoBackupFrequency, setAutoBackupFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [autoBackupTime, setAutoBackupTime] = useState('02:00');
  const [isSavingBackupSchedule, setIsSavingBackupSchedule] = useState(false);
  
  // Selective backup settings
  const [selectedBackupData, setSelectedBackupData] = useState({
    family: true,
    users: true,
    tasks: true,
    taskTemplates: true,
    books: true,
    userAIConfigs: true,
    achievements: true,
    readingLogs: true,
    bookReadStates: true,
    activeReadings: true,
    weeklyPlans: true,
    dailyCheckins: true,
    childTasks: true,
    achievementLogs: true,
    bookAIInsights: true
  });
  
  // Selective restore settings
  const [selectedRestoreData, setSelectedRestoreData] = useState({
    family: true,
    users: true,
    tasks: true,
    taskTemplates: true,
    books: true,
    userAIConfigs: true,
    achievements: true,
    readingLogs: true,
    bookReadStates: true,
    activeReadings: true,
    weeklyPlans: true,
    dailyCheckins: true,
    childTasks: true,
    achievementLogs: true,
    bookAIInsights: true
  });

  // 数据类型中文映射
  const dataTypeLabels: Record<string, string> = {
    family: '家庭信息',
    users: '用户账户',
    tasks: '任务',
    taskTemplates: '任务模板',
    books: '图书',
    userAIConfigs: 'AI配置',
    achievements: '成就',
    readingLogs: '阅读记录',
    bookReadStates: '图书阅读状态',
    activeReadings: '当前阅读',
    weeklyPlans: '周计划',
    dailyCheckins: '每日打卡',
    childTasks: '孩子任务',
    achievementLogs: '成就记录',
    bookAIInsights: '图书AI分析'
  };
  
  // Backup preview data
  const [backupPreview, setBackupPreview] = useState<any>(null);
  
  // Backup encryption settings
  const [backupPassword, setBackupPassword] = useState('');
  const [restorePassword, setRestorePassword] = useState('');
  
  // Cloud storage settings
  const [cloudStorageConfigs, setCloudStorageConfigs] = useState<any[]>([]);

  const [isSavingCloudStorage, setIsSavingCloudStorage] = useState(false);
  const [currentCloudStorageConfig, setCurrentCloudStorageConfig] = useState({
    provider: 'google' as 'google' | 'dropbox' | 'onedrive' | 'baidu',
    accessToken: '',
    refreshToken: '',
    expiresAt: '',
    isActive: false
  });

  // Load backup history
  const { data: backupHistoryData, refetch: refetchBackupHistory } = useQuery({
    queryKey: ['backup-history'],
    queryFn: getBackupHistory,
    staleTime: 0,
  });

  // Load backup schedule
  const { data: backupScheduleData } = useQuery({
    queryKey: ['backup-schedule'],
    queryFn: getBackupSchedule,
    staleTime: 0,
  });

  // Load cloud storage configs
  const { data: cloudStorageData, refetch: refetchCloudStorage } = useQuery({
    queryKey: ['cloud-storage-configs'],
    queryFn: getCloudStorageConfigs,
    staleTime: 0,
  });

  // Load auto backup schedule
  useEffect(() => {
    if (backupScheduleData?.data) {
      setAutoBackupEnabled(backupScheduleData.data.enabled);
      setAutoBackupFrequency(backupScheduleData.data.frequency);
      setAutoBackupTime(backupScheduleData.data.time);
    }
  }, [backupScheduleData]);

  // Load cloud storage configs
  useEffect(() => {
    if (cloudStorageData?.data) {
      setCloudStorageConfigs(cloudStorageData.data);
    }
  }, [cloudStorageData]);

  // Save auto backup schedule
  const saveBackupScheduleMutation = useMutation({
    mutationFn: saveBackupSchedule,
    onSuccess: () => {
      toast.success('自动备份设置保存成功');
      setIsSavingBackupSchedule(false);
    },
    onError: (error) => {
      toast.error(`保存备份计划失败：${getErrorMessage(error)}`);
      setIsSavingBackupSchedule(false);
    }
  });

  // Save cloud storage config
  const saveCloudStorageConfigMutation = useMutation({
    mutationFn: saveCloudStorageConfig,
    onSuccess: () => {
      toast.success('云存储配置保存成功');
      refetchCloudStorage();
      // Reset form
      setCurrentCloudStorageConfig({
        provider: 'google',
        accessToken: '',
        refreshToken: '',
        expiresAt: '',
        isActive: false
      });
      setIsSavingCloudStorage(false);
    },
    onError: (error) => {
      toast.error(`保存云存储配置失败：${getErrorMessage(error)}`);
      setIsSavingCloudStorage(false);
    }
  });

  // Delete cloud storage config
  const deleteCloudStorageConfigMutation = useMutation({
    mutationFn: deleteCloudStorageConfig,
    onSuccess: () => {
      toast.success('云存储配置删除成功');
      refetchCloudStorage();
    },
    onError: (error) => {
      toast.error(`删除云存储配置失败：${getErrorMessage(error)}`);
    }
  });

  // Sync backup to cloud storage
  const syncBackupToCloudMutation = useMutation({
    mutationFn: syncBackupToCloud,
    onSuccess: () => {
      toast.success('备份同步到云存储成功');
    },
    onError: (error) => {
      toast.error(`同步备份到云存储失败：${getErrorMessage(error)}`);
    }
  });

  // Download backup from cloud storage
  const downloadBackupFromCloudMutation = useMutation({
    mutationFn: downloadBackupFromCloud,
    onSuccess: () => {
      toast.success('从云存储下载备份成功');
      refetchBackupHistory();
    },
    onError: (error) => {
      toast.error(`从云存储下载备份失败：${getErrorMessage(error)}`);
    }
  });

  // Delete backup
  const deleteBackupMutation = useMutation({
    mutationFn: deleteBackup,
    onSuccess: () => {
      toast.success('备份删除成功');
      refetchBackupHistory();
      setDeletingBackup(null);
    },
    onError: (error) => {
      toast.error(`删除备份失败：${getErrorMessage(error)}`);
      setDeletingBackup(null);
    }
  });

  // Check system status
  const checkSystemStatusMutation = useMutation({
    mutationFn: checkSystemStatus,
    onSuccess: (data) => {
      setSystemStatus(data.data);
      toast.success('系统状态检查完成');
      setIsCheckingStatus(false);
    },
    onError: (error) => {
      toast.error(`检查系统状态失败：${getErrorMessage(error)}`);
      setIsCheckingStatus(false);
    }
  });

  const handleBackup = async () => {
    setIsCreatingBackup(true);
    setBackupProgress(0);
    
    // Simulate backup progress
    const progressInterval = setInterval(() => {
      setBackupProgress(prev => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return 95;
        }
        return prev + 5;
      });
    }, 200);
    
    try {
      const response = await apiClient.get('/config/backup', {
        params: {
          include: JSON.stringify(selectedBackupData),
          password: backupPassword
        },
        responseType: 'blob'
      });
      
      // Update progress to 100%
      clearInterval(progressInterval);
      setBackupProgress(100);
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Reset progress after download
      setTimeout(() => {
        setBackupProgress(0);
      }, 1000);
      
      toast.success('备份创建成功，文件已开始下载');
      // Refresh backup history
      await refetchBackupHistory();
    } catch (error) {
      console.error('Error creating backup:', error);
      clearInterval(progressInterval);
      setBackupProgress(0);
      toast.error(`创建备份失败：${getErrorMessage(error)}`);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setBackupFile(file);
      
      // Preview backup file content
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const backupData = JSON.parse(e.target?.result as string);
          setBackupPreview(backupData);
          
          // Reset selected restore data to include all by default
          setSelectedRestoreData({
            family: true,
            users: true,
            tasks: true,
            taskTemplates: true,
            books: true,
            userAIConfigs: true,
            achievements: true,
            readingLogs: true,
            bookReadStates: true,
            activeReadings: true,
            weeklyPlans: true,
            dailyCheckins: true,
            childTasks: true,
            achievementLogs: true,
            bookAIInsights: true
          });
        } catch (error) {
          console.error('Error reading backup file:', error);
          setBackupPreview(null);
          toast.error('备份文件格式错误');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleRestore = async () => {
    if (!backupFile) return;

    // Confirm restore operation
    const confirmed = window.confirm(
      '恢复操作将覆盖当前的所有配置数据，包括孩子信息、任务、图书馆、钉钉配置等。\n\n此操作不可撤销，是否继续？'
    );
    
    if (!confirmed) return;

    setIsRestoring(true);
    try {
      // Read file content
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const backupData = JSON.parse(e.target?.result as string);
          
          // Validate backup file
          if (!backupData.data) {
            throw new Error('备份文件格式错误');
          }
          
          await apiClient.post('/config/restore', { 
            backupData, 
            include: selectedRestoreData,
            password: restorePassword
          });
          toast.success('配置恢复成功，系统已更新');
        } catch (error) {
          console.error('Error parsing backup file:', error);
          toast.error('备份文件格式错误或已损坏');
        } finally {
          setIsRestoring(false);
        }
      };
      reader.onerror = () => {
        toast.error('读取备份文件失败');
        setIsRestoring(false);
      };
      reader.readAsText(backupFile);
    } catch (error) {
      console.error('Error restoring backup:', error);
      toast.error(`恢复备份失败：${getErrorMessage(error)}`);
      setIsRestoring(false);
    }
  };

  const handleCheckStatus = async () => {
    setIsCheckingStatus(true);
    checkSystemStatusMutation.mutate();
  };

  const handleSaveBackupSchedule = async () => {
    setIsSavingBackupSchedule(true);
    saveBackupScheduleMutation.mutate({
      frequency: autoBackupFrequency,
      time: autoBackupTime,
      enabled: autoBackupEnabled
    });
  };

  const handleSaveCloudStorageConfig = async () => {
    setIsSavingCloudStorage(true);
    saveCloudStorageConfigMutation.mutate(currentCloudStorageConfig);
  };

  const handleDeleteCloudStorageConfig = async (id: string) => {
    if (window.confirm('确定要删除这个云存储配置吗？')) {
      deleteCloudStorageConfigMutation.mutate(id);
    }
  };

  const handleSyncBackupToCloud = async (backupFileName: string) => {
    syncBackupToCloudMutation.mutate(backupFileName);
  };



  const handleDownloadBackup = async (fileName: string) => {
    try {
      const response = await downloadBackup(fileName);
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('备份下载成功');
    } catch (error) {
      console.error('Error downloading backup:', error);
      toast.error('下载备份失败');
    }
  };

  const handleDeleteBackup = async (fileName: string) => {
    const confirmed = window.confirm(
      '确定要删除这个备份文件吗？此操作不可撤销！'
    );
    
    if (!confirmed) return;

    setDeletingBackup(fileName);
    deleteBackupMutation.mutate(fileName);
  };

  return (
    <div className="space-y-3">
      {/* Backup Configuration */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="border border-border shadow-sm rounded-lg">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold text-foreground">备份配置</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">创建和管理系统配置备份</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-3">
            {/* Create Backup */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-foreground">创建备份</h3>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="backup-password" className="text-xs text-muted-foreground">备份密码（可选）</Label>
                  <Input
                    id="backup-password"
                    type="password"
                    value={backupPassword}
                    onChange={(e) => setBackupPassword(e.target.value)}
                    placeholder="设置备份密码以加密备份文件"
                    className="h-9 rounded-lg text-sm bg-muted/50 border-0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">选择要备份的数据类型</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Object.entries(selectedBackupData).map(([key, value]) => (
                      <label key={key} className="flex items-center text-foreground">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => setSelectedBackupData(prev => ({ ...prev, [key]: e.target.checked }))}
                          className="w-3.5 h-3.5 text-primary border-border rounded focus:ring-primary"
                        />
                        <span className="ml-1.5 text-xs">{dataTypeLabels[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={handleBackup}
                  disabled={isCreatingBackup}
                  className="w-full h-9 rounded-lg bg-primary text-primary-foreground"
                >
                  {isCreatingBackup ? (
                    <>
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5"></div>
                      创建中... {backupProgress}%
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      创建备份
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Restore Backup */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-foreground">恢复备份</h3>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="backup-file" className="text-xs text-muted-foreground">选择备份文件</Label>
                  <Input
                    id="backup-file"
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="h-9 rounded-lg text-sm bg-muted/50 border-0"
                  />
                </div>
                {backupFile && (
                  <div className="space-y-1">
                    <Label htmlFor="restore-password" className="text-xs text-muted-foreground">备份密码（如果有）</Label>
                    <Input
                      id="restore-password"
                      type="password"
                      value={restorePassword}
                      onChange={(e) => setRestorePassword(e.target.value)}
                      placeholder="输入备份文件的密码"
                      className="h-9 rounded-lg text-sm bg-muted/50 border-0"
                    />
                  </div>
                )}
                {backupPreview && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">选择要恢复的数据类型</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.entries(selectedRestoreData).map(([key, value]) => (
                        <label key={key} className="flex items-center text-foreground">
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => setSelectedRestoreData(prev => ({ ...prev, [key]: e.target.checked }))}
                            className="w-3.5 h-3.5 text-primary border-border rounded focus:ring-primary"
                          />
                          <span className="ml-1.5 text-xs">{dataTypeLabels[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <Button
                  onClick={handleRestore}
                  disabled={isRestoring || !backupFile}
                  className="w-full h-9 rounded-lg bg-primary text-primary-foreground"
                >
                  {isRestoring ? (
                    <>
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5"></div>
                      恢复中...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      恢复备份
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Backup History */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-foreground">备份历史</h3>
              {backupHistoryData?.data && backupHistoryData.data.length > 0 ? (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-2">
                  {backupHistoryData.data.map((backup: any) => (
                    <div key={backup.fileName} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border">
                      <div>
                        <p className="font-medium text-foreground text-xs">{backup.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          创建时间：{new Date(backup.createdAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadBackup(backup.fileName)}
                          className="h-7 px-2 rounded-lg text-xs"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          下载
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSyncBackupToCloud(backup.fileName)}
                          className="h-7 px-2 rounded-lg text-xs"
                        >
                          <Cloud className="w-3 h-3 mr-1" />
                          同步到云
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteBackup(backup.fileName)}
                          disabled={deletingBackup === backup.fileName}
                          className="h-7 px-2 rounded-lg text-xs"
                        >
                          {deletingBackup === backup.fileName ? (
                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1"></div>
                          ) : (
                            <Trash2 className="w-3 h-3 mr-1" />
                          )}
                          {deletingBackup === backup.fileName ? '删除中' : '删除'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  暂无备份历史
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.section>

      {/* Auto Backup Settings */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.1 }}
      >
        <Card className="border border-border shadow-sm rounded-lg">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-base font-semibold text-foreground">自动备份设置</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">配置系统自动备份计划</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-foreground">启用自动备份</h3>
                <p className="text-xs text-muted-foreground">系统将按照设定的频率自动创建备份</p>
              </div>
              <Switch
                checked={autoBackupEnabled}
                onCheckedChange={setAutoBackupEnabled}
                className="data-[state=checked]:bg-primary"
              />
            </div>
            
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="backup-frequency" className="text-xs text-muted-foreground">备份频率</Label>
                <Select
                  value={autoBackupFrequency}
                  onValueChange={(value) => setAutoBackupFrequency(value as 'daily' | 'weekly' | 'monthly')}
                >
                  <SelectTrigger id="backup-frequency" className="h-10 rounded-lg">
                    <SelectValue placeholder="选择备份频率" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">每天</SelectItem>
                    <SelectItem value="weekly">每周</SelectItem>
                    <SelectItem value="monthly">每月</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="backup-time" className="text-xs text-muted-foreground">备份时间</Label>
                <Input
                  id="backup-time"
                  type="time"
                  value={autoBackupTime}
                  onChange={(e) => setAutoBackupTime(e.target.value)}
                  className="h-10 rounded-lg text-sm bg-muted/50 border-0"
                />
              </div>
              
              <Button
                onClick={handleSaveBackupSchedule}
                disabled={isSavingBackupSchedule}
                className="w-full h-10 rounded-lg bg-primary text-primary-foreground"
              >
                {isSavingBackupSchedule ? (
                  <>
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5"></div>
                    保存中...
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 mr-1.5" />
                    保存备份计划
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.section>

      {/* Cloud Storage Settings */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.2 }}
      >
        <Card className="border border-border shadow-sm rounded-lg">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-base font-semibold text-foreground">云存储设置</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">配置云存储服务以同步备份</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">添加云存储配置</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cloud-provider" className="text-xs text-muted-foreground">云服务提供商</Label>
                  <Select
                    value={currentCloudStorageConfig.provider}
                    onValueChange={(value) => setCurrentCloudStorageConfig(prev => ({ ...prev, provider: value as 'google' | 'dropbox' | 'onedrive' | 'baidu' }))}
                  >
                    <SelectTrigger id="cloud-provider" className="h-10 rounded-lg">
                      <SelectValue placeholder="选择云服务提供商" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google">Google Drive</SelectItem>
                      <SelectItem value="dropbox">Dropbox</SelectItem>
                      <SelectItem value="onedrive">OneDrive</SelectItem>
                      <SelectItem value="baidu">百度网盘</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="access-token" className="text-xs text-muted-foreground">Access Token</Label>
                  <Input
                    id="access-token"
                    type="password"
                    value={currentCloudStorageConfig.accessToken}
                    onChange={(e) => setCurrentCloudStorageConfig(prev => ({ ...prev, accessToken: e.target.value }))}
                    placeholder="输入Access Token"
                    className="h-10 rounded-lg text-sm bg-muted/50 border-0"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="refresh-token" className="text-xs text-muted-foreground">Refresh Token（可选）</Label>
                  <Input
                    id="refresh-token"
                    type="password"
                    value={currentCloudStorageConfig.refreshToken}
                    onChange={(e) => setCurrentCloudStorageConfig(prev => ({ ...prev, refreshToken: e.target.value }))}
                    placeholder="输入Refresh Token"
                    className="h-10 rounded-lg text-sm bg-muted/50 border-0"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="expires-at" className="text-xs text-muted-foreground">过期时间（可选）</Label>
                  <Input
                    id="expires-at"
                    type="text"
                    value={currentCloudStorageConfig.expiresAt}
                    onChange={(e) => setCurrentCloudStorageConfig(prev => ({ ...prev, expiresAt: e.target.value }))}
                    placeholder="输入过期时间"
                    className="h-10 rounded-lg text-sm bg-muted/50 border-0"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">设为默认</Label>
                  <Switch
                    checked={currentCloudStorageConfig.isActive}
                    onCheckedChange={(value) => setCurrentCloudStorageConfig(prev => ({ ...prev, isActive: value }))}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
                
                <Button
                  onClick={handleSaveCloudStorageConfig}
                  disabled={isSavingCloudStorage}
                  className="w-full h-10 rounded-lg bg-primary text-primary-foreground"
                >
                  {isSavingCloudStorage ? (
                    <>
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5"></div>
                      保存中...
                    </>
                  ) : (
                    <>
                      <Cloud className="w-3.5 h-3.5 mr-1.5" />
                      保存云存储配置
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {/* Existing Cloud Storage Configs */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">已配置的云存储</h3>
              {cloudStorageConfigs.length > 0 ? (
                <div className="space-y-2">
                  {cloudStorageConfigs.map((config: any) => (
                    <div key={config.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                      <div>
                        <p className="font-medium text-foreground">
                          {config.provider === 'google' ? 'Google Drive' : 
                           config.provider === 'dropbox' ? 'Dropbox' : 
                           config.provider === 'onedrive' ? 'OneDrive' : '百度网盘'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {config.isActive ? '当前使用' : '已保存'}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteCloudStorageConfig(config.id)}
                        className="h-8 px-3 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        删除
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  暂无云存储配置
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.section>

      {/* System Status */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.3 }}
      >
        <Card className="border border-border shadow-sm rounded-lg">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-base font-semibold text-foreground">系统状态</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">检查系统运行状态和资源使用情况</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <Button
              onClick={handleCheckStatus}
              disabled={isCheckingStatus}
              className="w-full h-10 rounded-lg bg-primary text-primary-foreground"
            >
              {isCheckingStatus ? (
                <>
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5"></div>
                  检查中...
                </>
              ) : (
                <>
                  <Activity className="w-3.5 h-3.5 mr-1.5" />
                  检查系统状态
                </>
              )}
            </Button>
            
            {systemStatus && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">系统状态信息</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50 border border-border">
                    <span className="text-sm font-medium text-foreground">系统状态</span>
                    <span className={`text-sm font-semibold ${systemStatus.status === 'healthy' ? 'text-success' : 'text-destructive'}`}>
                      {systemStatus.status === 'healthy' ? '健康' : '异常'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50 border border-border">
                    <span className="text-sm font-medium text-foreground">数据库连接</span>
                    <span className={`text-sm font-semibold ${systemStatus.databaseConnected ? 'text-success' : 'text-destructive'}`}>
                      {systemStatus.databaseConnected ? '已连接' : '未连接'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50 border border-border">
                    <span className="text-sm font-medium text-foreground">内存使用</span>
                    <span className="text-sm font-semibold text-foreground">
                      {systemStatus.memoryUsage}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50 border border-border">
                    <span className="text-sm font-medium text-foreground">磁盘使用</span>
                    <span className="text-sm font-semibold text-foreground">
                      {systemStatus.diskUsage}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50 border border-border">
                    <span className="text-sm font-medium text-foreground">系统版本</span>
                    <span className="text-sm font-semibold text-foreground">
                      {systemStatus.version}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.section>
    </div>
  );
}
