import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const reportsRouter: Router = Router();

// ============================================
// Report Routes
// ============================================

/**
 * GET /reports - Get all reports for the family
 * Query params: type, childId
 */
reportsRouter.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { userId } = req.user!;
  const { type, childId } = req.query;

  // Get user's family
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { familyId: true },
  });

  if (!user) {
    throw new AppError(404, '用户不存在');
  }

  const where: any = {
    familyId: user.familyId,
  };

  if (type) {
    where.type = type as string;
  }

  if (childId) {
    where.childId = parseInt(childId as string);
  }

  const reports = await prisma.report.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      child: {
        select: { id: true, name: true, avatar: true },
      },
    },
  });

  res.json({
    status: 'success',
    data: reports.map((report) => ({
      ...report,
      childName: report.child?.name,
      childAvatar: report.child?.avatar,
    })),
  });
});

/**
 * GET /reports/:id - Get a single report
 */
reportsRouter.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { userId } = req.user!;
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { familyId: true },
  });

  if (!user) {
    throw new AppError(404, '用户不存在');
  }

  const report = await prisma.report.findFirst({
    where: {
      id: parseInt(id),
      familyId: user.familyId,
    },
    include: {
      child: {
        select: { id: true, name: true, avatar: true },
      },
    },
  });

  if (!report) {
    throw new AppError(404, '报告不存在');
  }

  res.json({
    status: 'success',
    data: {
      ...report,
      childName: report.child?.name,
      childAvatar: report.child?.avatar,
    },
  });
});

/**
 * POST /reports/generate - Generate a new report
 */
reportsRouter.post('/generate', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { userId } = req.user!;
  const { type, childId, startDate, endDate, subjects } = req.body;

  if (!type || !startDate || !endDate) {
    throw new AppError(400, '缺少必要参数');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { familyId: true, name: true },
  });

  if (!user) {
    throw new AppError(404, '用户不存在');
  }

  // Get statistics data for the period
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Get tasks data
  const tasksWhere: any = {
    familyId: user.familyId,
    createdAt: {
      gte: start,
      lte: end,
    },
  };

  if (childId) {
    tasksWhere.appliesTo = {
      array_contains: parseInt(childId),
    };
  }

  // Get weekly plans for the period
  const weeklyPlans = await prisma.weeklyPlan.findMany({
    where: {
      familyId: user.familyId,
      ...(childId ? { childId: parseInt(childId) } : {}),
      createdAt: {
        gte: start,
        lte: end,
      },
    },
    include: {
      task: true,
      child: {
        select: { name: true },
      },
    },
  });

  // Calculate statistics
  const totalTasks = weeklyPlans.length;
  const totalTarget = weeklyPlans.reduce((sum, plan) => sum + plan.target, 0);
  const totalProgress = weeklyPlans.reduce((sum, plan) => sum + plan.progress, 0);
  const completionRate = totalTarget > 0 ? Math.round((totalProgress / totalTarget) * 100) : 0;
  const totalTime = weeklyPlans.reduce((sum, plan) => {
    const taskTime = plan.task?.timePerUnit || 30;
    return sum + (plan.progress * taskTime);
  }, 0);

  // Calculate subject distribution
  const subjectStats: Record<string, number> = {};
  weeklyPlans.forEach((plan) => {
    const subject = (plan.task?.tags as any)?.subject || '其他';
    const taskTime = plan.task?.timePerUnit || 30;
    subjectStats[subject] = (subjectStats[subject] || 0) + (plan.progress * taskTime);
  });

  // Calculate daily trend
  const dailyTrend: Array<{ day: string; rate: number }> = [];
  const dailyStats: Record<string, { completed: number; total: number }> = {};

  weeklyPlans.forEach((plan) => {
    const assignedDays = plan.assignedDays as string[] || [];
    assignedDays.forEach((day) => {
      if (!dailyStats[day]) {
        dailyStats[day] = { completed: 0, total: 0 };
      }
      dailyStats[day].total += 1;
      if (plan.progress >= plan.target) {
        dailyStats[day].completed += 1;
      }
    });
  });

  Object.entries(dailyStats).forEach(([day, stats]) => {
    dailyTrend.push({
      day,
      rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
    });
  });

  // Generate AI analysis content
  const childName = childId ? weeklyPlans[0]?.child?.name : '全部孩子';
  const reportTitle = generateReportTitle(type, childName, start, end);
  const content = generateReportContent({
    completionRate,
    totalTasks,
    totalTime,
    subjectStats,
    childName,
    start,
    end,
  });

  // Save report to database
  const report = await prisma.report.create({
    data: {
      familyId: user.familyId,
      childId: childId ? parseInt(childId) : null,
      type,
      title: reportTitle,
      content,
      startDate: start,
      endDate: end,
      isAutoGenerated: false,
    },
    include: {
      child: {
        select: { id: true, name: true, avatar: true },
      },
    },
  });

  res.json({
    status: 'success',
    data: {
      ...report,
      childName: report.child?.name,
      childAvatar: report.child?.avatar,
    },
  });
});

/**
 * PUT /reports/:id/favorite - Toggle favorite status
 */
