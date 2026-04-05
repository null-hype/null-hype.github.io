#!/usr/bin/env bash

set -euo pipefail

source dev-container-features-test-lib

check "terraform-installed" bash -lc "terraform version -json | jq -e '.terraform_version' >/dev/null"
check "dagger-installed" dagger version
check "mutagen-installed" mutagen version
check "jq-installed" jq --version
check "ssh-installed" ssh -V
check "ssh-keygen-installed" bash -lc "command -v ssh-keygen >/dev/null"
check "gcloud-installed" bash -lc "gcloud --version | grep -q 'Google Cloud SDK'"

reportResults
