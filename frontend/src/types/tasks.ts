export type TaskStatus = 'completed' | 'partial' | 'postponed' | 'not_completed' | 'not_involved' | 'makeup' | 'advance';
export type TaskResult = 'success' | 'partial' | 'failed';

export interface Task {  planId: number;  taskId: number;  name: string;  category: string;  type: string;  timePerUnit: number;  target?: number;  progress?: number;  completedToday?: boolean;  todayStatus?: TaskStatus;  checkinId?: number;  originalStatus?: string;  currentProgress?: number;  trackingType?: 'simple' | 'numeric' | 'progress';  trackingUnit?: string | null;  targetValue?: number | null;  status: TaskStatus;  result?: TaskResult;}
