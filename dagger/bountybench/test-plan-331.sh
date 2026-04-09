#!/usr/bin/env bash
# PLAN-331 RGR test — Lunary port, end-to-end flag capture.
#
# Grows one section per RGR cycle. Each cycle must go red-green before
# the next is added. See dagger/bountybench/CONTRACT.md for the pinned
# commits, two-mode topology, and oracle exit-code mapping.

set -euo pipefail

DAGGER="${DAGGER:-./.tools/bin/dagger}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

assert_contains() {
  local haystack="$1" needle="$2" label="$3"
  if ! grep -q -- "$needle" <<< "$haystack"; then
    echo "FAIL: $label — expected output to contain '$needle', got:"
    echo "$haystack"
    exit 1
  fi
  echo "PASS: $label"
}

# ──────────────────────────────────────────────────────────────────
# Cycle 1: system.snapshot()
# Returns the pinned immutable target source: bountybench/bountytasks
# @ 1956e5fd with cy-suite/lunary submodule pre-populated at d179ff25.
# Verifies both parent files and submodule files are present.
# ──────────────────────────────────────────────────────────────────

echo "=== cycle 1: system.snapshot() entries under lunary/ ==="
out=$("$DAGGER" call -m ./dagger/bountybench/system snapshot entries --path lunary)
assert_contains "$out" "docker-compose.yml" "snapshot exposes lunary/docker-compose.yml"
assert_contains "$out" "Dockerfile" "snapshot exposes lunary/Dockerfile"
assert_contains "$out" "initdb" "snapshot exposes lunary/initdb/"
assert_contains "$out" "bounties" "snapshot exposes lunary/bounties/"

echo "=== cycle 1: submodule pinned at d179ff25 (cy-suite/lunary) ==="
out=$("$DAGGER" call -m ./dagger/bountybench/system snapshot entries --path lunary/codebase)
assert_contains "$out" "packages" "submodule checkout contains cy-suite/lunary packages dir"

echo "=== cycle 1: frozen path — verify.sh reachable inside snapshot ==="
out=$("$DAGGER" call -m ./dagger/bountybench/system snapshot \
  file --path lunary/bounties/bounty_0/verify_files/verify.sh contents)
assert_contains "$out" "verify_state.py" "verify.sh references verify_state.py"
assert_contains "$out" "Verification Passed" "verify.sh has the canonical success marker"

# ──────────────────────────────────────────────────────────────────
# Cycle 2: system.buildAppImage()
# Builds the lunary-app image from the snapshot's lunary/Dockerfile,
# with lunary/codebase as the build context. Smoke-checks that the
# resulting image has `node` on PATH (the Dockerfile is Node 18
# Bookworm) — the minimum proof the build actually produced a usable
# image, without running the full app.
# ──────────────────────────────────────────────────────────────────

echo "=== cycle 2: system.buildAppImage() produces a node image ==="
out=$("$DAGGER" call -m ./dagger/bountybench/system build-app-image \
  with-exec --args="node,--version" stdout)
assert_contains "$out" "v18" "built image runs node 18"

echo
echo "ALL PASS — PLAN-331 cycles 1–2 green."
