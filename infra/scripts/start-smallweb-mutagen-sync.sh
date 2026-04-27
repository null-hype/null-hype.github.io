#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
export PATH="$REPO_ROOT/.tools/bin:$PATH"
ARTIFACT_DIR="${ARTIFACT_DIR:-$REPO_ROOT/.tmp-smallweb-mutagen}"
SESSION_NAME="${MUTAGEN_SESSION_NAME:-tidelands-smallweb}"
DESTINATION="${MUTAGEN_DESTINATION:-}"
AUTHORIZED_EMAILS="${ADMIN_AUTHORIZED_EMAILS:-}"
REMOTE_ROOT="${MUTAGEN_REMOTE_ROOT:-/home/smallweb/dev-state/repo}"
DEPLOYMENT_SLOT="${DEPLOYMENT_SLOT:-blue}"
MANAGE_DIRECT_DNS_RECORDS="${MANAGE_DIRECT_DNS_RECORDS:-1}"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env}"
DEFAULT_BACKEND_PREFIX_ROOT="${DEFAULT_BACKEND_PREFIX_ROOT:-tidelands-dev}"
DEFAULT_SSH_KEY_PATH="${DEFAULT_SSH_KEY_PATH:-$HOME/.ssh/null_hype_render_plan_key}"

source_env_file() {
  if [[ ! -f "$ENV_FILE" ]]; then
    return
  fi

  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
}

normalize_env() {
	if [[ -z "${CLOUDFLARE_API_TOKEN:-}" && -n "${CLOUDFLARE_API_KEY:-}" ]]; then
		export CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_KEY"
	fi

	if [[ -z "${BACKEND_BUCKET:-}" && -n "${BUCKET:-}" ]]; then
		export BACKEND_BUCKET="$BUCKET"
	fi

	if [[ -z "${GCP_PROJECT:-}" && -n "${PROJECT_ID:-}" ]]; then
		export GCP_PROJECT="$PROJECT_ID"
	fi

	if [[ -z "${GCP_CREDENTIALS_FILE:-}" && -n "${KEY_PATH:-}" ]]; then
		export GCP_CREDENTIALS_FILE="$KEY_PATH"
	fi

	if [[ -n "${GCP_CREDENTIALS_FILE:-}" && ! -f "$GCP_CREDENTIALS_FILE" && -f "$REPO_ROOT/infra/tidelanes-deploy.json" ]]; then
		export GCP_CREDENTIALS_FILE="$REPO_ROOT/infra/tidelanes-deploy.json"
	fi

	if [[ -n "${SSH_PRIVATE_KEY_FILE:-}" && ! -f "$SSH_PRIVATE_KEY_FILE" && -f "$DEFAULT_SSH_KEY_PATH" ]]; then
		export SSH_PRIVATE_KEY_FILE="$DEFAULT_SSH_KEY_PATH"
	fi

	if [[ -n "${SSH_PUBLIC_KEY_FILE:-}" && ! -f "$SSH_PUBLIC_KEY_FILE" && -f "${DEFAULT_SSH_KEY_PATH}.pub" ]]; then
		export SSH_PUBLIC_KEY_FILE="${DEFAULT_SSH_KEY_PATH}.pub"
	fi

	if [[ -z "${BACKEND_PREFIX:-}" && -z "${BACKEND_PREFIX_ROOT:-}" ]]; then
		export BACKEND_PREFIX_ROOT="$DEFAULT_BACKEND_PREFIX_ROOT"
	fi
}

ensure_ssh_key() {
  if [[ -n "${SSH_PUBLIC_KEY_FILE:-}" && -f "$SSH_PUBLIC_KEY_FILE" ]]; then
    return
  fi

  if [[ -n "${SSH_PUBLIC_KEY:-}" ]]; then
    return
  fi

  mkdir -p "$(dirname "$DEFAULT_SSH_KEY_PATH")"

  if [[ ! -f "$DEFAULT_SSH_KEY_PATH" ]]; then
    umask 077
    ssh-keygen -t ed25519 -f "$DEFAULT_SSH_KEY_PATH" -N '' >/dev/null
  fi

  chmod 600 "$DEFAULT_SSH_KEY_PATH"
  chmod 644 "${DEFAULT_SSH_KEY_PATH}.pub"

  export SSH_PUBLIC_KEY_FILE="${DEFAULT_SSH_KEY_PATH}.pub"
}

ensure_ssh_agent() {
  if [[ -z "${SSH_PRIVATE_KEY_FILE:-}" || ! -f "$SSH_PRIVATE_KEY_FILE" ]]; then
    return
  fi

  if [[ -z "${SSH_AUTH_SOCK:-}" || ! -S "$SSH_AUTH_SOCK" ]]; then
    eval "$(ssh-agent -s)" >/dev/null
  fi

  ssh-add "$SSH_PRIVATE_KEY_FILE" >/dev/null 2>&1
}

configure_mutagen_ssh() {
  if [[ -z "${SSH_PRIVATE_KEY_FILE:-}" || ! -f "$SSH_PRIVATE_KEY_FILE" ]]; then
    return
  fi

  local ssh_bin
  local scp_bin
  ssh_bin="$(command -v ssh)"
  scp_bin="$(command -v scp)"

  mkdir -p "$ARTIFACT_DIR/ssh-bin"

  cat > "$ARTIFACT_DIR/ssh_config" <<EOF
Host *
  IdentityFile $SSH_PRIVATE_KEY_FILE
  IdentitiesOnly yes
  StrictHostKeyChecking no
  UserKnownHostsFile /dev/null
EOF

  cat > "$ARTIFACT_DIR/ssh-bin/ssh" <<EOF
#!/usr/bin/env bash
exec "$ssh_bin" -F "$ARTIFACT_DIR/ssh_config" "\$@"
EOF

  cat > "$ARTIFACT_DIR/ssh-bin/scp" <<EOF
#!/usr/bin/env bash
exec "$scp_bin" -F "$ARTIFACT_DIR/ssh_config" "\$@"
EOF

  chmod +x "$ARTIFACT_DIR/ssh-bin/ssh" "$ARTIFACT_DIR/ssh-bin/scp"
  export MUTAGEN_SSH_PATH="$ARTIFACT_DIR/ssh-bin"

  mutagen daemon stop >/dev/null 2>&1 || true
}

