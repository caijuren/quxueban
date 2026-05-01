# 趣学伴项目部署命令清单

## 服务器信息
- IP: 124.220.103.120
- 用户名: ubuntu
- 项目目录: /home/ubuntu/backend
- 前端目录: /home/ubuntu/frontend

## 部署步骤

### 1. 连接到服务器
```bash
ssh ubuntu@124.220.103.120
```

### 2. 部署后端
```bash
cd /home/ubuntu/backend

# 拉取最新代码
git pull origin main

# 安装依赖
pnpm install

# 生成Prisma客户端
npx prisma generate

# 运行数据库迁移
npx prisma migrate deploy

# 构建
pnpm build

# 重启PM2服务
pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js

# 查看状态
pm2 status
```

### 3. 部署前端
```bash
cd /home/ubuntu/frontend

# 拉取最新代码
git pull origin main

# 安装依赖
pnpm install

# 构建
pnpm build

# 如果使用了nginx，重启nginx
sudo systemctl restart nginx
```

### 4. 健康检查
```bash
# 检查后端API
curl http://localhost:3001/api/health

# 查看日志
pm2 logs study-planner-api --lines 50
```

## 访问地址
- 网站: http://124.220.103.120
- 后端API: http://124.220.103.120:3001/api

## 常见问题

### 如果端口被占用
```bash
# 查看占用3001端口的进程
lsof -i :3001

# 杀死进程
kill -9 <PID>
```

### 如果PM2没有安装
```bash
npm install -g pm2
```

### 如果pnpm没有安装
```bash
npm install -g pnpm
```

### 数据库连接问题
检查环境变量 `DATABASE_URL` 是否正确配置在 ecosystem.config.js 中。
