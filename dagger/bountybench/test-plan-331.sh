#!/usr/bin/env bash
# Compatibility wrapper for the native Dagger checks in the bounty module.

set -euo pipefail

DAGGER="${DAGGER:-./.tools/bin/dagger}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

DAGGER_NO_NAG="${DAGGER_NO_NAG:-1}" "$DAGGER" check -m ./dagger/bountybench/bounty "$@"
