#!/usr/bin/env bash
# bootstrap.sh — idempotently prepare a fresh Smallweb origin VM.
set -euo pipefail

DOMAIN="${1:?usage: bootstrap.sh <domain>}"

export DEBIAN_FRONTEND=noninteractive
export DENO_INSTALL="$HOME/.deno"
export PATH="$HOME/.deno/bin:$HOME/.local/bin:$HOME/.smallweb/bin:$PATH"

echo "[bootstrap] installing base packages"
sudo apt-get update
sudo apt-get install -y \
  apt-transport-https \
  bash \
  bzip2 \
  ca-certificates \
  curl \
  debian-archive-keyring \
  debian-keyring \
  gnupg \
  jq \
  libgomp1 \
  openssl \
  unzip

if ! command -v deno >/dev/null 2>&1; then
  echo "[bootstrap] installing Deno"
  curl -fsSL https://deno.land/install.sh | sh
fi
deno --version

if ! command -v smallweb >/dev/null 2>&1; then
  echo "[bootstrap] installing Smallweb"
  curl -fsSL https://install.smallweb.run | sh
fi
smallweb --version

if ! command -v goose >/dev/null 2>&1; then
  echo "[bootstrap] installing Goose CLI"
  curl -fsSL https://github.com/aaif-goose/goose/releases/download/stable/download_cli.sh | CONFIGURE=false bash
fi
goose --version || true

if ! command -v caddy >/dev/null 2>&1; then
  echo "[bootstrap] installing Caddy"
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y caddy
fi
caddy version

ROOT="$HOME/tidelands"
mkdir -p "$ROOT/.smallweb-root" "$HOME/.config/tidelands" "$HOME/.cache/deno"

sudo loginctl enable-linger "$(id -un)" || true

echo "[bootstrap] prepared $ROOT for $DOMAIN"
