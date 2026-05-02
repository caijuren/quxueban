# 趣学伴 1.9 生产迁移后检查记录

日期：2026-05-02

## 生产迁移结果

- 生产代码仓库：`/srv/apps/quxueban`
- 生产前端静态目录：`/srv/www/quxueban`
- PM2 后端运行目录：`/srv/apps/quxueban/backend`
- 旧 `/home/ubuntu` 仓库已停用，`.git` 已移出。
- 旧目录已备份到 `/srv/legacy/quxueban-home-repo-20260502-141758/home-copy`。
- 旧业务目录已移动到 `/srv/legacy/quxueban-home-repo-20260502-141758/moved`。

## 生产验证

- `/home/ubuntu` 执行 `git status` 返回 `fatal: not a git repository`。
- PM2 `study-planner-api` 在线，版本 `1.9.0`。
- PM2 `script path` 为 `/srv/apps/quxueban/backend/dist/index.js`。
- PM2 `exec cwd` 为 `/srv/apps/quxueban/backend`。
- `http://localhost:3001/api/version` 返回 `1.9.0`。
- nginx 只加载 `root /srv/www/quxueban`，不再出现 `root /var/www/study-planner`。

## 本地检查

已执行：

```bash
pnpm --dir frontend lint
pnpm --dir backend build
pnpm --dir frontend build
```

结果：

- `backend build` 通过。
- `frontend build` 通过。
- `frontend lint` 通过，保留 2 个既有 warning：
  - `Library.tsx` React Hook Form `watch()` incompatible-library。
  - `ChildrenManagement.tsx` `handleOpenAdd` exhaustive-deps。

本地服务检查：

- 本地已有后端监听 `3001`，`/api/health` 正常。
- 前端 Vite 服务监听 `5173`。
- 核心路由 HTTP 200：
  - `/parent`
  - `/parent/ability-model`
  - `/parent/tasks`
  - `/parent/goals`
  - `/parent/library`

## 仍需人工视觉走查

当前环境完成了构建、接口健康和路由可达性检查；还没有完成逐页截图级视觉走查。下一轮 UI 收口重点：

- 今日概览：三层摘要、本周建议、稳定性层记录、数理认知摘要。
- 任务完成弹窗：状态记录、认知记录在桌面和移动端的布局。
- 任务列表：层级筛选、三层摘要、卡片字段密度。
- 任务编辑器：三层归属、目标连接、执行设置分组。
- 任务详情：1.9 回流说明、认知层采集建议。
- 目标管理：三层分组、目标卡片、编辑弹窗。
- 能力模型：三层总览、阶段切换、旧数据兼容展示。

