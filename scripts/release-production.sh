#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/release-production.sh <backend|frontend|full|check>

Environment:
  APP_DIR=/home/ubuntu
  BACKEND_DIR=/home/ubuntu/backend
  FRONTEND_DIR=/home/ubuntu/frontend
  WEB_DIR=/var/www/study-planner
  PM2_APP=study-planner-api
  API_BASE=http://127.0.0.1:3001
  PNPM_BIN=pnpm

Examples:
  ./scripts/release-production.sh check
  ./scripts/release-production.sh backend
  ./scripts/release-production.sh frontend
  ./scripts/release-production.sh full
EOF
}

MODE="${1:-}"
if [[ -z "$MODE" || "$MODE" == "-h" || "$MODE" == "--help" ]]; then
  usage
  exit 0
fi

case "$MODE" in
  backend|frontend|full|check) ;;
  *)
    usage
    echo "ERROR: unsupported mode '$MODE'." >&2
    exit 1
    ;;
esac

APP_DIR="${APP_DIR:-/home/ubuntu}"
BACKEND_DIR="${BACKEND_DIR:-$APP_DIR/backend}"
FRONTEND_DIR="${FRONTEND_DIR:-$APP_DIR/frontend}"
WEB_DIR="${WEB_DIR:-/var/www/study-planner}"
PM2_APP="${PM2_APP:-study-planner-api}"
API_BASE="${API_BASE:-http://127.0.0.1:3001}"
PNPM_BIN="${PNPM_BIN:-pnpm}"

export COREPACK_ENABLE_PROJECT_SPEC="${COREPACK_ENABLE_PROJECT_SPEC:-0}"
export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: missing required command: $1" >&2
    exit 1
  fi
}

require_dir() {
  if [[ ! -d "$1" ]]; then
    echo "ERROR: directory does not exist: $1" >&2
    exit 1
  fi
}

package_version() {
  node -e "const p=require(process.argv[1]); console.log(p.version || '')" "$1/package.json"
}

api_version() {
  node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).version||'')}catch{process.exit(1)}})"
}

print_context() {
  echo "== release context =="
  echo "mode        : $MODE"
  echo "app dir     : $APP_DIR"
  echo "backend dir : $BACKEND_DIR"
  echo "frontend dir: $FRONTEND_DIR"
  echo "web dir     : $WEB_DIR"
  echo "pm2 app     : $PM2_APP"
  echo "api base    : $API_BASE"
  echo "pnpm        : $($PNPM_BIN --version)"
}

sync_repo() {
  echo "== git sync =="
  cd "$APP_DIR"
  git status --short
  git pull --ff-only
  git log --oneline -1
}

check_versions() {
  echo "== version check =="
  local root_version backend_version frontend_version
  root_version="$(package_version "$APP_DIR")"
  backend_version="$(package_version "$BACKEND_DIR")"
  frontend_version="$(package_version "$FRONTEND_DIR")"

  echo "root    : $root_version"
  echo "backend : $backend_version"
  echo "frontend: $frontend_version"

  if [[ "$root_version" != "$backend_version" || "$root_version" != "$frontend_version" ]]; then
    echo "ERROR: package versions are not consistent." >&2
    exit 1
  fi
}

install_workspace() {
  echo "== install =="
  cd "$APP_DIR"
  "$PNPM_BIN" config set manage-package-manager-versions false --global >/dev/null 2>&1 || true
  "$PNPM_BIN" install --frozen-lockfile --prod=false --reporter=append-only
}

release_backend() {
  echo "== backend release =="
  cd "$BACKEND_DIR"
  "$PNPM_BIN" prisma migrate deploy
  "$PNPM_BIN" build

  if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
    pm2 restart "$PM2_APP" --update-env
  else
    cd "$APP_DIR"
    pm2 start ecosystem.config.js --only "$PM2_APP"
  fi
  pm2 save
}

release_frontend() {
  echo "== frontend release =="
  cd "$FRONTEND_DIR"
  "$PNPM_BIN" build

  echo "== frontend smoke =="
  if grep -R "批量操作" -n dist >/tmp/quxueban-frontend-smoke.txt 2>&1; then
    cat /tmp/quxueban-frontend-smoke.txt
    echo "ERROR: frontend dist still contains hidden batch operation text." >&2
    exit 1
  fi

  echo "== publish frontend =="
  sudo rsync -av --delete "$FRONTEND_DIR/dist/" "$WEB_DIR/"
  sudo chown -R www-data:www-data "$WEB_DIR"
  sudo nginx -t
  sudo systemctl reload nginx
}

verify_production() {
  echo "== production verify =="
  local expected_version live_version
  expected_version="$(package_version "$BACKEND_DIR")"

  for attempt in $(seq 1 30); do
    if curl -fsS "$API_BASE/api/health" >/dev/null 2>&1; then
      break
    fi
    if [[ "$attempt" == "30" ]]; then
      echo "ERROR: backend health check failed." >&2
      pm2 status >&2 || true
      exit 1
    fi
    sleep 1
  done

  curl -sS "$API_BASE/api/health"
  echo
  live_version="$(curl -sS "$API_BASE/api/version" | api_version)"
  echo "api version: $live_version"
  if [[ "$live_version" != "$expected_version" ]]; then
    echo "ERROR: live API version '$live_version' does not match package '$expected_version'." >&2
    exit 1
  fi

  pm2 status
  ls -lh "$WEB_DIR/index.html" 2>/dev/null || true
}

main() {
  require_command git
  require_command node
  require_command curl
  require_command "$PNPM_BIN"
  require_dir "$APP_DIR"
  require_dir "$BACKEND_DIR"
  require_dir "$FRONTEND_DIR"

  print_context
  sync_repo
  check_versions

  if [[ "$MODE" == "check" ]]; then
    verify_production
    exit 0
  fi

  install_workspace

  if [[ "$MODE" == "backend" || "$MODE" == "full" ]]; then
    release_backend
  fi

  if [[ "$MODE" == "frontend" || "$MODE" == "full" ]]; then
    release_frontend
  fi

  verify_production
}

main
