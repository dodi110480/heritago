#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

API_URL="${API_URL:-http://localhost:3000/api}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:4200}"

PASS=0
FAIL=0

note() { echo "• $*"; }
ok() { echo "✅ $*"; PASS=$((PASS+1)); }
bad() { echo "❌ $*"; FAIL=$((FAIL+1)); }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    bad "Missing required command: $1"
    return 1
  fi
}

note "Smoke test starting"
note "API_URL=${API_URL}"
note "FRONTEND_URL=${FRONTEND_URL}"

require_cmd curl || true

if command -v curl >/dev/null 2>&1; then
  note "Backend: /health"
  if curl -fsS "${API_URL}/health" >/dev/null; then ok "Backend health OK"; else bad "Backend health failed"; fi

  note "Backend: /trees"
  if curl -fsS "${API_URL}/trees" >/dev/null; then ok "Backend trees OK"; else bad "Backend trees failed"; fi

  note "Frontend: root page"
  if curl -fsS "${FRONTEND_URL}/" >/dev/null; then ok "Frontend reachable"; else bad "Frontend not reachable"; fi
else
  note "curl not available; skipping HTTP checks"
fi

note "Frontend build (optional)"
if [ -f "${ROOT_DIR}/package.json" ]; then
  if command -v npm >/dev/null 2>&1; then
    (cd "${ROOT_DIR}" && npm run build) && ok "Frontend build OK" || bad "Frontend build failed"
  else
    note "npm not found; skipped frontend build"
  fi
fi

note "Backend build (optional)"
if [ -f "${ROOT_DIR}/server/package.json" ]; then
  if command -v npm >/dev/null 2>&1; then
    (cd "${ROOT_DIR}/server" && npm run build) && ok "Backend build OK" || bad "Backend build failed"
  else
    note "npm not found; skipped backend build"
  fi
fi

echo
note "Smoke test summary: PASS=${PASS} FAIL=${FAIL}"
if [ "${FAIL}" -gt 0 ]; then
  exit 1
fi
