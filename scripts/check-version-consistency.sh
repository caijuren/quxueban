#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

version_of() {
  node -e "const p=require(process.argv[1]); console.log(p.version || '')" "$1/package.json"
}

ROOT_VERSION="$(version_of "$ROOT_DIR")"
BACKEND_VERSION="$(version_of "$ROOT_DIR/backend")"
FRONTEND_VERSION="$(version_of "$ROOT_DIR/frontend")"
API_VERSION="$(grep -E "APP_VERSION = '.*'" backend/src/modules/system.ts | sed -E "s/.*APP_VERSION = '([^']+)'.*/\\1/")"

echo "root package    : $ROOT_VERSION"
echo "backend package : $BACKEND_VERSION"
echo "frontend package: $FRONTEND_VERSION"
echo "api version     : $API_VERSION"

if [[ "$ROOT_VERSION" != "$BACKEND_VERSION" || "$ROOT_VERSION" != "$FRONTEND_VERSION" || "$ROOT_VERSION" != "$API_VERSION" ]]; then
  echo "ERROR: version values are not consistent." >&2
  exit 1
fi

echo "Version check passed."
