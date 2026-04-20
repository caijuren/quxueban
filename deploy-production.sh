#!/bin/bash

# 部署脚本 - 用于生产服务器部署
# 使用方法: ./deploy-production.sh

set -e

echo "🚀 开始部署曲学伴应用..."

# 1. 进入后端目录
cd /home/ubuntu/backend

echo "📦 步骤1: 拉取最新代码..."
git pull origin main

echo "📦 步骤2: 安装后端依赖..."
pnpm install

echo "🔧 步骤3: 生成Prisma客户端..."
npx prisma generate

echo "🗄️  步骤4: 运行数据库迁移..."
npx prisma migrate deploy

echo "🏗️  步骤5: 构建后端应用..."
pnpm build

echo "🔧 步骤6: 构建前端应用..."
cd /home/ubuntu/frontend
pnpm install
pnpm build

echo "🔄 步骤7: 重启PM2服务..."
cd /home/ubuntu/backend
pm2 restart study-planner-api || pm2 start ecosystem.config.js

echo "✅ 步骤8: 检查服务状态..."
pm2 status

echo "📊 步骤9: 查看最近日志..."
pm2 logs study-planner-api --lines 20

echo "🎉 部署完成!"
echo ""
echo "🔗 应用URL: http://124.220.103.120"
echo "📋 健康检查: curl http://localhost:3001/api/health"
echo "👤 测试登录: curl -X POST http://localhost:3001/api/auth/login -H \"Content-Type: application/json\" -d '{\"username\":\"andycoy\",\"password\":\"123456\"}'"

# 等待2秒后显示PM2状态
sleep 2
echo ""
echo "📋 最终服务状态:"
pm2 status