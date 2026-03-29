#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/../.env}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud is required" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "env file not found: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

required_vars=(
  PROJECT_ID
  BUCKET
  SA_NAME
  SA_EMAIL
  KEY_PATH
)

for name in "${required_vars[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "missing required variable: $name" >&2
    exit 1
  fi
done

gcloud config set project "$PROJECT_ID"

if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_NAME" \
    --project="$PROJECT_ID" \
    --display-name="Tidelane deploy"
fi

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/compute.instanceAdmin.v1"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/compute.securityAdmin"

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
DEFAULT_COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud iam service-accounts add-iam-policy-binding "$DEFAULT_COMPUTE_SA" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser" \
  --project="$PROJECT_ID"

gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin"

mkdir -p "$(dirname "$KEY_PATH")"

if [[ -e "$KEY_PATH" ]]; then
  echo "refusing to overwrite existing key: $KEY_PATH" >&2
  echo "remove it first or set KEY_PATH to a new file in $ENV_FILE" >&2
  exit 1
fi

gcloud iam service-accounts keys create "$KEY_PATH" \
  --iam-account="$SA_EMAIL" \
  --project="$PROJECT_ID"

cat <<EOF
Service account key created:
  $KEY_PATH

Next deploy command:
  dagger call -m ./infra deploy \\
    --src infra \\
    --gcp-credentials file:$KEY_PATH \\
    --cloudflare-token env:CLOUDFLARE_API_TOKEN \\
    --ssh-public-key file:${SSH_PUBLIC_KEY_FILE:-/tmp/null_hype_render_plan_key.pub} \\
    --ssh-private-key file:${SSH_PRIVATE_KEY_FILE:-/tmp/null_hype_render_plan_key} \\
    --backend-bucket $BUCKET \\
    --backend-prefix ${BACKEND_PREFIX:-tidelands-dev/terraform.tfstate} \\
    --gcp-project $PROJECT_ID \\
    --cloudflare-zone-id ${CLOUDFLARE_ZONE_ID:-}
EOF
