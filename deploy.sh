#!/bin/bash
set -e

echo "🚀 开始部署趣学伴应用..."

# 项目目录
PROJECT_DIR="/home/ubuntu/backend"
FRONTEND_DIR="/home/ubuntu/frontend"

# 检查是否在正确的目录
if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ 错误：找不到项目目录 $PROJECT_DIR"
    exit 1
fi

# 部署前健康检查
echo "🔍 部署前健康检查..."
if pm2 status | grep -q "study-planner-api"; then
    echo "✅ 服务正在运行，准备更新"
else
    echo "⚠️  服务未运行，将启动新服务"
fi

cd "$PROJECT_DIR"

echo "📦 拉取最新代码..."
git pull origin main

echo "📦 安装依赖..."
pnpm install

echo "🔄 生成Prisma客户端..."
npx prisma generate

echo "📊 运行数据库迁移..."
npx prisma migrate deploy

echo "🏗️ 构建后端..."
pnpm build

echo "🔄 重启PM2服务..."
pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js

echo "📋 检查服务状态..."
pm2 status

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 健康检查
echo "🔍 健康检查..."
HEALTH_CHECK_URL="http://localhost:3001/api/health"
HEALTH_CHECK_RESULT=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_CHECK_URL")

if [ "$HEALTH_CHECK_RESULT" -eq 200 ]; then
    echo "✅ 服务健康检查通过！"
else
    echo "⚠️  服务健康检查失败，状态码：$HEALTH_CHECK_RESULT"
    echo "🔍 查看日志..."
    pm2 logs study-planner-api --lines 50
    exit 1
fi

echo "🔍 查看最新日志..."
pm2 logs study-planner-api --lines 20

echo "✅ 后端部署完成！"

# 如果前端也需要部署
if [ -d "$FRONTEND_DIR" ]; then
    echo "🎨 开始部署前端..."
    cd "$FRONTEND_DIR"
    
    echo "📦 拉取最新代码..."
    git pull origin main
    
    echo "📦 安装依赖..."
    pnpm install
    
    echo "🏗️ 构建前端..."
    pnpm build
    
    echo "✅ 前端部署完成！"
fi

echo "🎉 部署完成！"
echo "🌐 访问地址：http://124.220.103.120"
echo "📊 服务状态：pm2 status"
echo "📝 查看日志：pm2 logs study-planner-api"
echo "🔍 健康检查：curl $HEALTH_CHECK_URL"