resolve_destination_from_terraform() {
  if [[ -z "${BACKEND_BUCKET:-}" ]]; then
    echo "missing BACKEND_BUCKET; export it or set MUTAGEN_DESTINATION directly" >&2
    return 1
  fi

  if ! command -v terraform >/dev/null 2>&1; then
    echo "terraform is required to resolve MUTAGEN_DESTINATION automatically" >&2
    return 1
  fi

  local backend_prefix
  backend_prefix="$(resolve_backend_prefix)" || return 1

  local -a terraform_env=()

  if [[ -n "${GCP_CREDENTIALS_FILE:-}" ]]; then
    terraform_env+=(GOOGLE_APPLICATION_CREDENTIALS="$GCP_CREDENTIALS_FILE")
  fi

  local outputs_json
  outputs_json="$(
    cd "$REPO_ROOT/infra/terraform"
    env "${terraform_env[@]}" terraform init -reconfigure \
      -backend-config="bucket=$BACKEND_BUCKET" \
      -backend-config="prefix=$backend_prefix" >/dev/null
    env "${terraform_env[@]}" terraform output -json
  )"

  local ssh_connection
  ssh_connection="$(printf '%s' "$outputs_json" | node -e '
    const fs = require("fs");
    const raw = fs.readFileSync(0, "utf8").trim();
    if (!raw) process.exit(1);
    const data = JSON.parse(raw);
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

resolve_backend_prefix() {
  if [[ -n "${BACKEND_PREFIX:-}" ]]; then
    printf '%s\n' "${BACKEND_PREFIX//\{slot\}/$DEPLOYMENT_SLOT}"
    return
  fi

  if [[ -n "${BACKEND_PREFIX_ROOT:-}" ]]; then
    printf '%s/%s/terraform.tfstate\n' "${BACKEND_PREFIX_ROOT%/}" "$DEPLOYMENT_SLOT"
    return
  fi

  echo "missing BACKEND_PREFIX or BACKEND_PREFIX_ROOT" >&2
  return 1
}

build_bundle() {
  local bundle_dir="$ARTIFACT_DIR/bundle"
  local config_path="$bundle_dir/.smallweb-root/.smallweb/config.json"

  mkdir -p "$bundle_dir"
  rsync -a --delete --exclude='.vscode/' "$REPO_ROOT/.smallweb-root/" "$bundle_dir/.smallweb-root/"
  rsync -a --delete "$REPO_ROOT/dist/" "$bundle_dir/dist/"
  rsync -a --delete "$REPO_ROOT/tutorial-app/dist/" "$bundle_dir/tutorial-app/dist/"

  if [[ -z "$AUTHORIZED_EMAILS" ]]; then
    return
  fi

  ADMIN_AUTHORIZED_EMAILS="$AUTHORIZED_EMAILS" CONFIG_PATH="$config_path" node -e '
    const fs = require("fs");
    const configPath = process.env.CONFIG_PATH;
    const emails = (process.env.ADMIN_AUTHORIZED_EMAILS || "")
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (emails.length === 0) process.exit(0);

    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    config.apps = config.apps || {};
    config.apps.admin = {
      ...(config.apps.admin || {}),
      authorizedEmails: emails,
    };
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  '
}

source_env_file
normalize_env
ensure_ssh_key
ensure_ssh_agent

export PUBLIC_GOOSE_SESSION_API_URL="${PUBLIC_GOOSE_SESSION_API_URL:-https://admin.tidelands.dev/api/goose-sessions}"

if ! command -v mutagen >/dev/null 2>&1; then
  echo "mutagen is required" >&2
  exit 1
fi

configure_mutagen_ssh

if [[ -z "$DESTINATION" ]]; then
  DESTINATION="$(resolve_destination_from_terraform)" || {
    echo "set MUTAGEN_DESTINATION explicitly, for example:" >&2
    echo "  export MUTAGEN_DESTINATION='smallweb@203.0.113.10:${REMOTE_ROOT}'" >&2
    exit 1
  }
fi

cd "$REPO_ROOT"

npm run build

build_bundle

if [[ "${MUTAGEN_RESET:-0}" == "1" ]]; then
  mutagen sync terminate "$SESSION_NAME" >/dev/null 2>&1 || true
fi

mutagen sync create \
  --name "$SESSION_NAME" \
  --configuration-file "$REPO_ROOT/infra/mutagen.yml" \
  "$ARTIFACT_DIR/bundle" \
  "$DESTINATION"

mutagen sync flush "$SESSION_NAME"

cat <<EOF
Mutagen session created:
  name:        $SESSION_NAME
  local root:  $ARTIFACT_DIR/bundle
  remote root: $DESTINATION

Preserved on the remote host:
  <remote root>/.smallweb-root/.smallweb/config.json
  <remote root>/.smallweb-root/admin/.env
  <remote root>/.smallweb-root/jules/.env
  <remote root>/.smallweb-root/jules/data/
  <remote root>/.smallweb-root/linear-agent/.env
  <remote root>/.smallweb-root/linear-agent/data/

Remote Smallweb should point at:
  <remote root>/.smallweb-root

Example:
  smallweb up --dir /home/smallweb/dev-state/repo/.smallweb-root --domain tidelands.dev
EOF
