# 趣学伴 1.9 UI 首轮回归记录

日期：2026-05-02

## 回归范围

本次回归覆盖 1.9 首轮前端改造：

- 三层准备度模型展示。
- 首页轻量诊断建议。
- 稳定性层记录入口。
- 数理认知试点字段。
- 目标、任务、任务详情和任务编辑器的三层归类展示。

## 已执行检查

```bash
pnpm --dir frontend build
```

结果：

- `frontend build` 通过。

## 本地服务检查

已启动前端开发服务：

```bash
pnpm --dir frontend dev --host 127.0.0.1
```

本地访问：

- `http://127.0.0.1:5173`

核心路由 HTTP 检查：

- `/parent`：200
- `/parent/ability-model`：200
- `/parent/tasks`：200
- `/parent/goals`：200

说明：当前检查确认 Vite 路由可访问，尚未完成浏览器内人工点击走查。

## 功能链路验收

使用本地账号 `andycoy` 在 `http://127.0.0.1:3001/api` 执行接口验收。

### 1. 完成任务保存和回显

- 创建临时任务 `1.9验收-认知层-*`。
- 调用 `/plans/checkin` 写入：
  - `status=completed`
  - `completedValue=12`
  - `focusMinutes=11`
  - `metadata.sleepHours=8.5`
  - `metadata.mood=stable`
  - `metadata.externalLoad=exam_week`
  - `metadata.attemptCount=2`
  - `metadata.usedHint=true`
  - `metadata.cognitiveError=rule_misuse`
  - `metadata.reviewQuality=rule`
- 再调用 `/dashboard/today-checkins?date=2026-05-02&childId=2`。

结果：通过。今日打卡接口能回显完成状态、实际时长、认知记录和稳定性记录。

### 2. 新建任务保存后三层层级是否正确

- 临时任务创建时写入 `tags.abilityCategory=认知层`、`tags.abilityPoint=规则内化`、`tags.targetType=ability`。
- 调用 `/tasks/:id?childId=2` 和 `/tasks?childId=2` 验证。

结果：通过。任务详情和任务列表都能读回三层归属和能力点。

### 3. 任务详情认知层建议是否出现

- 认知层任务详情页逻辑按 `getReadinessLayerByText` 判断。
- `TaskDetail` 对 `readinessLayer.id === 'cognition'` 展示认知层采集建议。

结果：通过静态逻辑检查。对应任务已能被识别为认知层。

### 4. 目标管理三层分组

- 调用 `/settings/goals` 临时写入一个 `abilityCategory=认知层`、`abilityPoint=规则内化` 的目标。
- 再调用 `/settings/goals?childId=2` 回读。
- 验证后清空临时目标。

结果：通过。目标保存和三层字段回显正常。

### 5. 能力模型三层切换内容是否一致

- 能力模型页已改为 `delivery / cognition / stability` 三层数据源。
- 旧保存数据如果仍是 `subject / thinking / habit / health`，前端读取时映射到三层：
  - `subject -> delivery`
  - `thinking -> cognition`
  - `habit / health -> stability`

结果：通过静态逻辑检查和构建检查。当前本地保存数据仍是旧 key，但兼容映射已覆盖。

## 本次已落地页面

### 今日概览

- 新增 `1.9 本周建议`。
- 新增 `稳定性层记录` 摘要。
- 新增 `数理认知试点` 摘要。
- 任务打卡弹窗新增稳定性字段：睡眠、情绪、外部负载。
- 任务打卡弹窗新增认知试点字段：尝试次数、是否提示、主要错因、复盘质量。

### 能力模型

- 页面标题改为三层准备度模型。
- 新增交付层、认知层、稳定性层总览卡。
- 保留原能力点编辑能力。

### 目标管理

- 目标卡片展示归属层级。
- 推荐目标模板按三层结构分组。

### 任务管理

- 任务卡片展示归属层级和能力点。
- 新增按层级筛选。
- 新增三层任务数量摘要。

### 任务详情

- 新增 1.9 回流说明。
- 对认知层任务展示认知采集建议。

### 任务编辑器

- 新增当前归属层级提示。
- 小学能力点已切换到 1.9 三层准备度口径。

## 剩余风险

- 当前稳定性层和数理认知字段先写入 `checkin.metadata`，没有独立 schema 和统计 API。
- 首页诊断仍是前端轻量规则，不是完整诊断引擎。
- 目标校权重、置信度、Velocity、余力指数、跨学科交叉验证还未实现。
- 尚未完成浏览器内逐页视觉走查；本轮按功能链路先收口。

## 上线口径

- 1.9 首轮可上线。
- 上线后不继续扩大 1.9.0 范围。
- UI 弹窗和按钮统一作为单独 UI 收口版本处理。
- 后端 schema、统计 API、复杂诊断和目标校适配进入 1.9.x。
