# 生产发布检查清单

适用版本：`1.7.x` 起

## 服务器目录

- Git 根目录：`/home/ubuntu`
- 后端目录：`/home/ubuntu/backend`
- 前端目录：`/home/ubuntu/frontend`
- Nginx 静态目录：`/var/www/study-planner`
- 后端 PM2 应用：`study-planner-api`

## 后端发布

推荐使用脚本：

```bash
cd /home/ubuntu
./scripts/release-production.sh backend
```

手动命令保留用于脚本异常时排查：

```bash
cd /home/ubuntu/backend
git pull
cat package.json | grep version
pnpm install
pnpm prisma migrate deploy
pnpm build
pm2 restart study-planner-api
curl http://127.0.0.1:3001/api/version
```

验收标准：

- `package.json` 版本号符合本次发布版本。
- `/api/version` 返回同一版本号。
- `pm2 status` 中 `study-planner-api` 为 `online`。

## 前端发布

只要改了 `frontend/` 下代码，就必须执行：

推荐使用脚本：

```bash
cd /home/ubuntu
./scripts/release-production.sh frontend
```

手动命令保留用于脚本异常时排查：

```bash
cd /home/ubuntu/frontend
git pull
pnpm install
pnpm build
grep -R "批量操作" -n dist || true
sudo rsync -av --delete dist/ /var/www/study-planner/
sudo nginx -t
sudo systemctl reload nginx
```

验收标准：

- `dist/` 构建成功。
- Nginx 配置检查通过。
- 浏览器强刷后页面展示新功能。
- 手机端如仍显示旧页面，清理缓存或使用无痕窗口验证。

## 常用生产诊断

发布状态检查：

```bash
cd /home/ubuntu
./scripts/release-production.sh check
```

查询某天某孩子学习时长：

```bash
cd /home/ubuntu/backend
FAMILY_ID=1 CHILD_ID=24 CHECK_DATE=2026-04-30 pnpm run script:check-daily-study-minutes
```

修复某本书为在读中：

```bash
cd /home/ubuntu/backend
FAMILY_ID=1 CHILD_ID=24 BOOK_NAME=封神演义 pnpm run script:set-book-reading
```

检查下一年节假日数据：

```bash
cd /home/ubuntu/backend
pnpm run script:check-next-year-holidays
```

检查指定年份节假日数据：

```bash
HOLIDAY_CHECK_YEAR=2027 HOLIDAY_MIN_DAYS=20 pnpm run script:check-next-year-holidays
```

严格模式用于发布前阻断：

```bash
HOLIDAY_CHECK_STRICT=true pnpm run script:check-next-year-holidays
```

预览重复打卡历史清理：

```bash
FAMILY_ID=1 CHILD_ID=24 START_DATE=2026-04-01 END_DATE=2026-05-01 pnpm run script:cleanup-duplicate-checkins
```

执行重复打卡历史清理：

```bash
FAMILY_ID=1 CHILD_ID=24 START_DATE=2026-04-01 END_DATE=2026-05-01 APPLY=true pnpm run script:cleanup-duplicate-checkins
```

## 发布后人工回归

- 今日概览学习时长：同一天同孩子同任务多次打卡时，只按最后一次记录计算。
- 钉钉今日概览：学习时长与今日概览一致。
- 图书馆：批量操作入口不显示。
- 任务证据：支持图片、音频、视频、PDF、Excel、PPT。
- 图书状态：封神演义等人工修复书籍在当前孩子下状态正确。

## 注意事项

- 不要在本地 Mac 执行服务器路径命令，例如 `/home/ubuntu/backend`、`pm2 restart`。
- 本地 Mac 只负责提交和 `git push`。
- 服务器负责 `git pull`、构建、迁移、重启和 Nginx 静态资源发布。
- 后端更新不等于前端已发布；前端必须单独构建并同步到 `/var/www/study-planner`。
