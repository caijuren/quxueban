# 趣学伴当前进度盘点

更新时间：2026-05-05

## 当前状态

- 当前分支：`main`
- 当前阶段：`1.9.2 三层准备度内核定型版` 本地收口完成，待发布和生产复查
- 工作区状态：1.9.2 三层准备度内核、目标管理承接和生产限流护栏已完成本地验证，当前待整理提交、发布后复查
- 文档索引：`docs/README.md`
- 当前总 ToDo：`docs/todo-master.md`
- 当前版本路线图：`docs/version-roadmap.md`
- 协作与发布规范：`docs/workflow-conventions.md`
- 阶段化能力模型：`docs/features/feature-1.8-education-stage-model.md`
- 1.9.2 检查记录：`docs/checks/regression-1.9.2.md`
- 1.9.2 发布记录草稿：`docs/releases/release-1.9.2.md`
- 历史发布记录和旧路线图：`docs/releases/`、`docs/roadmaps/`

## 最近已经完成

- 1.9.1 技术债务清理版完成并提交，记录见 `docs/releases/release-1.9.1.md`。
- 1.9.1 UI 架构升级版完成桌面端收口，记录见 `docs/releases/release-1.9.1-ui.md` 和 `docs/checks/regression-1.9.1-ui.md`。
- 1.9 首轮功能验收完成，记录见 `docs/checks/regression-1.9-ui.md`。
- 1.9 生产迁移后检查完成，记录见 `docs/checks/regression-1.9-postdeploy.md`。
- 1.9.0 已发布到生产，线上 API 版本返回 `1.9.0`。
- 生产部署目录已迁移到多应用结构：代码仓库 `/srv/apps/quxueban`，前端静态目录 `/srv/www/quxueban`，PM2 后端运行目录 `/srv/apps/quxueban/backend`。
- nginx 已切换到 `/srv/www/quxueban`，旧 `/var/www/study-planner` 不再作为当前站点根目录。
- 部署脚本、PM2 配置和发布文档已改为新的生产目录默认值。
- 版本号更新到 `1.9.0`。
- 今日概览已收口为“今日状态总览”，交付层、认知层、稳定性层作为横向证据摘要展示。
- 任务完成弹窗新增字段已折叠为“状态记录”和“认知记录”。
- 任务管理卡片按“任务名 / 层级能力分类 / 规则时长孩子 / 操作区”重排。
- 任务编辑器按“基础信息 / 三层归属 / 目标连接 / 执行设置 / 额外字段”重排。
- 任务详情页改为任务档案结构，展示三层归属、1.9 回流说明和认知层采集建议。
- 能力模型页主体切换为三层能力树，并兼容旧 `subject / thinking / habit / health` 保存数据。
- 本地接口验收通过：任务三层字段保存回显、完成打卡 metadata 保存回显、目标三层字段保存回显。
- 1.9 设计方案已整理到 `docs/features/feature-1.9-readiness-goal-engine.md`，明确三层准备度模型、诊断引擎、1.9 范围和后续分步路线。
- 新增前端三层准备度配置 `frontend/src/lib/readiness-model.ts`，统一交付层、认知层、稳定性层的展示和归类逻辑。
- 能力模型页新增三层准备度总览，保留原能力点编辑能力。
- 首页新增“1.9 本周建议”，先基于完成率、延期、负荷做轻量诊断。
- 首页新增稳定性层记录摘要，任务打卡弹窗可记录睡眠、情绪和外部负载，数据写入 `checkin.metadata`。
- 首页新增数理认知试点摘要，任务打卡弹窗可记录尝试次数、是否使用提示、主要错因和复盘质量，数据写入 `checkin.metadata`。
- 目标页和任务页已接入三层归类，任务页支持按层级筛选。
- 任务编辑器新增当前归属层级提示，任务详情页新增 1.9 回流说明和认知层采集建议。
- 完成 1.8.0 阶段化能力模型基础版：孩子教育阶段、阶段能力配置、任务目标类型、初中学科、小学时间块、今日概览和钉钉轻量阶段化。
- 新增数据库迁移 `20260501020000_add_user_education_stage`。
- 版本号更新到 `1.8.0`。
- 已归档 1.7.4 发布记录和 1.7.5 下一轮改进清单。
- 图书馆阅读记录、封面展示、卡片排序、最近在读逻辑和详情页操作完成修复。
- 今日概览学习时长与钉钉推送学习时长统一为 `已完成 + 部分完成`。
- 任务发布避开 2026 法定节假日，前后端新增内置假期表。
- 新增《封神演义》状态修复脚本 `backend/scripts/set-book-reading-status.ts`。
- 使用 `logo2` 作为网站 logo、favicon 和侧边栏品牌图。
- 扩容 `reading_logs.performance` 字段，解决孩子表现长文本保存失败问题。
- 已归档 1.6.1 发布说明和 UI 统一规范。
- 统一能力模型、任务管理、学习计划、阅读中心、图书馆、学习报告、统计分析、成就管理、设置的标准页面顶栏。
- 新增 `PageToolbarTitle`、`FilterBar`、`EmptyPanel`，用于统一页面标题、筛选条和空状态。
- 任务详情和图书详情完成第一轮外层卡片、主要操作和弹窗样式收口。
- 阅读中心、成就管理确认弹窗完成统一样式收口。
- 修正 `pnpm-workspace.yaml`，纳入 `frontend` 和 `backend`，避免服务器 pnpm 安装跳过前后端依赖。
- 已归档 1.6 发布说明和 1.6 业务逻辑梳理。
- 新增家长端 `能力模型` 页面，先按 L1-L5 静态展示。
- 目标页增加能力模型承接口径，展示能力点、关联任务和复盘节奏。
- 任务页增加 `1.6 业务关联` 字段，为后续推荐、报告和能力回流做结构准备。
- 学习计划页在计划发布、移动、删除后同步刷新今日概览相关数据。
- 今日概览顶部移除重复的 `安排计划` 入口。
- 已归档 1.5 封板说明、遗留问题、封板检查、旧 1.8 筹备方案和旧 2.0 AI 草案。
- 家长端主导航、页面顶部长条、时间选择器、孩子切换位置完成 1.5 体验收口。
- 今日概览、仪表盘、目标管理、任务管理、学习计划、图书馆、设置页完成多轮 UI 与可用性修正。
- 后端任务、计划、阅读、图书馆等模块已进行稳定性修正。

