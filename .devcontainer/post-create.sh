#!/usr/bin/env bash

set -euo pipefail

ensure_state_dir() {
  local path="$1"
  local mode="$2"

  sudo mkdir -p "$path"
  sudo chown -R "$(id -u):$(id -g)" "$path"
  chmod "$mode" "$path"
}

ensure_state_dir "$HOME/.config/gcloud" 755
ensure_state_dir "$HOME/.mutagen" 755
ensure_state_dir "$HOME/.terraform.d" 755
ensure_state_dir "${TF_PLUGIN_CACHE_DIR:-$HOME/.terraform.d/plugin-cache}" 755
ensure_state_dir "$HOME/.ssh" 700

if ! command -v container-use >/dev/null 2>&1; then
  curl -fsSL https://raw.githubusercontent.com/dagger/container-use/main/install.sh \
    | sudo env BIN_DIR=/usr/local/bin bash
fi

install_node_dependencies() {
  local path="$1"

  if [[ -f "$path/package-lock.json" ]]; then
    npm --prefix "$path" ci
  elif [[ -f "$path/package.json" ]]; then
    npm --prefix "$path" install
  fi
}

install_node_dependencies "."
install_node_dependencies "infra"
