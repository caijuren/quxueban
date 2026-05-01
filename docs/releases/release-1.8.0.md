# 趣学伴 1.8.0 发布记录

发布日期：2026-05-01

## 版本定位

`1.8.0` 是阶段化能力模型基础版。目标是让系统开始区分“小学阶段”和“初中阶段”，并让孩子画像、任务表单、今日概览和钉钉推送具备阶段化基础。

## 本次变更

- 孩子模型新增 `educationStage` 字段：
  - `primary`：小学阶段。
  - `middle`：初中阶段。
  - 老数据默认 `primary`。
- 孩子管理支持创建、编辑、详情查看教育阶段。
- 新增阶段化能力配置：
  - 小学偏学习习惯、专注、阅读表达、基础学科和生活自理。
  - 初中偏学科能力、错题复盘、思维逻辑、时间管理和考试策略。
- 任务表单按当前孩子阶段切换能力点。
- 任务标签新增目标类型 `targetType`。
- 初中任务表单支持语文、数学、英语、物理、化学、生物、历史、地理、道法。
- 小学任务表单支持时间块：晨读、放学后、晚饭后、睡前、周末上午、周末下午。
- 今日概览建议按小学/初中展示不同关注点。
- 钉钉今日学习推送按小学/初中生成不同建议。
- 新增 `docs/todos/todo-1.8-stage-model.md` 记录 1.8 阶段化 ToDo 和完成状态。

## 数据库迁移

本次包含数据库迁移：

```sql
ALTER TABLE "users" ADD COLUMN "education_stage" VARCHAR(20) NOT NULL DEFAULT 'primary';
```

发布时需要执行：

```bash
cd /home/ubuntu
./scripts/release-production.sh full
```

发布脚本会执行 `pnpm prisma migrate deploy`。

## 发布前本地检查

已执行：

```bash
pnpm --dir backend build
pnpm --dir frontend build
pnpm --dir backend lint
pnpm --dir frontend lint
git diff --check
```

说明：前端 lint 仍有 2 个既有 warning，未新增 error。

## 验收标准

- `/api/version` 返回 `1.8.0`。
- 老孩子进入系统后默认显示“小学阶段”。
- 新建孩子可以选择小学/初中。
- 编辑孩子后刷新页面，教育阶段仍保留。
- 小学孩子创建任务时，能力点为小学能力维度，并可选择时间块。
- 初中孩子创建任务时，能力点为初中能力维度，并可选择初中学科。
- 今日概览建议文案能按小学/初中切换重点。
- 钉钉今日学习推送包含学习阶段，并按阶段给出建议。

## 暂不包含

- 完整知识图谱。
- 目标学校差距量化。
- 初中错题系统完整闭环。
- 阶段化成长画像完整页面。
- AI 学习路径规划。
