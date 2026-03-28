#!/usr/bin/env bash
# bootstrap.sh — run once on a fresh GCE instance after terraform apply.
# Installs Deno, smallweb, writes domain config, creates health app.
# Idempotent: safe to re-run if a previous run was interrupted.
set -euo pipefail

DOMAIN="${1:?usage: bootstrap.sh <domain>}"

# ── Deno ───────────────────────────────────────────────────────────────────────
if ! command -v deno &>/dev/null; then
  echo "[bootstrap] installing Deno"
  curl -fsSL https://deno.land/install.sh | sh
fi
export DENO_INSTALL="$HOME/.deno"
export PATH="$DENO_INSTALL/bin:$PATH"
deno --version

# ── smallweb ───────────────────────────────────────────────────────────────────
if ! command -v smallweb &>/dev/null; then
  echo "[bootstrap] installing smallweb"
  curl -fsSL https://install.smallweb.run | sh
  export PATH="$HOME/.smallweb/bin:$PATH"
fi
smallweb --version

# ── domain config ──────────────────────────────────────────────────────────────
SMALLWEB_DIR="$HOME/smallweb"
CONFIG_DIR="$SMALLWEB_DIR/.smallweb"
mkdir -p "$CONFIG_DIR"

cat > "$CONFIG_DIR/config.json" <<CONFIG
{
  "domain": "$DOMAIN"
}
CONFIG
echo "[bootstrap] wrote $CONFIG_DIR/config.json"

# ── health app (required by smoke tests) ───────────────────────────────────────
HEALTH_DIR="$SMALLWEB_DIR/health"
mkdir -p "$HEALTH_DIR"

cat > "$HEALTH_DIR/main.ts" <<'HEALTHAPP'
export default {
  fetch(req: Request): Response {
    return new Response(
      JSON.stringify({ ok: true, host: req.headers.get("host") }),
      { headers: { "content-type": "application/json" } },
    )
  },
}
HEALTHAPP
echo "[bootstrap] wrote $HEALTH_DIR/main.ts"

# ── smallweb service ───────────────────────────────────────────────────────────
if ! systemctl --user is-active smallweb &>/dev/null 2>&1; then
  echo "[bootstrap] installing smallweb systemd service"
  smallweb service install
  systemctl --user daemon-reload
  systemctl --user enable --now smallweb
else
  echo "[bootstrap] smallweb service already running, reloading"
  systemctl --user restart smallweb
fi

echo "[bootstrap] complete — smallweb serving $DOMAIN"
