# 趣学伴 1.9.1 发布记录

发布日期：2026-05-03

## 版本定位

`1.9.1` 是技术债务清理版。目标是在进入 1.9.1 UI 架构升级之前，先解决安全隐患、代码质量和依赖管理问题。

## 本次变更

### 安全修复

- **SQL 注入修复**：`task-templates.ts` 所有 `$queryRawUnsafe` 改为参数化查询 `$queryRaw`。
- **JWT Secret 硬编码修复**：移除默认值 `dev-secret-key`，要求至少 32 字符。
- **添加 Helmet 安全头**：配置 CSP 策略，生产环境启用。
- **添加 Rate Limiting**：全局限流 + 认证接口严格限流（15分钟20次）。
- **敏感文件清理**：从 Git 跟踪移除 `update-password.sql`、`check-users.js`、`deploy_commands.sh`。

### TypeScript 严格模式

- **开启后端 strict 模式**：修复 7 个类型错误，开启 `strict: true`。
- **修复的错误**：
  - `csrf.ts`：`req.ip` 可能为 undefined
  - `library.ts`：`parsedChildId` 可能为 null（3处）
  - `ai-insights.ts`：`parsedChildId` 可能为 null
  - `settings.ts`：`note` 参数隐式 any 类型

### 依赖清理

- **移除未使用依赖**：
  - `bcrypt`（与 bcryptjs 重复）
  - `ai`、`@ai-sdk/deepseek`（未使用）
  - `chromadb`（未使用）
  - `langchain`（未使用）
- **统一 Prisma 版本**：根目录从 6.1.0 升级到 6.19.3
- **Zod 版本说明**：前端 4.x（使用 `zod/v4` 导入）与后端 3.x 保持独立，无共享类型

### 模块归档

- **僵尸模块移至 `src/archive/modules/`**：
  - `achievements.ts`（未被 app.ts 引用）
  - `child.ts`（被 children.ts 替代）
  - `cloud-storage.ts`（依赖未安装的 googleapis）
  - `config.ts`（依赖未安装的 uuid、crypto-js）
  - `internal.ts`（被注释掉）
  - `scheduler.ts`（依赖未安装的 node-cron）
- **临时脚本移至 `src/archive/scripts/`**：
  - `import-books.ts`
  - `check-all-data.ts`、`check-backup-structure.ts`
  - `restore-books.ts`、`restore-books-only.ts`、`restore-data.ts`、`restore-plans.ts`

### 公共工具函数提取

- **`src/utils/date-utils.ts`**：
  - `getWeekNo()`：ISO 8601 周编号
  - `getWeekNosInRange()`：日期范围内的周编号
  - `getWeekNosForDays()`：最近 N 天的周编号
  - `formatLocalDate()`：本地日期格式化
- **`src/utils/task-utils.ts`**：
  - `parseTaskTags()`：解析任务标签
  - `getAssignedDays()`：获取分配的日期
  - `getEffectiveScheduleRule()`：获取有效的调度规则
  - `getAllowedDays()`：获取允许的日期
  - `countAssignedDaysInRange()`：计算日期范围内的分配天数
- **`src/utils/book-utils.ts`**（已有，更新导出）：
  - `cleanIsbn()`、`normalizeBookName()`、`normalizeText()`
  - `normalizeYear()`、`firstText()`、`firstNumber()`、`pickRowValue()`

### 模块更新

- **dashboard.ts**：使用共享工具函数，删除重复定义
- **tasks.ts**：使用 `parseTaskTags`，保留业务特有的 `getEffectiveScheduleRule`
- **plans.ts**：使用 `getWeekNo`
- **dingtalk.ts**：使用 `getWeekNo`
- **statistics.ts**：使用 `getWeekNo`、`getWeekNosForDays`
- **reading.ts**：使用 `formatLocalDate`
- **library.ts**：使用共享工具函数，删除 7 个重复函数定义

### console.log 清理

- **清理数量**：106 处
- **清理方式**：
  - 调试日志（console.log）：直接删除
  - 错误日志（console.error）：替换为 `logger.error({ err }, 'message')`
  - 警告日志（console.warn）：替换为 `logger.warn('message')`
- **涉及模块**：
  - dingtalk.ts（35处）
  - library.ts（23处）
  - settings.ts（12处）
  - ai-insights.ts（14处）
  - plans.ts（8处）
  - tasks.ts（7处）
  - auth.ts（4处）
  - ai.ts（3处）
  - upload.ts（2处）

### 功能修复

- **孩子统计硬编码修复**：
  - `auth.ts` 孩子列表接口原来返回硬编码的 0
  - 现在从数据库查询真实数据：
    - `weeklyProgress`：本周完成的任务数
    - `todayMinutes`：今天的学习时长（打卡 + 阅读）
    - `completedTasks`：已完成的任务数
    - `totalTasks`：总分配任务数
    - `achievements`：成就数
  - `streak`（连续打卡天数）暂未实现，仍为 0

### 测试文件

- **`backend/src/__tests__/auth.test.ts`**：认证测试（注册、登录、用户信息）
- **`backend/src/__tests__/tasks.test.ts`**：任务测试（CRUD 操作）

## 依赖变更

### 新增

- `helmet`：安全头中间件
- `express-rate-limit`：限流中间件

### 移除

- `bcrypt`：与 bcryptjs 重复
- `ai`：未使用
- `@ai-sdk/deepseek`：未使用
- `chromadb`：未使用
- `langchain`：未使用

### 版本更新

- `prisma`：6.1.0 → 6.19.3
- `@prisma/client`：6.1.0 → 6.19.2

## 数据存储

本次不新增数据库 schema。

- 孩子统计从现有表查询：`daily_checkins`、`reading_logs`、`child_tasks`、`achievement_logs`
- 稳定性层和数理认知试点继续写入 `checkin.metadata`

## 本地检查

已执行：

```bash
pnpm --dir backend build
pnpm --dir frontend build
```

结果：通过。

## 后续计划

1. 启动 `1.9.1 UI 架构升级版`，重点覆盖今日概览、任务完成弹窗、任务列表、任务编辑器、任务详情、目标管理、能力模型、成长仪表盘、数据体检和图书详情。
2. 进入 `1.9.2 数据治理闭环版`，把数据体检从发现问题升级为定位、修复、复查闭环。
3. 进入 `1.9.3 规则诊断增强版`，完善置信度、Velocity、余力指数和跨学科交叉验证。
