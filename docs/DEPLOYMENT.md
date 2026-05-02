# 趣学伴生产部署流程

## 原则

- 生产环境只使用 `pnpm`，不要在 `/home/ubuntu`、`/home/ubuntu/backend` 或 `/home/ubuntu/frontend` 运行 `npm install`。
- 生产仓库固定放在 `/srv/apps/quxueban`，不要再把 `/home/ubuntu` 当作 Git 仓库根目录。
- 依赖只在仓库根目录 `/srv/apps/quxueban` 安装，使用根目录 `pnpm-lock.yaml`。
- 每次上线必须执行 `prisma migrate deploy`，禁止在生产环境执行 `prisma migrate reset`。
- 前端构建后必须同步到 nginx 根目录 `/srv/www/quxueban`，只执行 `pnpm build` 不会更新线上页面。
- 默认不要删除 `node_modules`。只有依赖树损坏时才使用 `CLEAN_INSTALL=1 bash scripts/deploy-production.sh`。
- 生产环境禁用 pnpm/corepack 按 `packageManager` 自动切换版本，避免触发 pnpm 自安装递归。
- `/home/ubuntu` 只作为登录用户 home 使用；旧仓库观察期内保留，不再用于部署。

## 一键部署

服务器执行：

```bash
cd /srv/apps/quxueban
bash scripts/deploy-production.sh
```

脚本会执行：

1. `git pull --ff-only`
2. 默认保留已有 `node_modules`；只有 `CLEAN_INSTALL=1` 时才清理依赖目录
3. 禁用 pnpm 自管理并安装依赖
4. 执行 Prisma Client 生成和数据库迁移
5. 构建后端和前端
6. 同步前端 `dist` 到 `/srv/www/quxueban`
7. reload nginx，restart PM2
8. 输出健康检查和版本信息

## 一键检查

部署后执行：

```bash
cd /srv/apps/quxueban
bash scripts/check-production.sh
```

重点看：

- `pm2 status` 中 `study-planner-api` 是否 `online`
- `/api/health` 是否返回 `ok`
- `/api/version` 是否为当前版本
- `users.avatar` 字段是否为 `text`
- `/srv/www/quxueban/index.html` 是否为最新构建时间
- nginx 是否包含 `/api/uploads/` 代理规则

## 手动部署命令

如果不用脚本，按下面顺序执行：

```bash
cd /srv/apps/quxueban
git pull --ff-only

sudo chown -R ubuntu:ubuntu /srv/apps/quxueban/node_modules /srv/apps/quxueban/backend/node_modules /srv/apps/quxueban/frontend/node_modules /srv/apps/quxueban/packages 2>/dev/null || true

rm -rf /srv/apps/quxueban/node_modules \
  /srv/apps/quxueban/backend/node_modules \
  /srv/apps/quxueban/frontend/node_modules \
  /srv/apps/quxueban/packages/dashboard/node_modules \
  /srv/apps/quxueban/packages/shared/node_modules \
  /srv/apps/quxueban/package-lock.json \
  /srv/apps/quxueban/backend/package-lock.json \
  /srv/apps/quxueban/frontend/package-lock.json

export COREPACK_ENABLE_PROJECT_SPEC=0
pnpm config set manage-package-manager-versions false --global
pnpm install --frozen-lockfile --prod=false --reporter=append-only

cd /srv/apps/quxueban/backend
COREPACK_ENABLE_PROJECT_SPEC=0 pnpm exec prisma generate
COREPACK_ENABLE_PROJECT_SPEC=0 pnpm exec prisma migrate deploy
COREPACK_ENABLE_PROJECT_SPEC=0 pnpm build

cd /srv/apps/quxueban/frontend
COREPACK_ENABLE_PROJECT_SPEC=0 pnpm build

sudo rsync -av --delete /srv/apps/quxueban/frontend/dist/ /srv/www/quxueban/
sudo chown -R www-data:www-data /srv/www/quxueban
sudo nginx -t
sudo systemctl reload nginx

pm2 restart study-planner-api --update-env || pm2 start /srv/apps/quxueban/ecosystem.config.js --only study-planner-api
pm2 save

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
pnpm add -g pnpm
```

## 生产目录规范

当前服务器按多应用结构部署：

```text
/srv/apps/quxueban     # 趣学伴代码仓库
/srv/www/quxueban      # nginx 静态文件目录
/home/ubuntu           # 登录用户 home，不再作为应用仓库
```

PM2 配置从环境变量读取目录，默认值适配当前生产路径：

```bash
APP_DIR=/srv/apps/quxueban
BACKEND_DIR=/srv/apps/quxueban/backend
PM2_APP=study-planner-api
```

如果未来同机部署第二套应用，使用独立的 `/srv/apps/<app>`、`/srv/www/<app>`、PM2 应用名和 nginx server block，避免多个应用共享仓库、静态目录或进程名。

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
