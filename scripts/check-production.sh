#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu}"
WEB_DIR="${WEB_DIR:-/var/www/study-planner}"
PNPM_BIN="${PNPM_BIN:-pnpm}"

export COREPACK_ENABLE_PROJECT_SPEC="${COREPACK_ENABLE_PROJECT_SPEC:-0}"

cd "$APP_DIR"

echo "== git =="
git log --oneline -3
git status --short

echo "== package manager =="
"$PNPM_BIN" config get manage-package-manager-versions || true
"$PNPM_BIN" --version
cat package.json | grep '"packageManager"' || true
cat pnpm-workspace.yaml

echo "== versions =="
cat backend/package.json | grep '"version"'
cat frontend/package.json | grep '"version"'
curl -sS http://localhost:3001/api/version
echo

echo "== health =="
curl -sS http://localhost:3001/api/health
echo
pm2 status
ps -ef | grep -E "backend/dist/index.js|PM2" | grep -v grep || true

echo "== database avatar column =="
cd "$APP_DIR/backend"
"$PNPM_BIN" exec prisma db execute --stdin --schema prisma/schema.prisma <<'SQL'
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'avatar';
SQL

echo "== uploads route =="
curl -I http://localhost:3001/api/uploads/avatars/ 2>/dev/null | head -5 || true
curl -I http://124.220.103.120/api/uploads/avatars/ 2>/dev/null | head -5 || true

echo "== frontend dist =="
ls -lh "$APP_DIR/frontend/dist/index.html"
ls -lh "$WEB_DIR/index.html"
curl -sS http://localhost/ | grep -o 'assets/[^"]*' | head || true

echo "== nginx =="
sudo nginx -t
sudo nginx -T 2>/dev/null | grep -n "location \\^~ /api/uploads/\\|location /api\\|root /var/www/study-planner" | head -20 || true
