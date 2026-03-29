#!/usr/bin/env bash
# bootstrap-docker-engine.sh — prepare a Debian host for Docker-over-SSH.
# Intended to run once on the VM that Render will target via DOCKER_HOST=ssh://...
set -euo pipefail

if ! command -v sudo >/dev/null 2>&1; then
  echo "[docker-bootstrap] sudo is required" >&2
  exit 1
fi

echo "[docker-bootstrap] updating apt metadata"
sudo apt-get update -y

if ! command -v docker >/dev/null 2>&1; then
  echo "[docker-bootstrap] installing Docker engine"
  curl -fsSL https://get.docker.com | sudo sh
else
  echo "[docker-bootstrap] docker already installed"
fi

echo "[docker-bootstrap] enabling docker service"
sudo systemctl enable --now docker

if getent group docker >/dev/null 2>&1; then
  echo "[docker-bootstrap] adding ${USER} to docker group"
  sudo usermod -aG docker "${USER}"
fi

echo "[docker-bootstrap] docker version"
sudo docker version

cat <<'EOF'
[docker-bootstrap] complete

Next steps:
  1. Reconnect your SSH session so docker-group membership applies.
  2. Confirm `docker info` works without sudo.
  3. Set Render env var:
       REMOTE_DOCKER_SSH_TARGET=<user>@<host>
EOF
