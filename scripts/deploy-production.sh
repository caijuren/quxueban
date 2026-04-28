#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu}"
WEB_DIR="${WEB_DIR:-/var/www/study-planner}"
PM2_APP="${PM2_APP:-study-planner-api}"

cd "$APP_DIR"

echo "== preflight =="
git status --short
git pull --ff-only

echo "== dependency cleanup =="
sudo chown -R ubuntu:ubuntu \
  "$APP_DIR/node_modules" \
  "$APP_DIR/backend/node_modules" \
  "$APP_DIR/frontend/node_modules" \
  "$APP_DIR/packages" 2>/dev/null || true

rm -rf \
  "$APP_DIR/node_modules" \
  "$APP_DIR/backend/node_modules" \
  "$APP_DIR/frontend/node_modules" \
  "$APP_DIR/packages/dashboard/node_modules" \
  "$APP_DIR/packages/shared/node_modules" \
  "$APP_DIR/package-lock.json" \
  "$APP_DIR/backend/package-lock.json" \
  "$APP_DIR/frontend/package-lock.json"

echo "== install =="
if ! command -v pnpm >/dev/null 2>&1; then
  echo "ERROR: pnpm is not installed. Install pnpm before deploying." >&2
  exit 1
fi
echo "pnpm version: $(pnpm --version)"
pnpm install --frozen-lockfile --prod=false

echo "== database =="
cd "$APP_DIR/backend"
pnpm exec prisma generate
pnpm exec prisma migrate deploy

echo "== backend build =="
pnpm build

echo "== frontend build =="
cd "$APP_DIR/frontend"
pnpm build

echo "== publish frontend =="
sudo rsync -av --delete "$APP_DIR/frontend/dist/" "$WEB_DIR/"
sudo chown -R www-data:www-data "$WEB_DIR"
sudo nginx -t
sudo systemctl reload nginx

echo "== restart backend =="
pm2 restart "$PM2_APP" --update-env

echo "== verify =="
curl -sS http://localhost:3001/api/health
echo
curl -sS http://localhost:3001/api/version
echo
pm2 status
