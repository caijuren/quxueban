# 趣学伴 1.9.2 三层准备度内核定型版发布记录

发布日期：2026-05-05

## 版本定位

`1.9.2` 聚焦三层准备度内核定型，并让目标管理成为三层模型的第一应用场景。

本版本不输出目标校适配分、录取概率和排名；只展示目标方向、准备信号、证据缺口、支撑任务和下一步动作。

## 本次变更

### 三层准备度内核

- 固定默认模板为“三公基础模板”。
- 固定交付层、认知层、稳定性层的能力点。
- 每个能力点补充观察指标、推荐任务和数据来源。
- 三层准备度页展示当前模板、预留方向、三层概览和能力点表。
- 能力点表新增关联目标数和关联任务数。
- 支持从能力点进入目标创建或任务创建。

### 目标管理承接

- 目标管理页升级为“目标准备工作台”。
- 新增目标方向区，展示三公基础模板和主要缺口。
- 新增三层覆盖区，展示每层目标数量和已绑定任务数量。
- 目标卡片重排为：目标名称、目标方向、三层能力点、当前进度、成功标准、支撑任务数量、当前缺口和下一步动作。
- 目标配置器支持目标方向、目标周期、所属层级、能力点、成功标准、支撑任务和复盘节奏。
- 新增“保存并关联任务”路径，保存目标后直接进入选择已有任务。
- 从三层准备度页带能力点进入目标或任务创建时，弹窗只触发一次，取消后不会重复弹出。

### 规则模块和测试

- 新增 `frontend/src/lib/readiness-goals.ts`，集中管理三层目标规则。
- 新增 `frontend/src/test/readiness-goals.test.ts`，覆盖目标方向推断、旧目标兼容、缺口动作和关联统计。

### 生产限流护栏

- `/api/health` 和 `/api/version` 提前挂载，不进入业务限流。
- 普通业务 API 生产限流水位提升到至少 `2000`。
- `/api/login` 和 `/api/register` 保留独立严格限流。
- 普通业务限流跳过登录和注册接口。
- 设置 `trust proxy = loopback`，避免 nginx 反代后所有请求被归到同一个本地 IP。
- 新增 `backend/src/__tests__/rate-limit.test.ts` 固化限流挂载行为。

## 本地检查

已执行：

```bash
pnpm --filter frontend test -- readiness-goals.test.ts --run
pnpm --filter frontend lint
pnpm --filter frontend build
pnpm --filter quxueban-backend test -- rate-limit.test.ts
pnpm --filter quxueban-backend lint
pnpm --filter quxueban-backend build
pnpm run check:versions
FRONTEND_URL=http://127.0.0.1:5176 python3 test_1_9_2_screenshots.py
```

结果：通过。

截图走查结果：21 项通过、0 失败、0 警告，覆盖三层准备度、目标管理、目标配置器和任务创建器。

详细记录见 `docs/checks/regression-1.9.2.md`。

## 发版边界

本版本不做：

- 不做目标校适配分、录取概率、排名。
- 不做 AI 目标建议。
- 不做规则版报告。
- 不做后端 schema 迁移。
- 不做移动端专项。

## 发布后复查

已完成，2026-05-05：

- 生产已部署到提交 `bd5fe75`。
- `/api/health` 正常返回，且不带 `RateLimit-*` 响应头。
- `/api/version` 正常返回 `1.9.0`，且不带 `RateLimit-*` 响应头。
- `/api/login` 正常登录，使用独立登录限流，`RateLimit-Limit: 20`。
- `/api/children` 正常返回孩子列表，使用普通业务限流，`RateLimit-Limit: 2000`。
- 连续运行 5 次 `scripts/check-production.sh` 未出现 `429` 或 `Too Many Requests`。

## 后续计划

1. `1.9.3` 进入数据治理闭环，把数据体检从发现问题升级为定位、修复、复查闭环。
2. `1.9.4` 增强规则诊断，补置信度、Velocity、余力指数和跨学科交叉验证。
3. `1.9.6` 前完成规则版报告和学习事件日志，再进入 `2.0 AI 驱动版`。
