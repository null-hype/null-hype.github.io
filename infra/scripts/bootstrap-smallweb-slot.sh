#!/usr/bin/env bash
set -euo pipefail

REMOTE_ROOT="${1:-/opt/tidelands/smallweb}"
DOMAIN="${2:-tidelands.dev}"
ACTION="${3:-setup}"

if ! command -v sudo >/dev/null 2>&1; then
  echo "[smallweb-slot] sudo is required" >&2
  exit 1
fi

case "$ACTION" in
  setup|start)
    ;;
  *)
    echo "[smallweb-slot] expected action setup or start" >&2
    exit 1
    ;;
esac

echo "[smallweb-slot] ensuring docker is installed"
sudo apt-get update -y

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
fi

sudo systemctl enable --now docker

echo "[smallweb-slot] preparing ${REMOTE_ROOT}"
sudo mkdir -p "$REMOTE_ROOT"
sudo chown -R "$USER":"$USER" "$REMOTE_ROOT"

cat > "$REMOTE_ROOT/docker-compose.yml" <<EOF
services:
  smallweb:
    image: ghcr.io/pomdtr/smallweb:latest
    restart: unless-stopped
    command:
      - up
      - --dir
      - /srv/.smallweb-root
      - --domain
      - ${DOMAIN}
      - --enable-crons
      - --on-demand-tls
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - .:/srv
      - smallweb-deno-cache:/root/.cache/deno
      - smallweb-tls-cache:/root/.cache/certmagic

volumes:
  smallweb-deno-cache:
  smallweb-tls-cache:
EOF

if [[ "$ACTION" == "start" ]]; then
  echo "[smallweb-slot] starting compose stack"
  docker compose -f "$REMOTE_ROOT/docker-compose.yml" up -d --force-recreate
fi

cat <<EOF
[smallweb-slot] ${ACTION} complete
  root:   ${REMOTE_ROOT}
  domain: ${DOMAIN}
EOF