reportsRouter.put('/:id/favorite', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { userId } = req.user!;
  const { id } = req.params;
  const { isFavorite } = req.body;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { familyId: true },
  });

  if (!user) {
    throw new AppError(404, '用户不存在');
  }

  const report = await prisma.report.findFirst({
    where: {
      id: parseInt(id),
      familyId: user.familyId,
    },
  });

  if (!report) {
    throw new AppError(404, '报告不存在');
  }

  await prisma.report.update({
    where: { id: parseInt(id) },
    data: { isFavorite },
  });

  res.json({
    status: 'success',
    message: isFavorite ? '已收藏' : '已取消收藏',
  });
});

/**
 * DELETE /reports/:id - Delete a report
 */
reportsRouter.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { userId } = req.user!;
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { familyId: true },
  });

  if (!user) {
    throw new AppError(404, '用户不存在');
  }

  const report = await prisma.report.findFirst({
    where: {
      id: parseInt(id),
      familyId: user.familyId,
    },
  });

  if (!report) {
    throw new AppError(404, '报告不存在');
  }

  await prisma.report.delete({
    where: { id: parseInt(id) },
  });

  res.json({
    status: 'success',
    message: '报告已删除',
  });
});

// ============================================
// Helper Functions
// ============================================

function generateReportTitle(
  type: string,
  childName: string,
  start: Date,
  end: Date
): string {
  const typeNames: Record<string, string> = {
    weekly: '周报',
    monthly: '月报',
    semester: '学期报',
    subject: '学科分析',
    time: '时间分析',
    behavior: '行为分析',
    custom: '自定义分析',
  };

  const startStr = start.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });

  return `${childName}的${typeNames[type] || '分析报告'} (${startStr}-${endStr})`;
}

function generateReportContent({
  completionRate,
  totalTasks,
  totalTime,
  subjectStats,
  childName,
  start,
  end,
}: {
  completionRate: number;
  totalTasks: number;
  totalTime: number;
  subjectStats: Record<string, number>;
  childName: string;
  start: Date;
  end: Date;
}): any {
  const totalHours = Math.round(totalTime / 60);
  const subjects = Object.entries(subjectStats)
    .sort((a, b) => b[1] - a[1])
    .map(([name, time]) => ({ name, time }));

  // Generate summary
  let summary = '';
  if (completionRate >= 80) {
    summary = `${childName}在${start.toLocaleDateString('zh-CN')}至${end.toLocaleDateString('zh-CN')}期间表现优秀，整体完成率达到${completionRate}%，共完成${totalTasks}个任务，累计学习${totalHours}小时。`;
  } else if (completionRate >= 60) {
    summary = `${childName}在${start.toLocaleDateString('zh-CN')}至${end.toLocaleDateString('zh-CN')}期间表现良好，整体完成率为${completionRate}%，共完成${totalTasks}个任务，累计学习${totalHours}小时，仍有提升空间。`;
  } else {
    summary = `${childName}在${start.toLocaleDateString('zh-CN')}至${end.toLocaleDateString('zh-CN')}期间完成率为${completionRate}%，共完成${totalTasks}个任务，累计学习${totalHours}小时，建议关注任务难度和时间安排。`;
  }

  // Generate highlights
  const highlights: string[] = [];
  if (completionRate >= 80) {
    highlights.push(`完成率达到${completionRate}%，超过预期目标`);
  }
  if (totalTasks >= 10) {
    highlights.push(`本周完成了${totalTasks}个任务，学习积极性高`);
  }
  if (totalHours >= 10) {
    highlights.push(`累计学习${totalHours}小时，保持了良好的学习习惯`);
  }
  if (subjects.length > 0) {
    highlights.push(`${subjects[0].name}投入时间最多，展现了浓厚的学习兴趣`);
  }

  // Generate suggestions
  const suggestions: string[] = [];
  if (completionRate < 60) {
    suggestions.push('完成率偏低，建议检查任务难度是否合适，适当调整任务量');
  }
  if (subjects.length > 0) {
    const topSubject = subjects[0];
    const topTime = Math.round(topSubject.time / 60);
    if (topTime > totalHours * 0.5) {
      suggestions.push(`${topSubject.name}占用时间较多（${topTime}小时），建议平衡各学科时间分配`);
    }
  }
  if (completionRate < 80) {
    suggestions.push('建议制定更合理的学习计划，提高任务完成率');
  }

  // Generate predictions
  let predictions = '';
  if (completionRate >= 80) {
    predictions = `基于当前的学习状态，预计下周完成率将保持在${Math.min(completionRate + 5, 100)}%左右。建议继续保持良好的学习习惯，适当增加挑战性任务。`;
  } else if (completionRate >= 60) {
    predictions = `通过优化学习计划和时间管理，预计下周完成率可提升至${Math.min(completionRate + 10, 85)}%。建议关注薄弱环节，加强练习。`;
  } else {
    predictions = `需要重点关注学习状态，建议家长加强陪伴和指导。预计通过调整，下周完成率可提升至${Math.min(completionRate + 15, 70)}%。`;
  }

  return {
    summary,
    highlights,
    suggestions,
    predictions,
    dataAnalysis: {
      completionRate,
      totalTasks,
      totalTime,
      subjectDistribution: subjectStats,
      dailyTrend: [],
    },
  };
}
