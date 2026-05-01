# 趣学伴 1.7.7 稳定基线与技术健康报告

更新时间：2026-05-01

## 结论

`1.7.7` 可以作为当前生产稳定基线，但它不是“技术债清零版”。当前系统已经具备稳定运行的基础：

- 生产发布脚本已跑通。
- 后端、前端和 Nginx 发布路径已明确。
- 今日概览和钉钉学习时长口径已统一。
- 重复打卡已有诊断和清理脚本。
- 发布协作规范已文档化。

但后续进入 1.8 前，建议先完成一轮技术健康治理，避免在不稳定基础上扩大功能。

## 当前验证结果

### 通过项

- `pnpm run check:versions` 通过。
- `pnpm --dir backend build` 通过。
- `pnpm --dir frontend build` 通过。
- `pnpm --dir backend lint` 通过。
- `pnpm --dir frontend lint` 通过，无 error。
- `pnpm --dir frontend test -- --run` 通过：1 个测试文件，3 个测试。
- `pnpm --dir backend exec jest --runInBand` 通过：1 个测试文件，7 个测试。
- 生产 `./scripts/release-production.sh full` 已跑通。
- 生产 `/api/version` 返回 `1.7.7`。

### 注意项

- 本地 Node 是 `v25.8.0`，生产 Node 是 `v20.20.2`。本地和生产主版本不一致。
- 后端 Jest/Supertest 在本地沙箱内会因为 `listen EPERM` 失败，需要在非沙箱或提权环境运行。
- 前端 lint 有 2 个 warning，不影响构建：
  - `Library.tsx` 中 React Hook Form `watch()` 被 React Compiler 标记为不可安全 memoize。
  - `ChildrenManagement.tsx` 中 `useEffect` 缺少 `handleOpenAdd` 依赖。

## 技术栈状态

### 建议锁定的运行环境

短期建议：

- 生产继续使用 Node `20.x`。
- 本地开发也切到 Node `20.x`，避免 Node 25 带来的非生产差异。
- pnpm 暂时使用 `10.32.x/10.33.x`，不作为 P0 问题。

建议新增：

- `.nvmrc` 或 `.node-version`：`20`
- 文档明确：本地开发和生产统一 Node 20。

### 不建议立刻大版本升级

以下依赖有新大版本，但不建议在 1.7 稳定期直接升级：

- `prisma 6 -> 7`
- `@prisma/client 6 -> 7`
- `express 4 -> 5`
- `vite 7 -> 8`
- `typescript 5 -> 6`
- `eslint 9 -> 10`
- `jest 29 -> 30`
- `recharts 2 -> 3`
- `react-resizable-panels 3 -> 4`
- `lucide-react 0.x -> 1.x`

原因：

- 这些升级涉及构建、运行时、类型系统或路由中间件行为。
- 当前目标是稳定，不是技术栈大迁移。
- 应放到单独维护窗口，每次只升一类，并配套回归。

### 可以小步升级的依赖

可在 1.7.8 或 1.7.9 中考虑小补丁升级：

- `axios 1.15.0 -> 1.15.2`
- `@tanstack/react-query 5.100.5 -> 5.100.6`
- `react 19.2.4 -> 19.2.5`
- `react-dom 19.2.4 -> 19.2.5`
- `prettier 3.8.1 -> 3.8.3`
- `ts-jest 29.4.6 -> 29.4.9`
- `@typescript-eslint/* 8.57.1 -> 8.59.1`
- `typescript-eslint 8.59.0 -> 8.59.1`

原则：补丁升级也必须单独提交，跑完整构建和测试，不混入业务功能。

## 安全审计结果

`pnpm audit --audit-level moderate` 当前有安全告警：

- 1 critical
- 11 high
- 9 moderate
- 1 low

需要区分运行时风险和开发依赖风险。

### 需要优先处理

#### 1. `xlsx`

风险：

- `xlsx <0.19.3` Prototype Pollution。
- `xlsx <0.20.2` ReDoS。
- npm 公开包当前没有正常 patched version 标记。

项目影响：

- 图书馆 Excel 导入/导出依赖 `xlsx`。
- 这是运行时路径，优先级高。

建议：

- 短期：限制上传文件大小、保留导入预检、避免处理不可信超大文件。
- 中期：评估替代库或 SheetJS 官方分发方案。
- 不建议在未验证导入/导出回归前直接替换。

#### 2. `express 4` 传递 `path-to-regexp`

风险：

- `express 4.x` 依赖旧 `path-to-regexp`，审计报 ReDoS。

项目影响：

