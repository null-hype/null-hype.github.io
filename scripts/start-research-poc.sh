#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_ENV_FILE="${ROOT_DIR}/.env"
FALLBACK_ENV_FILE="${ROOT_DIR}/infra/.env"
RESEARCH_NODE_ENV_FILE="${ROOT_DIR}/.smallweb-root/research-node/.env"
SMALLWEB_ADDR="${SMALLWEB_ADDR:-127.0.0.1:7777}"
GIT_COMMON_DIR="$(git -C "${ROOT_DIR}" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
SHARED_ROOT=""

if [[ -n "${GIT_COMMON_DIR}" ]]; then
  SHARED_ROOT="$(cd "${GIT_COMMON_DIR}/.." && pwd)"
fi

if [[ ! -f "${ROOT_ENV_FILE}" && -f "${FALLBACK_ENV_FILE}" ]]; then
  ROOT_ENV_FILE="${FALLBACK_ENV_FILE}"
fi

if [[ -f "${ROOT_ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ROOT_ENV_FILE}"
  set +a
fi

if [[ -z "${RESEARCH_NODE_WEBHOOK_SECRET:-}" && -n "${LINEAR_WEBHOOK_SECRET:-}" ]]; then
  RESEARCH_NODE_WEBHOOK_SECRET="${LINEAR_WEBHOOK_SECRET}"
fi

if [[ -z "${RESEARCH_NODE_MCP_BEARER_TOKEN:-}" ]]; then
  RESEARCH_NODE_MCP_BEARER_TOKEN="$(node -e 'console.log(require("node:crypto").randomBytes(24).toString("hex"))')"
fi

if [[ -z "${RESEARCH_NODE_WORKER_TOKEN:-}" ]]; then
  RESEARCH_NODE_WORKER_TOKEN="$(node -e 'console.log(require("node:crypto").randomBytes(24).toString("hex"))')"
fi

RESEARCH_NODE_WORKER_URL="${RESEARCH_NODE_WORKER_URL:-http://127.0.0.1:7791}"
RESEARCH_NODE_BASE_URL="${RESEARCH_NODE_BASE_URL:-http://research-node.tidelands.dev}"
RESEARCH_NODE_TARGET_LABEL="${RESEARCH_NODE_TARGET_LABEL:-lunary-calibration}"

mkdir -p \
  "$(dirname "${RESEARCH_NODE_ENV_FILE}")" \
  "${ROOT_DIR}/.smallweb-cache" \
  "${ROOT_DIR}/.smallweb-data"

cat > "${RESEARCH_NODE_ENV_FILE}" <<EOF
RESEARCH_NODE_WEBHOOK_SECRET=${RESEARCH_NODE_WEBHOOK_SECRET:-}
RESEARCH_NODE_ALLOWED_CLOCK_SKEW_MS=${RESEARCH_NODE_ALLOWED_CLOCK_SKEW_MS:-60000}
RESEARCH_NODE_RUNTIME_DIR=${RESEARCH_NODE_RUNTIME_DIR:-}
RESEARCH_NODE_BASE_URL=${RESEARCH_NODE_BASE_URL}
RESEARCH_NODE_TARGET_LABEL=${RESEARCH_NODE_TARGET_LABEL}
RESEARCH_NODE_MCP_BEARER_TOKEN=${RESEARCH_NODE_MCP_BEARER_TOKEN}
RESEARCH_NODE_WORKER_URL=${RESEARCH_NODE_WORKER_URL}
RESEARCH_NODE_WORKER_TOKEN=${RESEARCH_NODE_WORKER_TOKEN}
EOF

if [[ -n "${DENO_BIN:-}" ]]; then
  deno_bin="${DENO_BIN}"
elif command -v deno >/dev/null 2>&1; then
  deno_bin="$(command -v deno)"
elif [[ -x "${ROOT_DIR}/.deno-runtime/bin/deno" ]]; then
  deno_bin="${ROOT_DIR}/.deno-runtime/bin/deno"
elif [[ -n "${SHARED_ROOT}" && -x "${SHARED_ROOT}/.deno-runtime/bin/deno" ]]; then
  deno_bin="${SHARED_ROOT}/.deno-runtime/bin/deno"
else
  echo "Deno is required. Set DENO_BIN or install it under ${ROOT_DIR}/.deno-runtime/bin/deno." >&2
  exit 1
fi

if [[ -n "${SMALLWEB_BIN:-}" ]]; then
  smallweb_bin="${SMALLWEB_BIN}"
elif command -v smallweb >/dev/null 2>&1; then
  smallweb_bin="$(command -v smallweb)"
elif [[ -x "/home/vscode/.local/bin/smallweb" ]]; then
  smallweb_bin="/home/vscode/.local/bin/smallweb"
else
  echo "smallweb is required. Set SMALLWEB_BIN or install it on PATH." >&2
  exit 1
fi

export PATH="$(dirname "${deno_bin}"):${PATH}"
export DENO_DIR="${DENO_DIR:-${ROOT_DIR}/.smallweb-data/deno}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-${ROOT_DIR}/.smallweb-cache}"

echo "Starting Smallweb POC on http://${SMALLWEB_ADDR}"
echo "Use Host: research-node.tidelands.dev for the research node app"
echo "Start the worker separately with: npm run research:worker:start"

exec "${smallweb_bin}" up --dir "${ROOT_DIR}/.smallweb-root" --addr "${SMALLWEB_ADDR}"
