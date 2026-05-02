# 趣学伴协作与发布规范

更新时间：2026-05-01

## 一、协作分工

### Codex 负责

- 阅读代码、定位问题、修改代码和文档。
- 本地执行必要检查，例如：
  - `pnpm run check:versions`
  - `pnpm --dir backend build`
  - `pnpm --dir frontend build`
  - `git diff --check`
- 本地创建 Git commit。
- 在最终回复中明确列出：
  - 本次改了什么。
  - 本地验证结果。
  - commit hash。
  - 需要用户执行的 `git push` 命令。
  - 生产服务器发布命令。

### 用户负责

- 执行 GitHub 推送。
- 执行生产服务器发布。
- 在真实页面上做人工验收。
- 把生产反馈和异常现象发回来。

## 二、Git 推送规范

Codex 默认不负责推送 GitHub。每次小版本或修复完成后，只提供命令，由用户本地执行。

常规推送：

```bash
cd /Users/grubby/Desktop/quxueban
git status
git log --oneline -1
git push origin main
```

如果因为 amend 导致本地和远端分叉，且确认远端没有其他人新增提交，使用：

```bash
git push --force-with-lease origin main
```

禁止使用：

```bash
git push --force origin main
```

除非用户明确确认。

## 三、小版本收尾标准

每次 `1.7.x` 小版本至少完成：

1. 版本号一致：
   - 根 `package.json`
   - `backend/package.json`
   - `frontend/package.json`
   - `backend/src/modules/system.ts`
2. 有发布记录：
   - `docs/releases/release-<版本号>.md`
3. 本地检查通过：

```bash
pnpm run check:versions
pnpm --dir backend build
pnpm --dir frontend build
git diff --check
```

4. 最终回复必须给出：
   - commit hash
   - push 命令
   - 服务器发布命令

## 四、生产发布规范

生产服务器发布统一在 `/srv/apps/quxueban` 执行。

### 发布全部

```bash
cd /srv/apps/quxueban
git pull --ff-only
./scripts/release-production.sh full
```

### 只发布后端

```bash
cd /srv/apps/quxueban
git pull --ff-only
./scripts/release-production.sh backend
```

### 只发布前端

```bash
cd /srv/apps/quxueban
git pull --ff-only
./scripts/release-production.sh frontend
```

### 只检查生产状态

```bash
cd /srv/apps/quxueban
./scripts/release-production.sh check
```

## 五、前后端发布判断

### 必须发布后端的情况

- 修改 `backend/` 下代码。
- 修改 Prisma schema 或 migrations。
- 修改后端脚本。
- 修改 `/api/version`。
- 修改钉钉推送、今日概览统计、任务发布、图书馆接口。

### 必须发布前端的情况

- 修改 `frontend/` 下代码。
- 修改 Logo、favicon、manifest。
- 修改页面展示、按钮、弹窗、上传格式、图书馆卡片。
- 修改前端节假日预览逻辑。

### 必须 full 发布的情况

- 同时改了 `backend/` 和 `frontend/`。
- 不确定改动影响范围。
- 小版本正式发布。

## 六、生产诊断命令

### API 版本

```bash
curl http://127.0.0.1:3001/api/version
```

### PM2 状态

```bash
pm2 status
```

### 学习时长诊断

```bash
cd /srv/apps/quxueban/backend
FAMILY_ID=1 CHILD_ID=24 CHECK_DATE=2026-04-30 pnpm run script:check-daily-study-minutes
```

### 重复打卡预览

```bash
cd /srv/apps/quxueban/backend
FAMILY_ID=1 CHILD_ID=24 START_DATE=2026-04-01 END_DATE=2026-05-01 pnpm run script:cleanup-duplicate-checkins
```

### 重复打卡清理

```bash
cd /srv/apps/quxueban/backend
FAMILY_ID=1 CHILD_ID=24 START_DATE=2026-04-01 END_DATE=2026-05-01 APPLY=true pnpm run script:cleanup-duplicate-checkins
```

### 书籍状态修复

```bash
cd /srv/apps/quxueban/backend
FAMILY_ID=1 CHILD_ID=24 BOOK_NAME=封神演义 pnpm run script:set-book-reading
```

## 七、节假日维护规范

每年国务院公布下一年放假安排后，更新：

- `backend/src/utils/china-holidays.ts`
- `frontend/src/lib/china-holidays.ts`

检查命令：

```bash
cd /srv/apps/quxueban/backend
HOLIDAY_CHECK_YEAR=2027 HOLIDAY_MIN_DAYS=20 pnpm run script:check-next-year-holidays
```

严格检查：

```bash
HOLIDAY_CHECK_YEAR=2027 HOLIDAY_MIN_DAYS=20 HOLIDAY_CHECK_STRICT=true pnpm run script:check-next-year-holidays
```

## 八、沟通规范

当用户说“继续”时：

- 默认继续当前路线图里的下一项。
- 如果当前项需要发布，先完成代码、文档、验证和提交，再给用户 push 和发布命令。
- 不在未完成验证时建议发布。

当用户说“先不发布”时：

- 继续本地开发和提交。
- 最终只给出 commit 和后续发布命令，不催促上线。

当生产现象和代码预期不一致时：

- 先判断是否前端未发布、后端未重启、浏览器缓存、服务器目录不一致。
- 再查数据库。
- 不直接假设用户操作错。

## 九、当前固定路径

- 本地仓库：`/Users/grubby/Desktop/quxueban`
- 生产 Git 根目录：`/srv/apps/quxueban`
- 生产后端目录：`/srv/apps/quxueban/backend`
- 生产前端目录：`/srv/apps/quxueban/frontend`
- Nginx 静态目录：`/srv/www/quxueban`
- PM2 应用名：`study-planner-api`
