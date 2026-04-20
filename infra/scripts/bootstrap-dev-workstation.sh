#!/usr/bin/env bash
# bootstrap-dev-workstation.sh — install Docker and run the devcontainer on GCE.
# Idempotent: safe to re-run to update the image or restart the container.
set -euo pipefail

IMAGE="${1:?usage: bootstrap-dev-workstation.sh <image>}"
CONTAINER_NAME="dev-workstation"

# ── Docker ────────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "[dev-workstation] installing Docker"
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "[dev-workstation] added $USER to docker group, re-executing via sg"
  exec sg docker "$0 $IMAGE"
fi

# ── Pull image ────────────────────────────────────────────────────────────────
echo "[dev-workstation] pulling $IMAGE"
docker pull "$IMAGE"

# ── Stop existing container ───────────────────────────────────────────────────
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}\$"; then
  echo "[dev-workstation] removing existing container"
  docker rm -f "$CONTAINER_NAME"
fi

# ── State directories ────────────────────────────────────────────────────────
mkdir -p ~/dev-state/{gcloud,ssh,repo}

if [ ! -d ~/dev-state/repo/.git ]; then
  echo "[dev-workstation] cloning repository"
  git clone https://github.com/null-hype/null-hype.github.io.git ~/dev-state/repo
fi

# ── Run container ─────────────────────────────────────────────────────────────
ENV_FILE_FLAG=""
if [ -f ~/dev-state/.env ]; then
  ENV_FILE_FLAG="--env-file $HOME/dev-state/.env"
fi

# shellcheck disable=SC2086
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --privileged \
  --network host \
  $ENV_FILE_FLAG \
  -v ~/dev-state/repo:/workspaces/null-hype.github.io \
  -v ~/dev-state/gcloud:/home/vscode/.config/gcloud \
  -v ~/dev-state/ssh:/home/vscode/.ssh \
  -v ~/smallweb:/home/vscode/smallweb-prod:ro \
  "$IMAGE" \
  sleep infinity

echo "[dev-workstation] container started"

# ── SSHD ──────────────────────────────────────────────────────────────────────
echo "[dev-workstation] starting SSHD in container"
docker exec "$CONTAINER_NAME" bash -c "sudo mkdir -p /run/sshd && sudo /usr/sbin/sshd"

# ── Authorized keys ──────────────────────────────────────────────────────────
# Copy the host user's authorized_keys into the container so the same SSH key
# that reaches the host can also reach the container on port 2222.
if [ -f ~/.ssh/authorized_keys ]; then
  echo "[dev-workstation] copying authorized_keys into container"
  docker exec "$CONTAINER_NAME" bash -c "mkdir -p /home/vscode/.ssh && chmod 700 /home/vscode/.ssh"
  docker cp ~/.ssh/authorized_keys "$CONTAINER_NAME:/home/vscode/.ssh/authorized_keys"
  docker exec "$CONTAINER_NAME" bash -c \
    "chown vscode:vscode /home/vscode/.ssh/authorized_keys && chmod 600 /home/vscode/.ssh/authorized_keys"
fi

IP=$(hostname -I | awk '{print $1}')
echo "[dev-workstation] ready — connect via: ssh -p 2222 vscode@${IP}"