- 后端运行时依赖。

建议：

- 短期：不直接升 Express 5，避免中间件和路由行为变化。
- 中期：建立 Express 5 迁移分支，跑 API 回归。

#### 3. `axios` 传递 `follow-redirects`

风险：

- 自定义认证头可能跨域重定向泄露。

项目影响：

- 后端和前端都有 axios。

建议：

- 优先小版本升级 axios。
- 检查后端外部请求是否会携带敏感 header 并跟随跨域 redirect。

### 主要开发依赖风险

- `ts-jest -> handlebars`
- `eslint -> flatted`
- `@types/jest -> picomatch`
- `prisma -> effect/defu`

这些大多在测试、lint、生成或开发工具链中触发。仍需要治理，但不应和运行时修复混在一起。

## 目录结构健康

### 当前问题

#### 1. 根 `package.json` 仍像旧后端模板

现象：

- 根包名是 `spec-template-backend`。
- 根包包含一套后端依赖。
- 根 `build` 是 `prisma generate && tsc`，但根 `tsconfig.json` 没有有效 `src`，在根目录执行 `pnpm build` 会失败。

影响：

- 容易误导本地开发和发布。
- 增加依赖审计噪音。
- 让“根项目”和“backend 子项目”的边界不清晰。

建议：

- 将根包改为 workspace 管理包。
- 根脚本只保留：
  - `check:versions`
  - `build:backend`
  - `build:frontend`
  - `build`
  - `test`
  - `lint`
- 根依赖逐步清空或迁移到对应 workspace。

#### 2. `debt-tracker` 和 `packages/dashboard` 混在同一仓库

现象：

- `debt-tracker` 是独立前端应用。
- `packages/dashboard` 是 Vue 示例/仪表盘类项目。
- 它们会参与部分 workspace 依赖扫描和安全审计。

影响：

- 增加依赖、构建和审计复杂度。
- 不利于把趣学伴作为稳定产品维护。

建议：

- 判断是否仍需要保留。
- 如果不属于趣学伴生产路径，移出 workspace 或归档到 `archive/`。
- 如果未来会用，明确用途和负责人。

#### 3. 构建产物和运行数据存在本地目录

现象：

- `backend/dist`
- `frontend/dist`
- `node_modules`
- `backend/uploads`
- `docker-data`

这些多数已被 `.gitignore` 忽略，问题不大，但需要保持不入库。

建议：

- 保持 `.gitignore`。
- 不在这些目录下做源码改动。

## 代码健康

### 当前可作为门禁的检查

建议从现在开始，发布前固定跑：

```bash
pnpm run check:versions
pnpm --dir backend build
pnpm --dir frontend build
pnpm --dir backend lint
pnpm --dir frontend lint
pnpm --dir backend exec jest --runInBand
pnpm --dir frontend test -- --run
git diff --check
```

### 暂不作为阻断的检查

- `pnpm audit`：先作为报告项，不直接阻断发布。
- `pnpm outdated`：先作为报告项，不直接推动大版本升级。
- 前端 lint warning：记录并后续修复，不阻断当前稳定基线。

## 建议治理顺序

### 1.7.8：环境和目录稳定版

目标：

- 让本地和生产环境一致。
- 清理根包职责。
- 明确哪些目录属于趣学伴生产路径。

任务：

- 新增 `.nvmrc` 或 `.node-version`，锁定 Node 20。
- 改根 `package.json` 为 workspace 管理包，避免根 `pnpm build` 误导。
- 梳理 `debt-tracker`、`packages/dashboard` 是否保留在 workspace。
- 修复前端 lint warning。
- 更新文档：本地开发、发布、健康检查。

### 1.7.9：依赖安全小修版

目标：

- 处理低风险 patch/minor 升级。
- 降低安全审计噪音。

任务：

- 升级 axios、React patch、TanStack Query patch、ts-jest patch、typescript-eslint patch。
- 评估 `@types/bcryptjs` 是否可移除。
- 评估 `xlsx` 替代方案或隔离策略。
- 跑完整回归。

### 1.8 前置维护窗口

目标：

- 处理大版本技术栈升级，不混入业务功能。

候选：

- Express 5 迁移评估。
- Prisma 7 迁移评估。
- Vite 8 迁移评估。
- Jest 30 或测试框架整理。

## 当前决策

- `1.7.7` 可以作为生产稳定基线。
- 不在 `1.7.7` 继续做大版本依赖升级。
- 技术栈升级必须拆成独立小版本或维护分支。
- 进入 1.8 前，先完成 1.7.8 的环境和目录治理。
