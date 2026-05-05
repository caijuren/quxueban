# 1.9.2 三层准备度内核定型走查记录

检查日期：2026-05-05

## 本轮范围

`1.9.2` 聚焦三层准备度内核和目标管理承接，不新增 AI，不做目标校适配分，不做录取概率，不做后端 schema 迁移。

本轮包含一个发版前稳定性修正：生产 API 限流护栏。

## 已检查能力

| 能力 | 检查重点 | 结果 |
|------|----------|------|
| 三层准备度内核 | 三公基础模板、三层能力点、观察指标、推荐任务、数据来源 | 通过编译和规则检查 |
| 三层准备度页 | 当前模板、目标方向、能力点表、数据来源、关联目标/任务数 | 通过编译和截图检查 |
| 目标管理 | 目标方向、三层覆盖、主要缺口、目标卡片字段顺序、下一步动作 | 通过编译、规则和截图检查 |
| 目标配置器 | 目标方向、周期、所属层级、能力点、成功标准、支撑任务、复盘节奏 | 通过编译和截图检查 |
| 目标与任务支撑 | 保存并关联任务、选择已有任务、生成建议任务兜底 | 通过编译检查 |
| 带参创建链路 | 从三层准备度页进入目标创建或任务创建，一次性弹窗处理 | 通过编译和截图检查 |
| 生产限流护栏 | 系统接口不进业务限流，登录使用独立限流，业务接口使用普通限流 | 通过后端单测 |

## 命令验证

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

结果：

- `pnpm --filter frontend test -- readiness-goals.test.ts --run`：通过，2 个测试文件，7 个用例通过。
- `pnpm --filter frontend lint`：通过。
- `pnpm --filter frontend build`：通过。
- `pnpm --filter quxueban-backend test -- rate-limit.test.ts`：通过，2 个用例通过。
- `pnpm --filter quxueban-backend lint`：通过。
- `pnpm --filter quxueban-backend build`：通过。
- `pnpm run check:versions`：通过，root、backend、frontend、API 均为 `1.9.0`。
- `FRONTEND_URL=http://127.0.0.1:5176 python3 test_1_9_2_screenshots.py`：通过，21 项通过、0 失败、0 警告。

说明：当前机器的 `3001` 和 `5173` 被其他本地项目占用，本轮截图走查临时使用当前项目后端 `3002` 和前端 `5176`。默认沙箱无法监听或访问本地服务，限流单测和截图脚本在沙箱外执行。

## 规则测试覆盖

新增 `frontend/src/test/readiness-goals.test.ts`，覆盖：

- 目标方向推断。
- 旧目标字段兼容和补齐。
- 目标缺口、准备状态和下一步动作。
- 能力点关联目标数和任务数统计。

新增 `backend/src/__tests__/rate-limit.test.ts`，覆盖：

- `/api/health` 和 `/api/version` 不带限流头。
- `/api/login` 使用独立登录限流，上限为 `20`。
- `/api/children` 使用普通业务限流，上限为 `2000`。

## 桌面截图走查

已完成。

截图和报告：

- `test_screenshots/09_ability_1_9_2.png`
- `test_screenshots/08_goals_1_9_2.png`
- `test_screenshots/18_goal_configurator_1_9_2.png`
- `test_screenshots/19_task_configurator_1_9_2.png`
- `test_1_9_2_report.json`

覆盖：

- 三层准备度页：页面标题、三公基础模板、观察指标、数据来源、关联目标和关联任务。
- 目标管理页：目标准备工作台、当前目标方向、三层覆盖、下一步动作。
- 目标配置器：目标方向、所属层级、能力点、完成标准、保存并关联任务。
- 任务创建器：新建任务、三层归属、从能力点带参预填。

## 生产复查

已完成，2026-05-05。

结果：

- 生产已部署到提交 `bd5fe75`。
- `/api/health` 返回 `200 OK`，无 `RateLimit-*` 响应头，不进入业务限流。
- `/api/version` 返回 `200 OK`，版本为 `1.9.0`，无 `RateLimit-*` 响应头，不进入业务限流。
- `/api/login` 返回 `200 OK`，登录成功，响应头 `RateLimit-Limit: 20`，使用独立登录限流。
- `/api/children` 返回 `200 OK`，正常返回孩子列表，响应头 `RateLimit-Limit: 2000`，使用普通业务限流。
- 连续执行 5 次 `scripts/check-production.sh` 未出现 `429` 或 `Too Many Requests`，PM2 `study-planner-api` 持续 `online`。

## 不纳入本版本

- 不输出目标校适配分、排名、录取概率。
- 不做 AI 建议。
- 不做报告生成。
- 不做后端 schema 迁移。
- 不做移动端专项。

## 下一步

1. 进入 `1.9.3 数据治理闭环版`。
