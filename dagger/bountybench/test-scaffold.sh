#!/usr/bin/env bash
# PLAN-330 scaffold smoke test — run from repo root.
#
# Verifies:
#   1. `dagger call hello` returns a string for each of foundation / system / bounty
#   2. `bounty.hello-chain` calls through system -> foundation, proving the
#      dependency graph is wired (bounty depends on system, system depends on
#      foundation).
#
# RGR: this script must fail before scaffold exists (red), pass after (green).

set -euo pipefail

DAGGER="${DAGGER:-./.tools/bin/dagger}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

assert_contains() {
  local haystack="$1" needle="$2" label="$3"
  if ! grep -q "$needle" <<< "$haystack"; then
    echo "FAIL: $label — expected output to contain '$needle', got:"
    echo "$haystack"
    exit 1
  fi
  echo "PASS: $label"
}

echo "=== foundation hello ==="
out=$("$DAGGER" call -m ./dagger/bountybench/foundation hello)
assert_contains "$out" "foundation" "foundation.hello returns foundation marker"

echo "=== system hello ==="
out=$("$DAGGER" call -m ./dagger/bountybench/system hello)
assert_contains "$out" "system" "system.hello returns system marker"

echo "=== bounty hello ==="
out=$("$DAGGER" call -m ./dagger/bountybench/bounty hello)
assert_contains "$out" "bounty" "bounty.hello returns bounty marker"

echo "=== bounty hello-chain (bounty -> system -> foundation) ==="
out=$("$DAGGER" call -m ./dagger/bountybench/bounty hello-chain)
assert_contains "$out" "foundation" "bounty.hello-chain reaches foundation through system"

echo
echo "ALL PASS — PLAN-330 scaffold smoke test green."
