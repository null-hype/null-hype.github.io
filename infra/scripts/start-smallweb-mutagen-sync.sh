#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
export PATH="$REPO_ROOT/.tools/bin:$PATH"
ARTIFACT_DIR="${ARTIFACT_DIR:-$REPO_ROOT/.tmp-smallweb-mutagen}"
SESSION_NAME="${MUTAGEN_SESSION_NAME:-tidelands-smallweb}"
DESTINATION="${MUTAGEN_DESTINATION:-}"
AUTHORIZED_EMAILS="${ADMIN_AUTHORIZED_EMAILS:-}"
ADDITIONAL_DOMAINS="${SMALLWEB_ADDITIONAL_DOMAINS:-}"
REMOTE_ROOT="${MUTAGEN_REMOTE_ROOT:-/opt/tidelands/smallweb}"
DEPLOYMENT_SLOT="${DEPLOYMENT_SLOT:-blue}"
MANAGE_DIRECT_DNS_RECORDS="${MANAGE_DIRECT_DNS_RECORDS:-1}"
DEFAULT_BACKEND_PREFIX_ROOT="${DEFAULT_BACKEND_PREFIX_ROOT:-tidelands-dev}"
DEFAULT_SSH_KEY_PATH="${DEFAULT_SSH_KEY_PATH:-$HOME/.ssh/null_hype_render_plan_key}"
ENV_FILES=(
  "$REPO_ROOT/.env"
  "$REPO_ROOT/infra/.env"
)

