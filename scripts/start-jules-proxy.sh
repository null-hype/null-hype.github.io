#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_ENV_FILE="${ROOT_DIR}/.env"
JULES_APP_ENV_FILE="${ROOT_DIR}/.smallweb-root/jules/.env"
LINEAR_AGENT_ENV_FILE="${ROOT_DIR}/.smallweb-root/linear-agent/.env"
SMALLWEB_ADDR="${SMALLWEB_ADDR:-127.0.0.1:7777}"
JULES_SOURCE_ID_DEFAULT="github/null-hype/null-hype.github.io"
JULES_PROXY_HOST_DEFAULT="${JULES_PROXY_HOST:-jules.tidelands.dev}"
GIT_COMMON_DIR="$(git -C "${ROOT_DIR}" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
SHARED_ROOT=""

if [[ -n "${GIT_COMMON_DIR}" ]]; then
  SHARED_ROOT="$(cd "${GIT_COMMON_DIR}/.." && pwd)"
fi

if [[ -f "${ROOT_ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ROOT_ENV_FILE}"
  set +a
fi

: "${JULES_API_KEY:?JULES_API_KEY is required}"
: "${JULES_PROXY_TOKEN:?JULES_PROXY_TOKEN is required}"

JULES_SOURCE_ID="${JULES_SOURCE_ID:-${JULES_SOURCE_ID_DEFAULT}}"
JULES_PROXY_URL="${JULES_PROXY_URL:-http://${SMALLWEB_ADDR}}"

mkdir -p \
  "$(dirname "${JULES_APP_ENV_FILE}")" \
  "$(dirname "${LINEAR_AGENT_ENV_FILE}")" \
  "${ROOT_DIR}/.smallweb-cache" \
  "${ROOT_DIR}/.smallweb-data"

cat > "${JULES_APP_ENV_FILE}" <<EOF
JULES_API_KEY=${JULES_API_KEY}
JULES_SOURCE_ID=${JULES_SOURCE_ID}
JULES_PROXY_TOKEN=${JULES_PROXY_TOKEN}
EOF

cat > "${LINEAR_AGENT_ENV_FILE}" <<EOF
LINEAR_WEBHOOK_SECRET=${LINEAR_WEBHOOK_SECRET:-}
LINEAR_OAUTH_ACCESS_TOKEN=${LINEAR_OAUTH_ACCESS_TOKEN:-}
LINEAR_GRAPHQL_ENDPOINT=${LINEAR_GRAPHQL_ENDPOINT:-https://api.linear.app/graphql}
LINEAR_ALLOWED_CLOCK_SKEW_MS=${LINEAR_ALLOWED_CLOCK_SKEW_MS:-60000}
LINEAR_DRY_RUN=${LINEAR_DRY_RUN:-}
LINEAR_AGENT_NAME=${LINEAR_AGENT_NAME:-Smallweb Linear Agent}
JULES_PROXY_URL=${JULES_PROXY_URL}
JULES_PROXY_HOST=${JULES_PROXY_HOST_DEFAULT}
JULES_PROXY_TOKEN=${JULES_PROXY_TOKEN}
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

echo "Starting Smallweb stack on http://${SMALLWEB_ADDR}"
echo "Use Host: ${JULES_PROXY_HOST_DEFAULT} for the Jules app"
echo "Use Host: linear-agent.tidelands.dev for the Linear webhook app"

exec "${smallweb_bin}" up --dir "${ROOT_DIR}/.smallweb-root" --addr "${SMALLWEB_ADDR}"
