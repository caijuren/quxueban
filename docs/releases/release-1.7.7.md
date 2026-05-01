# 趣学伴 1.7.7 发布记录

发布日期：2026-05-01

## 版本定位

`1.7.7` 是稳定增强版，重点不是新功能，而是把生产发布流程脚本化，降低后续发版时漏掉前端发布、版本检查或健康检查的风险。

## 本次变更

- 新增生产发布脚本：`scripts/release-production.sh`。
- 新增版本一致性检查脚本：`scripts/check-version-consistency.sh`。
- 根 `package.json` 新增脚本：`pnpm run check:versions`。
- 新增重复打卡历史清理脚本：`pnpm run script:cleanup-duplicate-checkins`，默认 dry-run，`APPLY=true` 才删除旧重复。
- 学习时长统计口径抽成后端共享工具，今日概览、钉钉和诊断脚本复用同一算法。
- 节假日检查脚本支持指定年份和最少天数校验：`HOLIDAY_CHECK_YEAR`、`HOLIDAY_MIN_DAYS`、`HOLIDAY_CHECK_STRICT`。
- 版本号更新到 `1.7.7`：
  - 根 `package.json`
  - `backend/package.json`
  - `frontend/package.json`
  - `backend/src/modules/system.ts`

## 发布脚本

服务器上执行：

```bash
cd /home/ubuntu
./scripts/release-production.sh check
./scripts/release-production.sh backend
./scripts/release-production.sh frontend
./scripts/release-production.sh full
```

模式说明：

- `check`：只检查 Git、版本、健康接口、PM2 和静态目录。
- `backend`：发布后端，执行安装、迁移、构建、PM2 重启和版本验证。
- `frontend`：发布前端，执行安装、构建、同步到 `/var/www/study-planner`、Nginx reload 和验证。
- `full`：同时发布后端和前端。

## 推荐发布命令

只改后端时：

```bash
cd /home/ubuntu
./scripts/release-production.sh backend
```

只改前端时：

```bash
cd /home/ubuntu
./scripts/release-production.sh frontend
```

前后端都改时：

```bash
cd /home/ubuntu
./scripts/release-production.sh full
```

## 发布前本地检查

```bash
pnpm run check:versions
pnpm --dir backend build
pnpm --dir frontend build
git diff --check
```

## 生产诊断和清理

查询某天学习时长：

```bash
cd /home/ubuntu/backend
FAMILY_ID=1 CHILD_ID=24 CHECK_DATE=2026-04-30 pnpm run script:check-daily-study-minutes
```

预览重复打卡清理：

```bash
FAMILY_ID=1 CHILD_ID=24 START_DATE=2026-04-01 END_DATE=2026-05-01 pnpm run script:cleanup-duplicate-checkins
```

执行重复打卡清理：

```bash
FAMILY_ID=1 CHILD_ID=24 START_DATE=2026-04-01 END_DATE=2026-05-01 APPLY=true pnpm run script:cleanup-duplicate-checkins
```

检查指定年份节假日：

```bash
HOLIDAY_CHECK_YEAR=2027 HOLIDAY_MIN_DAYS=20 pnpm run script:check-next-year-holidays
```

## 验收标准

- `/api/version` 返回 `1.7.7`。
- `pm2 status` 中 `study-planner-api` 在线。
- 前端静态目录 `/var/www/study-planner/index.html` 已更新。
- 今日概览学习时长、诊断脚本和钉钉推送继续保持一致。
- 图书馆页面仍无批量操作入口。

## 备注

本次是流程收口，不涉及数据库迁移。