if [[ -n "${NULL_HYPE_ENV_FILES:-}" ]]; then
  IFS=':' read -r -a EXTRA_ENV_FILES <<<"$NULL_HYPE_ENV_FILES"
  for env_file in "${EXTRA_ENV_FILES[@]}"; do
    if [[ -z "$env_file" ]]; then
      continue
    fi

    if [[ "$env_file" = /* ]]; then
      ENV_FILES+=("$env_file")
    else
      ENV_FILES+=("$REPO_ROOT/$env_file")
    fi
  done
fi

source_env_files() {
  local env_file
  for env_file in "${ENV_FILES[@]}"; do
    if [[ ! -f "$env_file" ]]; then
      continue
    fi

    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  done
}

normalize_env() {
  if [[ -z "${CLOUDFLARE_API_TOKEN:-}" && -n "${CLOUDFLARE_API_KEY:-}" ]]; then
    export CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_KEY"
  fi

  if [[ -z "${GCP_PROJECT:-}" && -n "${PROJECT_ID:-}" ]]; then
    export GCP_PROJECT="$PROJECT_ID"
  fi

  if [[ -z "${BACKEND_BUCKET:-}" && -n "${BUCKET:-}" ]]; then
    export BACKEND_BUCKET="$BUCKET"
  fi

  if [[ -z "${BACKEND_PREFIX_ROOT:-}" ]]; then
    if [[ -n "${BACKEND_PREFIX:-}" ]]; then
      export BACKEND_PREFIX_ROOT="${BACKEND_PREFIX%/terraform.tfstate}"
    else
      export BACKEND_PREFIX_ROOT="$DEFAULT_BACKEND_PREFIX_ROOT"
    fi
  fi

  if [[ -z "${GCP_CREDENTIALS_FILE:-}" && -f "$REPO_ROOT/infra/tidelanes-deploy.json" ]]; then
    export GCP_CREDENTIALS_FILE="$REPO_ROOT/infra/tidelanes-deploy.json"
  fi

  unset CLOUDFLARE_API_KEY
  unset CLOUDFLARE_EMAIL
}

ensure_ssh_key() {
  if [[ -n "${SSH_PUBLIC_KEY_FILE:-}" || -n "${SSH_PUBLIC_KEY:-}" ]]; then
    return
  fi

  mkdir -p "$(dirname "$DEFAULT_SSH_KEY_PATH")"

  if [[ ! -f "$DEFAULT_SSH_KEY_PATH" ]]; then
    umask 077
    ssh-keygen -t ed25519 -f "$DEFAULT_SSH_KEY_PATH" -N '' >/dev/null
  fi

  chmod 600 "$DEFAULT_SSH_KEY_PATH"
  chmod 644 "${DEFAULT_SSH_KEY_PATH}.pub"

  export SSH_PRIVATE_KEY_FILE="$DEFAULT_SSH_KEY_PATH"
  export SSH_PUBLIC_KEY_FILE="${DEFAULT_SSH_KEY_PATH}.pub"
}

resolve_destination_from_terraform() {
  if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    echo "missing CLOUDFLARE_API_TOKEN; export it or set MUTAGEN_DESTINATION directly" >&2
    return 1
  fi

  local ssh_public_key_arg
  if [[ -n "${SSH_PUBLIC_KEY_FILE:-}" ]]; then
    ssh_public_key_arg="file:${SSH_PUBLIC_KEY_FILE}"
  elif [[ -n "${SSH_PUBLIC_KEY:-}" ]]; then
    ssh_public_key_arg="env:SSH_PUBLIC_KEY"
  else
    echo "missing SSH_PUBLIC_KEY_FILE or SSH_PUBLIC_KEY; export one of them or set MUTAGEN_DESTINATION directly" >&2
    return 1
  fi

  local -a dagger_args=(
    call -m ./infra outputs
    --src infra
    --cloudflare-token env:CLOUDFLARE_API_TOKEN
    --ssh-public-key "$ssh_public_key_arg"
    --deployment-slot "$DEPLOYMENT_SLOT"
  )

  case "${MANAGE_DIRECT_DNS_RECORDS,,}" in
    0|false|no)
      dagger_args+=(--manage-direct-dns-records=false)
      ;;
  esac

  if [[ -n "${GCP_CREDENTIALS_FILE:-}" ]]; then
    dagger_args+=(--gcp-credentials "file:${GCP_CREDENTIALS_FILE}")
  fi

  local outputs_json
  outputs_json="$("$DAGGER_BIN" "${dagger_args[@]}")"

  local ssh_connection
  ssh_connection="$(printf '%s' "$outputs_json" | node -e '
    const fs = require("fs");
    const raw = fs.readFileSync(0, "utf8").trim();
    if (!raw) process.exit(1);
    let data = JSON.parse(raw);
    if (typeof data === "string") {
      data = JSON.parse(data);
    }
    const value = data?.ssh_connection?.value;
    if (typeof value !== "string" || value.length === 0) {
      process.exit(1);
    }
    process.stdout.write(value);
  ')" || {
    echo "failed to parse ssh_connection from terraform outputs" >&2
    return 1
  }

  printf '%s:%s\n' "$ssh_connection" "$REMOTE_ROOT"
}

source_env_files
normalize_env
ensure_ssh_key

if ! command -v mutagen >/dev/null 2>&1; then
  echo "mutagen is required" >&2
  exit 1
fi

if command -v dagger >/dev/null 2>&1; then
  DAGGER_BIN="${DAGGER_BIN:-$(command -v dagger)}"
elif [[ -x "$REPO_ROOT/.render/bin/dagger" ]]; then
  DAGGER_BIN="${DAGGER_BIN:-$REPO_ROOT/.render/bin/dagger}"
else
  echo "dagger CLI not found; set DAGGER_BIN or install dagger" >&2
  exit 1
fi

if [[ -z "$DESTINATION" ]]; then
  DESTINATION="$(resolve_destination_from_terraform)" || {
    echo "set MUTAGEN_DESTINATION explicitly, for example:" >&2
    echo "  export MUTAGEN_DESTINATION='smallweb@203.0.113.10:${REMOTE_ROOT}'" >&2
    exit 1
  }
fi

cd "$REPO_ROOT"

npm run build

"$DAGGER_BIN" call -m ./infra smallweb-mutagen-project \
  --admin-authorized-emails "$AUTHORIZED_EMAILS" \
  --additional-domains "$ADDITIONAL_DOMAINS" \
  -o "$ARTIFACT_DIR"

if [[ "${MUTAGEN_RESET:-0}" == "1" ]]; then
  mutagen sync terminate "$SESSION_NAME" >/dev/null 2>&1 || true
fi

mutagen sync create \
  --name "$SESSION_NAME" \
  --configuration-file "$ARTIFACT_DIR/mutagen.yml" \
  "$ARTIFACT_DIR/bundle" \
  "$DESTINATION"

mutagen sync flush "$SESSION_NAME"

cat <<EOF
Mutagen session created:
  name:        $SESSION_NAME
  local root:  $ARTIFACT_DIR/bundle
  remote root: $DESTINATION

Preserved on the remote host:
  <remote root>/.smallweb-root/jules/.env
  <remote root>/.smallweb-root/jules/data/
  <remote root>/.smallweb-root/linear-agent/.env
  <remote root>/.smallweb-root/linear-agent/data/

Remote Smallweb should point at:
  <remote root>/.smallweb-root

Example:
  smallweb up --dir /opt/tidelands/smallweb/.smallweb-root --domain tidelands.dev
EOF
