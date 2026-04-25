# 趣学伴部署流程

## 前端唯一发布流程

服务器的 nginx 根目录是：

```bash
/var/www/study-planner
```

所以前端发布必须先在源码目录构建，再同步到 nginx 目录：

```bash
cd /home/ubuntu/frontend
git pull origin main
pnpm build
sudo rsync -av --delete /home/ubuntu/frontend/dist/ /var/www/study-planner/
sudo systemctl restart nginx
```

不要只执行 `pnpm build` 后就重启 nginx；这样只会更新 `/home/ubuntu/frontend/dist`，不会更新线上访问目录。

## 后端发布流程

当前 PM2 进程名是：

```bash
study-planner-api
```

后端发布使用：

```bash
cd /home/ubuntu/backend
git pull origin main
pnpm install
pnpm build
pm2 restart study-planner-api
pm2 status
curl http://localhost:3001/api/health
```

## 数据库迁移

生产库的 Prisma migration 历史目前与源码 migration 目录不完全一致。

暂时不要执行：

```bash
npx prisma migrate deploy
npx prisma migrate reset
```

尤其不要执行 `migrate reset`，它会清空生产数据。
