#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/git-publish.sh "commit message" <file-or-dir>...

Examples:
  ./scripts/git-publish.sh "docs: add iteration plan" docs/ITERATION_PLAN_1_7_TO_1_9.md docs/PRODUCT_MANUAL_1_6.md
  RUN_CHECKS=frontend ./scripts/git-publish.sh "fix: update avatar upload" frontend/src/pages/parent/Settings.tsx

Notes:
  - This script never runs "git add .".
  - You must explicitly list files or directories to stage.
  - It blocks known local/import/backup files from being staged.

Optional RUN_CHECKS:
  RUN_CHECKS=frontend  Run frontend lint and build before commit.
  RUN_CHECKS=backend   Run backend lint and build before commit.
  RUN_CHECKS=all       Run backend lint/build and frontend lint/build before commit.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 2 ]]; then
  usage
  exit 1
fi

MESSAGE="$1"
shift

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "ERROR: current branch is '$CURRENT_BRANCH', expected 'main'." >&2
  exit 1
fi

echo "== sync =="
git fetch origin main
LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse origin/main)"
if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
  echo "ERROR: local main is not equal to origin/main. Pull/rebase first." >&2
  echo "local : $LOCAL_HEAD"
  echo "remote: $REMOTE_HEAD"
  exit 1
fi

echo "== stage explicit paths =="
git add -- "$@"

BLOCKED_PATTERNS=(
  '图书清单.xls'
  '图书清单.xlsx'
  '*_副本.md'
  '*.dump'
  '*.tar.gz'
  'deploy_key'
  'deploy_key.pub'
  'deploy_key_new'
  'deploy_key_new.pub'
)

STAGED_FILES="$(git diff --cached --name-only)"
if [[ -z "$STAGED_FILES" ]]; then
  echo "ERROR: nothing staged." >&2
  exit 1
fi

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    if [[ "$file" == $pattern ]]; then
      echo "ERROR: blocked file is staged: $file" >&2
      echo "Run: git restore --staged \"$file\"" >&2
      exit 1
    fi
  done <<< "$STAGED_FILES"
done

echo "== staged files =="
git diff --cached --stat

case "${RUN_CHECKS:-}" in
  "")
    echo "== checks =="
    echo "Skipped. Set RUN_CHECKS=frontend, backend, or all to run checks."
    ;;
  "frontend")
    echo "== frontend checks =="
    (cd frontend && pnpm lint && pnpm build)
    ;;
  "backend")
    echo "== backend checks =="
    (cd backend && pnpm lint && pnpm build)
    ;;
  "all")
    echo "== backend checks =="
    (cd backend && pnpm lint && pnpm build)
    echo "== frontend checks =="
    (cd frontend && pnpm lint && pnpm build)
    ;;
  *)
    echo "ERROR: unsupported RUN_CHECKS='${RUN_CHECKS:-}'." >&2
    exit 1
    ;;
esac

echo "== commit =="
git commit -m "$MESSAGE"

echo "== push =="
git push

echo "== done =="
git log --oneline -1