## 当前未完成

- 1.9.0 不再继续扩范围，后续新需求进入 1.9.x；1.9.1 UI 架构升级版已完成桌面端发版候选。
- `/home/ubuntu` 旧仓库已停用并归档到 `/srv/legacy`，后续只需观察期后确认是否压缩长期保存。
- 移动端弹窗和移动端截图走查不作为 1.9.1 发版阻塞项，后续单独规划。
- 1.9 还没有后端 schema 迁移；稳定性层和数理认知试点目前先写入现有 `checkin.metadata`。
- 目标校适配权重、置信度、Velocity、余力指数和跨学科交叉验证仍在 1.9.x。
- 正式环境还需要执行 1.7.4 migration。
- 正式环境还需要执行《封神演义》状态修复脚本。
- 后端调试日志仍偏多，建议放入 1.7.5 清理。
- 节假日表当前内置 2026 年，后续每年需在官方公布后补下一年。
- 三层准备度模型、目标引擎和轻量诊断基础版已进入 1.9.0。
- 学制配置可并入 1.9 或 1.9.x。
- 数据质量轻量版、能力掌握度和仪表盘重构进入 1.9.x，等待能力模型定型后再做。
- 2.0 前完成主体功能闭环；2.0 全面引入 AI 驱动能力。

## 已验证

