# 趣学伴 - 在线学习管理系统

## 1. 项目概述

### 1.1 项目简介
趣学伴是一个面向家庭的在线学习管理平台，帮助家长管理孩子的学习任务、跟踪阅读进度、记录学习数据，并通过AI分析提供个性化的学习建议。

### 1.2 目标用户
- **家长用户**：管理孩子的学习任务，查看学习报告，与AI互动
- **孩子用户**：查看每日任务，记录学习完成情况，追踪学习成就

### 1.3 核心价值
- 科学的学习计划管理
- 精准的学习时间统计
- 智能的AI分析建议
- 便捷的钉钉通知

---

## 2. 系统架构

### 2.1 技术栈

#### 前端技术
- **框架**：React 19 + TypeScript
- **路由**：React Router v7
- **UI组件**：Radix UI + 自定义组件
- **状态管理**：TanStack Query (React Query)
- **样式**：Tailwind CSS v4
- **动画**：Framer Motion
- **图表**：Recharts
- **构建工具**：Vite

#### 后端技术
- **框架**：Express.js
- **数据库**：PostgreSQL + Prisma ORM
- **认证**：JWT (JSON Web Token)
- **AI服务**：Kimi (月之暗面)、百度文心一言
- **文件存储**：Supabase

#### 部署架构
- 前端：Vercel / 本地开发服务器
- 后端：Node.js 服务
- 数据库：PostgreSQL

### 2.2 项目结构

```
quxueban/
├── frontend/                 # 前端应用
│   ├── src/
│   │   ├── components/      # 公共组件
│   │   │   ├── ui/         # UI基础组件
│   │   │   ├── parent/     # 家长端组件
│   │   │   └── child/      # 孩子端组件
│   │   ├── pages/          # 页面组件
│   │   │   ├── parent/     # 家长端页面
│   │   │   └── child/      # 孩子端页面
│   │   ├── hooks/          # React Hooks
│   │   ├── contexts/       # React Contexts
│   │   ├── lib/            # 工具库
│   │   └── types/          # TypeScript类型
│   └── package.json
│
├── backend/                 # 后端应用
│   ├── src/
│   │   ├── modules/        # 业务模块
│   │   │   ├── auth.ts     # 认证模块
│   │   │   ├── tasks.ts    # 任务模块
│   │   │   ├── plans.ts    # 计划模块
│   │   │   ├── library.ts  # 图书馆模块
│   │   │   ├── reading.ts  # 阅读模块
│   │   │   ├── dashboard.ts# 仪表盘模块
│   │   │   ├── dingtalk.ts # 钉钉集成
│   │   │   ├── ai.ts       # AI分析
│   │   │   └── ...
│   │   ├── middleware/     # 中间件
│   │   ├── config/        # 配置文件
│   │   └── services/      # 服务层
│   ├── prisma/
│   │   ├── schema.prisma  # 数据库模型
│   │   └── seed.ts        # 数据种子
│   └── package.json
│
├── child-frontend/          # 孩子端独立应用（备选）
└── packages/                # 共享包
```

---

## 3. 用户角色与认证

### 3.1 用户角色

#### 家长用户 (Parent)
- 创建和管理账户
- 添加和管理孩子账户
- 创建和分配学习任务
- 发布周计划
- 查看学习报告和统计数据
- 配置AI设置
- 管理图书馆藏书
- 钉钉通知设置

#### 孩子用户 (Child)
- 查看每日学习任务
- 完成学习任务打卡
- 记录阅读进度
- 查看学习成就
- 查看学习报告

### 3.2 认证流程

#### 家长登录
- 路径：`/login`
- 方式：用户名 + 密码
- Token存储：`localStorage.parent_token`
- 有效期：7天

#### 孩子登录
- 路径：`/child-login`
- 方式：家长分配的PIN码
- Token存储：`localStorage.child_token`
- 有效期：7天

#### 数据隔离策略
- 家长可以管理所有孩子的数据
- 孩子的数据严格隔离，只能访问自己的数据
- 通过`familyId`关联家庭成员
- 通过`childId`隔离孩子数据

---

## 4. 功能模块详解

