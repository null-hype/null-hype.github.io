#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/infra/.env}"
MODULE_PATH="${MODULE_PATH:-$REPO_ROOT/infra}"
DAGGER_BIN="${DAGGER_BIN:-$REPO_ROOT/.tools/bin/dagger}"

if [[ $# -lt 1 ]]; then
  echo "usage: ./infra/scripts/dagger.sh <function> [dagger args...]" >&2
  exit 1
fi

COMMAND="$1"
shift

exec pass-cli run --env-file "$ENV_FILE" -- \
  "$DAGGER_BIN" call -m "$MODULE_PATH" "$COMMAND" \
  --cloudflare-token=env:CLOUDFLARE_API_TOKEN \
  --ssh-private-key=env:SSH_PRIVATE_KEY \
  --ssh-public-key=env:SSH_PUBLIC_KEY \
  --openrouter-api-key=env:OPENROUTER_API_KEY \
  --gcp-credentials=env:GCP_CREDENTIALS_JSON \
  --backend-bucket=env:BACKEND_BUCKET \
  --backend-prefix=env:BACKEND_PREFIX \
  --gcp-project=env:GCP_PROJECT \
  --cloudflare-zone-id=env:CLOUDFLARE_ZONE_ID \
  --deployment-slot=env:DEPLOYMENT_SLOT \
  --admin-authorized-emails=env:ADMIN_AUTHORIZED_EMAILS \
  "$@"