- `frontend pnpm build`：通过，2026-05-02。
- 本地核心路由 `/parent`、`/parent/tasks`、`/parent/goals`、`/parent/ability-model`：HTTP 200。
- 本地 API 功能链路：任务创建、任务详情、任务列表、完成打卡、今日打卡回显、目标保存回显均通过。
- `frontend pnpm lint`：通过，保留 2 个既有 warning。
- `frontend pnpm build`：通过。
- `pnpm run check:versions`：通过。
- 生产发布检查：`/api/version` 返回 `1.9.0`，PM2 `study-planner-api` online，运行目录为 `/srv/apps/quxueban/backend`，nginx root 为 `/srv/www/quxueban`。
- 生产旧目录清理：`/home/ubuntu` 不再是 Git 仓库，旧内容已备份到 `/srv/legacy/quxueban-home-repo-20260502-141758`。
- `backend pnpm build`：通过。
- `frontend pnpm build`：通过。
- `backend pnpm lint`：通过。
- `pnpm --filter frontend lint`：通过，2026-05-04。
- `pnpm --filter frontend build`：通过，2026-05-04。
- `pnpm --filter quxueban-backend lint`：通过，2026-05-04。
- `pnpm --filter quxueban-backend build`：通过，2026-05-04。
- `pnpm run check:versions`：通过，2026-05-04。
- `python3 test_full_website_v2.py`：通过，35 项通过、0 失败、0 警告，2026-05-04。
- `frontend pnpm lint`：通过，保留 2 个既有 warning。
- `frontend pnpm build`：通过。
- `backend pnpm build`：通过。
- 本地 `/api/health`：正常。
- 本地前端 `http://127.0.0.1:5173`：正常。
- 本地后端 `http://127.0.0.1:3001`：正常。
- `frontend pnpm build`：通过，有 Vite 大 chunk 提醒，不阻塞构建。
- `frontend pnpm lint`：通过。
- `backend pnpm build`：通过。
- `backend pnpm lint`：通过。
- `pnpm --filter quxueban-backend test -- rate-limit.test.ts`：通过，验证生产限流下 `/api/health`、`/api/version` 不进入业务限流，登录使用独立限流，`/api/children` 使用普通业务限流，2026-05-05。
- `pnpm --filter quxueban-backend lint`：通过，2026-05-05。
- `pnpm --filter quxueban-backend build`：通过，2026-05-05。
- `pnpm --filter frontend lint`：通过，2026-05-05。
- `pnpm --filter frontend build`：通过，2026-05-05。
- `pnpm --filter frontend lint`：通过，目标管理承接三层模型首版后，2026-05-05。
- `pnpm --filter frontend build`：通过，目标管理承接三层模型首版后，2026-05-05。
- `pnpm --filter frontend lint`：通过，目标方向兼容旧目标和缺口主动作收口后，2026-05-05。
- `pnpm --filter frontend build`：通过，目标方向兼容旧目标和缺口主动作收口后，2026-05-05。
- `pnpm --filter frontend lint`：通过，三层准备度页接入关联目标/任务统计后，2026-05-05。
- `pnpm --filter frontend build`：通过，三层准备度页接入关联目标/任务统计后，2026-05-05。
- `pnpm --filter frontend lint`：通过，目标配置器新增保存并关联任务路径后，2026-05-05。
- `pnpm --filter frontend build`：通过，目标配置器新增保存并关联任务路径后，2026-05-05。
- `pnpm --filter frontend lint`：通过，能力点带参创建目标/任务的一次性弹窗处理后，2026-05-05。
- `pnpm --filter frontend build`：通过，能力点带参创建目标/任务的一次性弹窗处理后，2026-05-05。
- `pnpm --filter frontend test -- readiness-goals.test.ts --run`：通过，覆盖目标方向推断、旧目标兼容、目标缺口动作和能力点关联统计，2026-05-05。
- `pnpm --filter frontend lint`：通过，抽取三层目标规则模块并补测试后，2026-05-05。
- `pnpm --filter frontend build`：通过，抽取三层目标规则模块并补测试后，2026-05-05。
- `pnpm --filter quxueban-backend test -- rate-limit.test.ts`：通过，1.9.2 收口复测，2026-05-05。
- `pnpm --filter quxueban-backend lint`：通过，1.9.2 收口复测，2026-05-05。
- `pnpm --filter quxueban-backend build`：通过，1.9.2 收口复测，2026-05-05。
- `pnpm run check:versions`：通过，1.9.2 收口复测，2026-05-05。
- `FRONTEND_URL=http://127.0.0.1:5176 python3 test_1_9_2_screenshots.py`：通过，21 项通过、0 失败、0 警告，覆盖三层准备度、目标管理、目标配置器和任务创建器，2026-05-05。

历史发布记录、旧路线图、旧检查记录和旧 ToDo 已按类型归档到 `docs/releases/`、`docs/roadmaps/`、`docs/checks/`、`docs/todos/`。

## 建议下一步

1. 确认 `1.9.2 三层准备度内核定型版` 发布记录，整理并提交当前改动。
2. 发布 1.9.2 后复查生产限流护栏：`/api/health`、`/api/version`、正常登录、`/api/children` 和连续 `scripts/check-production.sh`。
3. `1.9.3` 再进入数据治理闭环，把数据体检从发现问题升级为定位、修复、复查闭环。
4. `1.9.4` 再进入规则诊断增强，完善置信度、Velocity、余力指数和跨学科交叉验证。
5. `1.9.6` 前完成规则版报告和学习事件日志，再进入 `2.0 AI 驱动版`。
