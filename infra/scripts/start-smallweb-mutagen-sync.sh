#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
ARTIFACT_DIR="${ARTIFACT_DIR:-$REPO_ROOT/.tmp-smallweb-mutagen}"
SESSION_NAME="${MUTAGEN_SESSION_NAME:-tidelands-smallweb}"
DESTINATION="${MUTAGEN_DESTINATION:-}"
AUTHORIZED_EMAILS="${ADMIN_AUTHORIZED_EMAILS:-}"

if [[ -z "$DESTINATION" ]]; then
  echo "set MUTAGEN_DESTINATION to the remote sync root, for example:" >&2
  echo "  export MUTAGEN_DESTINATION='smallweb@203.0.113.10:/opt/tidelands/smallweb'" >&2
  exit 1
fi

if [[ -z "$AUTHORIZED_EMAILS" ]]; then
  echo "set ADMIN_AUTHORIZED_EMAILS so the exported admin app allowlist is usable" >&2
  exit 1
fi

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

cd "$REPO_ROOT"

npm run build

"$DAGGER_BIN" call -m ./infra smallweb-mutagen-project \
  --admin-authorized-emails "$AUTHORIZED_EMAILS" \
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

Remote Smallweb should point at:
  <remote root>/.smallweb-root

Example:
  smallweb up --dir /opt/tidelands/smallweb/.smallweb-root --domain tidelands.dev
EOF