### 4.1 仪表盘 (Dashboard)

#### 家长端仪表盘

**统计卡片**
1. **当日任务**
   - 原定任务数（来自周计划）
   - 今日实际任务（原定任务 - 今日不涉及）
   - 已完成 / 未完成 / 部分完成
   - 完成率 = 已完成 / 今日实际任务 × 100%

2. **今日学习时长**
   - 今日已完成 + 部分完成任务的实际用时总和
   - 单位：分钟

3. **当日完成率**
   - 当日已完成任务 / 当日实际任务 × 100%

4. **当日阅读情况**
   - 阅读书籍数量
   - 阅读时长
   - 阅读进度

**任务分类展示**
- 待完成：未开始的任务
- 已完成：已完成的任务（含实际用时和备注）
- 部分完成：部分完成的任务
- 未完成：未完成的任务
- 推迟：推迟的任务
- 今日不涉及：不涉及当日的任务

**快捷操作**
- 任务完成弹窗（类似孩子端设计）
- 分享到钉钉
- AI分析
- 日期选择器（查看历史数据）
- 导出功能

#### 孩子端仪表盘

**核心数据展示**
- 当日任务列表
- 学习时长统计
- 成就展示
- AI学习伴侣

**交互功能**
- 快速打卡
- 任务详情查看
- 成就解锁

### 4.2 任务管理 (Tasks)

#### 任务模板 (Task Templates)
- 创建任务模板
- 设置任务属性：
  - 名称
  - 学科分类
  - 单次时长
  - 难度级别
  - 默认周频次
  - 分配规则（每日/在校日/智能分配/周末）
- 分配任务给孩子

#### 任务详情 (Task Detail)
- 查看任务基本信息
- 查看完成历史
- 修改任务参数
- 删除任务（需提供childId）

#### 任务分类规则
```
- 每日任务 (daily): 每天1次，周一至周日（7天）
- 在校日任务 (school): 每周4次，周一/二/四/五
- 智能分配 (flexible): 智能分配3次，周一至周五均匀分散
- 周末任务 (weekend): 每周2次，周六和周日
```

### 4.3 周计划管理 (Plans)

#### 发布计划流程
1. **选择时间**：本周/下周/自定义周
2. **选择任务**：从任务库选择要发布的任务
3. **设置规则**：
   - 避开法定节假日开关
   - 单个任务规则设置
   - 发布对象选择（孩子）
4. **预览发布**：
   - 按天展示任务分配
   - 显示节假日标记
   - 高负荷提醒

#### 节假日处理
- 支持API获取法定节假日
- 本地备用节假日数据
- 自动跳过节假日安排

### 4.4 图书馆 (Library)

#### 书籍管理
- 添加书籍（ISBN扫码/手动）
- 书籍信息管理：
  - 书名、作者、出版社
  - 总页数、字数
  - 适读年龄
  - 分类标签
  - 封面图片
- 书籍分类：
  - 儿童文学、科普知识、历史故事、绘本等

#### 阅读状态
- 想读
- 在读
- 已读完

#### 阅读记录
- 阅读日期
- 起始页/结束页
- 阅读时长
- 阅读效果评价
- 专注度评分
- 标签
- 备注

### 4.5 学习统计 (Statistics)

#### 数据维度
- **时间维度**：日/周/月/学期/年度
- **任务维度**：完成率、用时、类别分布
- **阅读维度**：阅读量、阅读时长、阅读类型分布

#### 图表类型
- 柱状图：任务完成对比
- 折线图：学习趋势
- 饼图：时间分布
- 雷达图：能力分析

### 4.6 成就系统 (Achievements)

#### 成就类型
- 学习连续天数成就
- 任务完成成就
- 阅读量成就
- 特定任务达成成就

#### 解锁机制
- 自动检测达成条件
- 实时解锁通知
- 成就墙展示

### 4.7 AI分析 (AI Insights)

#### AI服务提供商
- Kimi (月之暗面)
- 百度文心一言

#### 分析内容
- 今日学习情况分析
- 任务完成情况评估
- 学习效率建议
- 个性化改进建议

