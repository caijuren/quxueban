# 数据库现实状态报告

更新时间：2026-04-22  
作用：记录**线上真实 PostgreSQL 结构**与当前 `backend/prisma/schema.prisma` 的差异，作为后续数据库治理和功能恢复的基线。

## 总结

当前线上数据库**不是**按现有 Prisma schema 完整演进出来的。  
系统现在能稳定运行，是因为核心链路代码已经改成了**兼容旧库**的方式，而不是因为 Prisma schema 与真实数据库已经对齐。

这意味着：

- 当前不要执行 `prisma migrate deploy`
- 新功能开发不能默认相信 Prisma 字段都在线上存在
- 恢复模块时必须先核对真实表结构

---

## 一、核心结论

### 已基本一致的表

- `families`
- `users`

这些表目前和代码中的 schema 差异不大，适合作为继续使用 Prisma 的相对稳定区域。

### 已确认存在结构漂移的表

- `tasks`
- `weekly_plans`
- `daily_checkins`
- `books`

这些表就是当前数据库技术债的核心来源。

---

## 二、线上真实结构 vs 当前 Prisma Schema

### 1. `families`

#### 线上真实字段

- `id`
- `name`
- `family_code`
- `settings`
- `created_at`
- `updated_at`

#### 结论

与当前 Prisma schema 基本一致，低风险。

---

### 2. `users`

#### 线上真实字段

- `id`
- `name`
- `role`
- `avatar`
- `password_hash`
- `family_id`
- `status`
- `created_at`
- `updated_at`
- `dingtalk_secret`
- `dingtalk_webhook`
- `dingtalk_webhook_url`

#### 结论

与当前 Prisma schema 基本一致，低风险。  
登录、家庭、孩子管理当前能正常工作也印证了这一点。

---

### 3. `tasks`

#### 线上真实字段

- `id`
- `family_id`
- `name`
- `category`
- `type`
- `time_per_unit`
- `weekly_rule`
- `sort_order`
- `is_active`
- `created_at`
- `updated_at`
- `tags`
- `applies_to`
- `schedule_rule`
- `weekly_frequency`

#### Prisma schema 中存在但线上缺失

- `target_value`
- `tracking_type`
- `tracking_unit`

#### 已出现过的真实线上错误

- `The column target_value does not exist`
- `The column tracking_type does not exist`

#### 影响

直接使用 Prisma `Task` 模型做 create / update / findMany 会访问不存在的列，导致 500。

#### 当前策略

核心任务链路已经改成只读写线上真实存在的旧字段，避免访问以上缺列。

---

### 4. `weekly_plans`

#### 线上真实字段

- `id`
- `family_id`
- `child_id`
- `task_id`
- `target`
- `progress`
- `week_no`
- `status`
- `created_at`
- `updated_at`

#### Prisma schema 中存在但线上缺失

- `assigned_days`

#### 已出现过的真实线上错误

- `The column weekly_plans.assigned_days does not exist`

#### 影响

直接使用 Prisma `WeeklyPlan` 模型做 create / findMany 会访问不存在的列，导致：

- 发布计划失败
- 读取周计划失败
- 首页无法同步计划

#### 当前策略

计划发布与计划读取关键路径已改成兼容旧库的读写方式，不依赖 `assigned_days`。

---

### 5. `daily_checkins`

#### 线上真实字段

- `id`
- `family_id`
- `child_id`
- `task_id`
- `plan_id`
- `status`
- `value`
- `check_date`
- `created_at`

#### Prisma schema 中存在但线上缺失

- `completed_value`
- `notes`

#### 风险

当前虽然核心流程还能跑，但以下链路后续仍然可能出问题：

- 首页学习时长
- 任务完成 / 打卡
- 计划完成统计
- 钉钉分享

#### 判断

这是下一轮需要重点排雷的高风险表。

---

### 6. `books`

#### 线上真实字段

- `id`
- `family_id`
- `name`
- `author`
- `type`
- `cover_url`
- `status`
- `created_at`
- `updated_at`
- `character_tag`
- `read_count`
- `total_pages`

#### Prisma schema 中存在但线上缺失

- `isbn`
- `publisher`
- `description`
- `word_count`
- 以及更多图书扩展字段

#### 影响

图书馆相关功能是高风险区域。  
这也解释了为什么之前图书馆页面、图书详情增强、图书统计都不适合直接上线。

---

## 三、风险分级

### 低风险，可继续用 Prisma 的区域

- 登录
- 家庭管理
- 孩子管理
- 基础用户信息

### 中风险，需要谨慎恢复

- 首页学习时长统计
- 打卡 / 完成任务
- 周完成率
- 通知 / 钉钉联动

### 高风险，当前不建议直接恢复

- 图书馆
- 图书详情增强
- 图书导入
- 依赖 `books` 扩展字段的任何功能
- 依赖 `daily_checkins` 扩展字段的统计逻辑

---

## 四、当前推荐策略

### 短期策略

继续让代码**兼容旧库**，不要强推 schema。

原则：

- 不访问线上不存在的列
- 核心链路优先可用
- 不执行 `prisma migrate deploy`

### 中期策略

单独做“数据库对齐工程”。

该工程要包含：

1. 线上真实 schema 导出
2. Prisma schema 精简或分层
3. 手工设计 SQL 迁移
4. 小步验证，而不是一次性推 migration

---

## 五、后续建议

### 优先级 1

继续检查 `daily_checkins` 相关链路是否还会踩缺列：

- 首页学习时长
- 任务打卡
- 完成记录
- 分享到钉钉

### 优先级 2

恢复完整设置页时，优先使用：

- `users`
- `families`

避免优先恢复依赖高风险表的模块。

### 优先级 3

在恢复图书馆前，先做 `books` 表的真实结构对齐。

---

## 六、一句话判断

当前系统不是“schema 正常、业务正常”，而是：

**业务已经靠兼容旧库跑起来了，但数据库结构技术债仍然很重。**

后续任何模块恢复，都应该先看这份报告。
