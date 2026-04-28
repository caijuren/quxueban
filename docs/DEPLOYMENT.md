# 趣学伴生产部署流程

## 原则

- 生产环境只使用 `pnpm`，不要在 `/home/ubuntu`、`/home/ubuntu/backend` 或 `/home/ubuntu/frontend` 运行 `npm install`。
- 依赖只在仓库根目录 `/home/ubuntu` 安装，使用根目录 `pnpm-lock.yaml`。
- 每次上线必须执行 `prisma migrate deploy`，禁止在生产环境执行 `prisma migrate reset`。
- 前端构建后必须同步到 nginx 根目录 `/var/www/study-planner`，只执行 `pnpm build` 不会更新线上页面。

## 一键部署

服务器执行：

```bash
cd /home/ubuntu
bash scripts/deploy-production.sh
```

脚本会执行：

1. `git pull --ff-only`
2. 清理旧的 `node_modules` 和 `package-lock.json`
3. 固定 pnpm 版本并安装依赖
4. 执行 Prisma Client 生成和数据库迁移
5. 构建后端和前端
6. 同步前端 `dist` 到 `/var/www/study-planner`
7. reload nginx，restart PM2
8. 输出健康检查和版本信息

## 一键检查

部署后执行：

```bash
cd /home/ubuntu
bash scripts/check-production.sh
```

重点看：

- `pm2 status` 中 `study-planner-api` 是否 `online`
- `/api/health` 是否返回 `ok`
- `/api/version` 是否为当前版本
- `users.avatar` 字段是否为 `text`
- `/var/www/study-planner/index.html` 是否为最新构建时间
- nginx 是否包含 `/api/uploads/` 代理规则

## 手动部署命令

如果不用脚本，按下面顺序执行：

```bash
cd /home/ubuntu
git pull --ff-only

sudo chown -R ubuntu:ubuntu /home/ubuntu/node_modules /home/ubuntu/backend/node_modules /home/ubuntu/frontend/node_modules /home/ubuntu/packages 2>/dev/null || true

rm -rf /home/ubuntu/node_modules \
  /home/ubuntu/backend/node_modules \
  /home/ubuntu/frontend/node_modules \
  /home/ubuntu/packages/dashboard/node_modules \
  /home/ubuntu/packages/shared/node_modules \
  /home/ubuntu/package-lock.json \
  /home/ubuntu/backend/package-lock.json \
  /home/ubuntu/frontend/package-lock.json

corepack enable
corepack prepare pnpm@10.32.1 --activate
pnpm install --frozen-lockfile --prod=false

cd /home/ubuntu/backend
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm build

cd /home/ubuntu/frontend
pnpm build

sudo rsync -av --delete /home/ubuntu/frontend/dist/ /var/www/study-planner/
sudo chown -R www-data:www-data /var/www/study-planner
sudo nginx -t
sudo systemctl reload nginx

pm2 restart study-planner-api --update-env

curl -sS http://localhost:3001/api/health
curl -sS http://localhost:3001/api/version
pm2 status
```

## 禁止操作

```bash
npm install
npm audit fix --force
npx prisma migrate reset
pnpm prisma:reset
sudo rm -rf /home/ubuntu
```

## 图书清单导入建议

`图书清单.xls` 属于生产数据文件，不提交 Git。上线并确认版本正常后，在图书馆页面选择孩子，再使用“导入”上传。

当前导入器适合导入：

- 书名
- ISBN
- 作者
- 出版社
- 页数
- 字数
- 阅读次数
- 最近一次阅读时间

如果 Excel 是“一书一行”，系统会把它当作已读书库导入，并根据阅读次数或最近阅读时间同步已读状态。它不会拆出多条精细阅读记录。

如果需要导入多次阅读明细，Excel 需要改成“一次阅读一行”，至少包含：

```text
书名 / ISBN / 阅读日期 / 开始页 / 结束页 / 阅读页数 / 阅读时长
```