#### 交互形式
- AI学习伴侣对话
- 任务完成分析报告
- 阅读理解分析

### 4.8 钉钉集成 (DingTalk)

#### 功能特性
- 定时推送学习报告
- 手动分享当日情况
- 自定义推送内容
- 钉钉机器人webhook

#### 推送内容
- 学习概览：
  - 原定任务数
  - 今日实际任务数
  - 已完成/未完成数
  - 完成率
  - 学习时长
- 任务详情：
  - 已完成任务列表（含用时和备注）
  - 未完成任务列表
  - 今日不涉及任务
- AI分析：
  - 学习亮点
  - 改进建议

### 4.9 设置中心 (Settings)

#### 家长设置
- **账户信息**：头像、名称、密码修改
- **家庭设置**：家庭名称、家庭码
- **孩子管理**：添加/编辑/删除孩子
- **学习设置**：每日时长限制、休息提醒
- **通知偏好**：邮件/推送通知开关
- **AI设置**：AI服务配置
- **数据管理**：导入/导出/清除数据
- **危险区域**：账户删除

---

## 5. 数据库模型

### 5.1 核心实体

#### Family (家庭)
```typescript
{
  id: number;           // 主键
  name: string;         // 家庭名称
  familyCode: string;   // 家庭码（唯一）
  settings: Json;       // 家庭设置
}
```

#### User (用户)
```typescript
{
  id: number;           // 主键
  name: string;         // 用户名
  role: 'parent' | 'child';  // 角色
  avatar: string;        // 头像
  familyId: number;     // 所属家庭ID
  status: 'active' | 'inactive';  // 状态
  dingtalkWebhook: string;  // 钉钉webhook
  dingtalkSecret: string;    // 钉钉密钥
}
```

#### Task (任务)
```typescript
{
  id: number;
  familyId: number;
  name: string;              // 任务名称
  category: string;          // 学科分类
  type: 'fixed' | 'flexible'; // 任务类型
  timePerUnit: number;       // 单次时长（分钟）
  scheduleRule: string;       // 分配规则
  appliesTo: number[];       // 分配给哪些孩子
  tags: Json;                // 标签（学科、难度等）
  isActive: boolean;         // 是否激活
  sortOrder: number;         // 排序
}
```

#### WeeklyPlan (周计划)
```typescript
{
  id: number;
  familyId: number;
  childId: number;          // 孩子ID
  taskId: number;           // 任务ID
  target: number;           // 目标次数
  progress: number;         // 已完成次数
  weekNo: string;           // 周编号 (yyyy-ww)
  status: string;           // 状态
  assignedDays: number[];    // 分配的日期 [0-6]
}
```

#### DailyCheckin (每日打卡)
```typescript
{
  id: number;
  familyId: number;
  childId: number;
  taskId: number;
  planId: number;           // 周计划ID
  status: 'pending' | 'completed' | 'partial' | 'skipped' | 'not_involved';
  value: number;            // 打卡值
  completedValue: number;    // 实际完成值
  checkDate: Date;          // 打卡日期
  notes: string;             // 备注
}
```

#### Book (书籍)
```typescript
{
  id: number;
  familyId: number;
  childId?: number;         // 所属孩子（可选）
  name: string;             // 书名
  author: string;           // 作者
  type: string;             // 类型
  coverUrl: string;         // 封面URL
  totalPages: number;       // 总页数
  wordCount?: number;       // 字数
  isbn: string;             // ISBN
  publisher: string;         // 出版社
  characterTag: string;     // 角色标签
  status: string;           // 状态
}
```

#### ReadingLog (阅读记录)
```typescript
{
  id: number;
  familyId: number;
  childId?: number;
  bookId: number;
  pages: number;            // 阅读页数
  minutes: number;          // 阅读时长
  readDate: Date;           // 阅读日期
  startPage: number;        // 起始页
  endPage: number;          // 结束页
  effect: string;           // 效果评价
  performance: string;      // 表现
  focusRating: number;      // 专注度评分
  note: string;             // 备注
  tags: string[];           // 标签
  evidenceUrl: string;       // 证据URL
}
```

