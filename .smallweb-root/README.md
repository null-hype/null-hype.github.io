# Smallweb Root

This workspace now includes a private `admin` app protected by Smallweb OIDC.

It also includes a private `linear-agent` app that receives signed Linear
webhooks and turns delegation events into Jules sessions.

It also includes a private `jules` app that proxies authenticated dispatch and
session requests into the Jules REST API.

It also includes public `www` and `null-hype` apps that serve the built Astro
site from the repo `dist/` directory.

Files:

- `.smallweb/config.json`: domain, OIDC issuer, and app-level allowlist
- `admin/smallweb.json`: marks the app as private while keeping `/healthz` and
  `/readyz` public
- `admin/main.ts`: ACP-first admin surface with a `/acp` endpoint and
  `smallweb run` session runner
- `admin/core.ts`: shared ACP/session orchestration, queue selection,
  persona-slot validation, downstream persona ACP client, and dry-run writeback
  logic
- `admin/README.md`: task-spec fixture format and required slot layout for
  `PLAN-394`
- `linear-agent/smallweb.json`: keeps the Linear receiver private while leaving
  `/healthz` and `/webhooks/**` public
- `linear-agent/main.ts`: Smallweb-native Linear webhook ingress with runtime
  logging, optional activity posting, and Jules dispatch
- `linear-agent/data/`: append-only runtime JSONL logs for deliveries,
  activities, notifications, and errors
- `jules/smallweb.json`: keeps the Jules app private while exposing `/healthz`
  plus `/api/**` so the handler can enforce either `Remote-Email` or a shared
  bearer token
- `jules/main.ts`: Jules dispatch proxy with JSONL session recording and
  server-to-server bearer auth support
- `jules/data/sessions.jsonl`: append-only mapping between Linear issue ids and
  Jules session ids, created on first dispatch
- `www/smallweb.json`: points the `www` app at the built Astro output in
  `../../dist`
- `null-hype/smallweb.json`: points the `null-hype` subdomain at the built Astro
  output in `../../dist`

For a real deploy, override the placeholder allowlist in
`.smallweb/config.json`:

```json
"authorizedEmails": [
  "replace-me@example.com"
]
```

The quick Mutagen deploy helper reads `ADMIN_AUTHORIZED_EMAILS` and patches the
exported bundle without committing a real operator email into git.

Additional environment needed for the Jules proxy:

```sh
export JULES_API_KEY=replace-with-your-jules-api-key
export JULES_SOURCE_ID=github/null-hype/null-hype.github.io
export JULES_PROXY_TOKEN=replace-with-shared-proxy-token
```

`JULES_PROXY_TOKEN` is optional for browser-driven use through Smallweb OIDC,
but required if another backend such as `linear-agent` needs to call
`POST /api/dispatch` directly.

Additional environment needed for the Smallweb Linear receiver:

```sh
export LINEAR_WEBHOOK_SECRET=replace-with-your-linear-webhook-secret
export LINEAR_OAUTH_ACCESS_TOKEN=replace-with-your-app-oauth-access-token
```

`LINEAR_OAUTH_ACCESS_TOKEN` is optional. Without it, the webhook app stays in
dry-run mode and records would-be activities locally instead of posting them
back into Linear.

Additional environment needed for the admin ACP spike:

```sh
export TIDELANE_SLOT_ROOT=/absolute/path/to/tidelane-slots
export LINEAR_TEST_LABEL=test
export ADMIN_LINEAR_TEAM=Planning
export ADMIN_RUNTIME_DIR=/absolute/path/to/admin-runtime
export ADMIN_WRITEBACK_MODE=dry-run
```

`admin` now exposes a minimal ACP-flavored JSON-RPC surface at `/acp` and uses
the same session lifecycle for `smallweb run admin ...`. Queue selection is
scoped to Planning issues labeled `test`.

Local smoke test shape:

```sh
npm run build
npm run smallweb:start
```

Expected behavior:

- `http://127.0.0.1:7777/healthz` with `Host: admin.tidelands.dev` returns `200`
- `http://127.0.0.1:7777/healthz` with `Host: linear-agent.tidelands.dev`
  returns `200`
- `http://127.0.0.1:7777/healthz` with `Host: jules.tidelands.dev` returns `200`
- `POST /webhooks/linear` on `Host: linear-agent.tidelands.dev` accepts signed
  Linear deliveries
- `http://127.0.0.1:7777/` with `Host: admin.tidelands.dev` redirects into OIDC
  when unauthenticated
- `POST /api/dispatch` on `Host: jules.tidelands.dev` accepts either
  `Remote-Email` or `Authorization: Bearer <JULES_PROXY_TOKEN>`
- session mappings are appended to `jules/data/sessions.jsonl`, because the
  Smallweb runtime only grants app write access under `data/`
- `http://www.localhost:7777` serves the same built Astro content as
  `dist/index.html`
- `http://null-hype.localhost:7777` serves the same built Astro content as
  `dist/index.html`

The Astro homepage is the Goose terminal client. For production builds where
the static site is served from `www` or `null-hype` but the Goose bridge remains
on the private `admin` app, build with the admin session API URL:

```sh
PUBLIC_GOOSE_SESSION_API_URL=https://admin.tidelands.dev/api/goose-sessions \
npm run build
```

For local development, Astro proxies `/api/goose-sessions` and `/acp/ws` to the
admin app on `127.0.0.1:8080`.

The quick Mutagen deploy helper sets this production session API URL by default;
override `PUBLIC_GOOSE_SESSION_API_URL` only when deploying to a different admin
host.
