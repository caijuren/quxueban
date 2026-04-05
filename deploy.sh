#!/bin/bash
set -e
echo "✅ 开始部署..."

cd /home/ubuntu
echo "📥 同步代码..."
git fetch origin main
git reset --hard origin/main

echo "🔨 构建后端..."
cd backend
npm install --production=false
npm run build

echo "🔨 构建前端..."
cd ../frontend
npm install --production=false
npm run build

echo "📦 部署前端..."
sudo cp -r dist/* /var/www/study-planner/
sudo chown -R www-data:www-data /var/www/study-planner

echo "🔄 重启服务..."
pm2 restart study-planner-api

echo "🎉 部署完成！$(date)"
