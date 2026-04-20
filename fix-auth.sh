#!/bin/bash

# 清理认证相关文件和配置
echo "🧹 开始清理认证相关文件..."

# 1. 清理node_modules中的缓存
if [ -d "frontend/node_modules" ]; then
  echo "清理node_modules缓存..."
  rm -rf frontend/node_modules/.cache
  echo "✅ node_modules缓存已清理"
fi

# 2. 清理构建产物
if [ -d "frontend/dist" ]; then
  echo "清理构建产物..."
  rm -rf frontend/dist
  echo "✅ 构建产物已清理"
fi

# 3. 清理Vite开发服务器缓存
if [ -d "frontend/node_modules/.vite" ]; then
  echo "清理Vite缓存..."
  rm -rf frontend/node_modules/.vite
  echo "✅ Vite缓存已清理"
fi

echo "🎉 清理完成！"
echo "请在浏览器中执行以下操作："
echo "1. 打开 http://localhost:5173"
echo "2. 按F12打开开发者工具"
echo "3. 在Console中输入：localStorage.clear(); sessionStorage.clear(); location.reload(true);"
echo "4. 按Enter执行"
