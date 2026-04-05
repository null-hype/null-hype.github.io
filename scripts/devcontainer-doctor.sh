#!/usr/bin/env bash

set -euo pipefail

missing=0

print_ok() {
  printf '[ok] %s\n' "$1"
}

print_warn() {
  printf '[warn] %s\n' "$1"
}

print_fail() {
  printf '[missing] %s\n' "$1"
  missing=1
}

check_command() {
  local name="$1"

  if command -v "$name" >/dev/null 2>&1; then
    print_ok "command: ${name}"
  else
    print_fail "command: ${name}"
  fi
}

check_directory() {
  local path="$1"

  if [[ -d "$path" ]]; then
    print_ok "state dir: ${path}"
  else
    print_warn "state dir: ${path}"
  fi
}

if [[ -f /.dockerenv ]]; then
  print_ok "running inside a container"
else
  print_warn "not running inside a container"
fi

for command_name in node npm docker terraform dagger mutagen gcloud jq ssh ssh-keygen; do
  check_command "$command_name"
done

check_directory "$HOME/.config/gcloud"
check_directory "$HOME/.mutagen"
check_directory "$HOME/.terraform.d"
check_directory "$HOME/.ssh"

if [[ -n "${TF_PLUGIN_CACHE_DIR:-}" ]]; then
  check_directory "${TF_PLUGIN_CACHE_DIR}"
else
  print_warn "TF_PLUGIN_CACHE_DIR is unset"
fi

if [[ "${missing}" -ne 0 ]]; then
  exit 1
fi
