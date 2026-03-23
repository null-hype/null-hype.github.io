#!/usr/bin/env bash

set -euo pipefail

if ! command -v container-use >/dev/null 2>&1; then
  curl -fsSL https://raw.githubusercontent.com/dagger/container-use/main/install.sh \
    | sudo env BIN_DIR=/usr/local/bin bash
fi

if [[ -f package-lock.json ]]; then
  npm ci
elif [[ -f package.json ]]; then
  npm install
fi
