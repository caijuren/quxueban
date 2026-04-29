#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu}"
WEB_DIR="${WEB_DIR:-/var/www/study-planner}"
PM2_APP="${PM2_APP:-study-planner-api}"
PNPM_BIN="${PNPM_BIN:-pnpm}"

# Prevent pnpm/corepack from trying to install the packageManager version during deploy.
# Production already has pnpm installed globally; recursive self-install can exhaust SSH/processes.
export COREPACK_ENABLE_PROJECT_SPEC="${COREPACK_ENABLE_PROJECT_SPEC:-0}"
export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"

cd "$APP_DIR"

echo "== preflight =="
git status --short
git pull --ff-only

if [ "${CLEAN_INSTALL:-0}" = "1" ]; then
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
else
  echo "== dependency cleanup skipped =="
  echo "Set CLEAN_INSTALL=1 only when a clean reinstall is required."
fi

echo "== install =="
if ! command -v "$PNPM_BIN" >/dev/null 2>&1; then
  echo "ERROR: pnpm is not installed. Install pnpm before deploying." >&2
  exit 1
fi
"$PNPM_BIN" config set manage-package-manager-versions false --global >/dev/null 2>&1 || true
echo "pnpm version: $("$PNPM_BIN" --version)"
"$PNPM_BIN" install --frozen-lockfile --prod=false --reporter=append-only

echo "== database =="
cd "$APP_DIR/backend"
"$PNPM_BIN" exec prisma generate
"$PNPM_BIN" exec prisma migrate deploy

echo "== backend build =="
"$PNPM_BIN" build

echo "== frontend build =="
cd "$APP_DIR/frontend"
"$PNPM_BIN" build

echo "== publish frontend =="
sudo rsync -av --delete "$APP_DIR/frontend/dist/" "$WEB_DIR/"
sudo chown -R www-data:www-data "$WEB_DIR"
sudo nginx -t
sudo systemctl reload nginx

echo "== restart backend =="
cd "$APP_DIR"
if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP" --update-env
else
  pm2 start ecosystem.config.js --only "$PM2_APP"
fi
pm2 save

echo "== verify =="
curl -sS http://localhost:3001/api/health
echo
curl -sS http://localhost:3001/api/version
echo
curl -sS http://localhost/ | grep -o 'assets/[^"]*' | head || true
pm2 status