#### Achievement (成就)
```typescript
{
  id: number;
  familyId: number;
  icon: string;             // 成就图标
  name: string;             // 成就名称
  description: string;       // 描述
  condition: Json;          // 解锁条件
  isActive: boolean;        // 是否激活
  sortOrder: number;        // 排序
}
```

### 5.2 关系图

```
Family (家庭)
  ├── User (家长) [1:N]
  │     └── 家长管理孩子
  ├── User (孩子) [1:N]
  │     ├── ChildTask (孩子任务) [1:N]
  │     ├── DailyCheckin (打卡记录) [1:N]
  │     ├── ReadingLog (阅读记录) [1:N]
  │     └── AchievementLog (成就记录) [1:N]
  ├── Task (任务模板) [1:N]
  ├── WeeklyPlan (周计划) [1:N]
  ├── Book (书籍) [1:N]
  └── Achievement (成就) [1:N]
```

---

## 6. API接口设计

### 6.1 认证模块 `/auth`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/auth/login` | 家长登录 | 公开 |
| POST | `/auth/child-login` | 孩子登录 | 公开 |
| GET | `/auth/me` | 获取当前用户信息 | 需认证 |
| GET | `/auth/children` | 获取家庭孩子列表 | 家长 |
| POST | `/auth/register` | 注册账户 | 公开 |
| PUT | `/auth/password` | 修改密码 | 需认证 |

### 6.2 任务模块 `/tasks`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/tasks` | 获取任务列表 | 需认证 |
| POST | `/tasks` | 创建任务 | 家长 |
| PUT | `/tasks/:id` | 更新任务 | 家长 |
| DELETE | `/tasks/:id` | 删除任务（软删除） | 家长 |
| POST | `/tasks/publish` | 发布周计划 | 家长 |

### 6.3 计划模块 `/plans`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/plans/weekly` | 获取周计划 | 需认证 |
| GET | `/plans/today` | 获取今日计划 | 孩子 |

### 6.4 图书馆模块 `/library`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/library/books` | 获取书籍列表 | 需认证 |
| POST | `/library/books` | 添加书籍 | 家长 |
| GET | `/library/books/:id` | 书籍详情 | 需认证 |
| POST | `/library/books/:id/read` | 记录阅读 | 孩子 |
| GET | `/library/stats` | 阅读统计 | 需认证 |

### 6.5 仪表盘模块 `/dashboard`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/dashboard/overview` | 获取仪表盘概览 | 需认证 |
| GET | `/dashboard/stats` | 获取统计数据 | 需认证 |

### 6.6 钉钉模块 `/dingtalk`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/dingtalk/share` | 分享到钉钉 | 需认证 |
| POST | `/dingtalk/tasks/:id/push` | 推送任务到钉钉 | 家长 |

### 6.7 AI模块 `/ai`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/ai/analyze-task` | 分析任务完成情况 | 需认证 |
| POST | `/ai/insights/book` | 书籍AI分析 | 需认证 |

---

## 7. 核心业务流程

### 7.1 发布周计划流程

```
1. 家长选择发布周期（本周/下周/自定义）
     ↓
2. 从任务库选择要发布的任务
     ↓
3. 设置每个任务的分配规则
     ↓
4. 选择发布对象（孩子）
     ↓
5. 预览任务分配（含节假日跳过）
     ↓
6. 确认发布
     ↓
7. 系统为每个孩子创建周计划记录
     ↓
8. 孩子可在"今日待办"中查看任务
```

### 7.2 任务完成打卡流程

```
1. 孩子查看今日待办任务
     ↓
2. 点击任务进入完成弹窗
     ↓
3. 选择完成状态
   - 全部完成
   - 部分完成（填写实际值）
   - 未完成
   - 推迟
   - 今日不涉及
     ↓
4. 填写实际用时（分钟）
     ↓
5. 填写备注说明
     ↓
6. 提交打卡
     ↓
7. 系统更新打卡记录
     ↓
8. 仪表盘数据实时更新
```

### 7.3 钉钉分享流程

```
1. 家长选择日期（默认当天）
     ↓
2. 点击"分享到钉钉"按钮
     ↓
3. 系统获取该日期的：
   - 任务完成情况
   - 学习时长统计
   - AI分析结果
     ↓
4. 生成钉钉消息格式
     ↓
5. 调用钉钉webhook发送
     ↓
6. 显示发送结果
```

---

## 8. 关键计算规则

### 8.1 今日概览计算

```
原定任务数 = 周计划中该周的任务总数
今日不涉及 = 标记为"今日不涉及"的任务数
今日实际任务 = 原定任务数 - 今日不涉及

已完成 = 完成状态为"已完成"的任务数
未完成 = 今日实际任务 - 已完成
完成率 = (已完成 / 今日实际任务) × 100%
学习时长 = Σ(已完成任务的实际用时) + Σ(部分完成任务的实际用时)
```

### 8.2 周完成率计算

```
周完成率 = Σ(每日完成数) / Σ(每日实际任务数) × 100%
```

### 8.3 学习时长统计

```
孩子端统计 = 从checkins表汇总completedValue
家长端概览 = 今日所有孩子的学习时长总和
```

---

## 9. 数据隔离策略

### 9.1 家庭级隔离
- 每个家庭有唯一的`familyId`
- 所有数据查询都带上`familyId`条件

### 9.2 孩子级隔离
- 孩子的`userId`作为`childId`
- 打卡、阅读记录等都与`childId`关联
- 孩子的任务通过`appliesTo`数组分配

### 9.3 API级隔离
- 后端中间件自动注入`familyId`
- 前端请求拦截器自动注入`childId`
- 敏感操作需要提供`childId`参数

---

## 10. 第三方集成

### 10.1 钉钉集成
- 机器人Webhook推送
- 消息格式：Markdown
- 支持自定义关键字验证

### 10.2 AI服务
- Kimi API（主要）
- 百度文心一言（备用）
- 支持流式响应

### 10.3 Supabase存储
- 书籍封面图片存储
- 阅读证据文件存储

---

## 11. 未来优化方向

### 11.1 功能优化
- [ ] 任务批量编辑
- [ ] 周期性报告自动推送
- [ ] 更多AI分析维度
- [ ] 学习目标设定与提醒

### 11.2 性能优化
- [ ] 数据库索引优化
- [ ] 前端懒加载优化
- [ ] API缓存策略

### 11.3 安全优化
- [ ] 密码强度验证
- [ ] 登录失败锁定
- [ ] 操作日志审计

---

## 附录

### A. 任务分类常量
```typescript
const TASK_CATEGORIES = {
  chinese: '语文',
  math: '数学',
  english: '英语',
  sports: '体育',
  school: '校内',
  advanced: '提高',
  extra: '课外'
};

const SCHEDULE_RULES = {
  daily: '每日任务',
  school: '在校日任务',
  flexible: '智能分配',
  weekend: '周末任务'
};

const COMPLETION_STATUS = {
  pending: '待完成',
  completed: '已完成',
  partial: '部分完成',
  skipped: '推迟',
  not_involved: '今日不涉及'
};
```

### B. 节假日数据（2025年示例）
```typescript
const HOLIDAYS_2025 = {
  '2025-01-01': '元旦',
  '2025-01-28 ~ 2025-02-03': '春节',
  '2025-04-04 ~ 2025-04-06': '清明节',
  '2025-05-01 ~ 2025-05-05': '劳动节',
  '2025-06-01 ~ 2025-06-02': '端午节',
  '2025-10-01 ~ 2025-10-08': '国庆节'
};
```

### C. 路由清单
```
/                       # 首页（角色选择）
/login                  # 家长登录
/child-login           # 孩子登录
/register              # 注册

/child                 # 孩子端布局
/child/tasks           # 任务页面
/child/weekly-plan     # 周计划
/child/library         # 图书馆
/child/achievements    # 成就
/child/reports         # 报告

/parent                # 家长端布局
/parent/tasks          # 任务管理
/parent/task-templates # 任务模板
/parent/plans         # 计划管理
/parent/library        # 图书馆
/parent/reading       # 阅读记录
/parent/achievements   # 成就管理
/parent/statistics    # 统计
/parent/settings/*     # 设置
```
