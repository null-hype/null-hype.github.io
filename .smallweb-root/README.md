# Smallweb Root

This workspace now includes a private `admin` app protected by Smallweb OIDC.

It also includes a private `linear-agent` app that receives signed Linear webhooks and turns delegation events into Jules sessions.

It also includes a private `jules` app that proxies authenticated dispatch and session requests into the Jules REST API.

It also includes a private `research-node` app that acts as the PLAN-358 Smallweb specimen: signed Linear webhook ingress, a bearer-protected `/mcp` surface for a separate worker service, and a bearer-protected worker callback route for async result delivery.

It also includes public `www` and `null-hype` apps that serve the built Astro site from the repo `dist/` directory.

Files:

- `.smallweb/config.json`: domain, OIDC issuer, and app-level allowlist
- `admin/smallweb.json`: marks the app as private while keeping `/healthz` and `/readyz` public
- `admin/main.ts`: minimal admin surface that reads the `Remote-Email` header after auth
- `linear-agent/smallweb.json`: keeps the Linear receiver private while leaving `/healthz` and `/webhooks/**` public
- `linear-agent/main.ts`: Smallweb-native Linear webhook ingress with runtime logging, optional activity posting, and Jules dispatch
- `linear-agent/data/`: append-only runtime JSONL logs for deliveries, activities, notifications, and errors
- `jules/smallweb.json`: keeps the Jules app private while exposing `/healthz` plus `/api/**` so the handler can enforce either `Remote-Email` or a shared bearer token
- `jules/main.ts`: Jules dispatch proxy with JSONL session recording and server-to-server bearer auth support
- `jules/data/sessions.jsonl`: append-only mapping between Linear issue ids and Jules session ids, created on first dispatch
- `research-node/smallweb.json`: keeps the research node private while leaving `/healthz`, `/webhooks/**`, `/mcp`, and `/worker-results` public
- `research-node/main.ts`: Smallweb-native worker-session manager with signed webhook ingress, JSON-RPC-style `/mcp`, async worker dispatch, worker-result callback handling, and append-only session logs
- `research-node/data/`: append-only JSONL logs for sessions, worker events, MCP requests, and errors
- `www/smallweb.json`: points the `www` app at the built Astro output in `../../dist`
- `null-hype/smallweb.json`: points the `null-hype` subdomain at the built Astro output in `../../dist`

For a real deploy, override the placeholder allowlist in `.smallweb/config.json`:

```json
"authorizedEmails": [
  "replace-me@example.com"
]
```

The quick Mutagen deploy helper reads `ADMIN_AUTHORIZED_EMAILS` and patches the exported bundle without committing a real operator email into git.

Additional environment needed for the Jules proxy:

```sh
export JULES_API_KEY=replace-with-your-jules-api-key
export JULES_SOURCE_ID=github/null-hype/null-hype.github.io
export JULES_STARTING_BRANCH=master
```

`JULES_PROXY_TOKEN` is optional. If omitted, the local start script and deploy bundle generate a random shared token for the internal `linear-agent` to `jules` call path. For browser-driven use through Smallweb OIDC, no bearer token is needed.

`JULES_SOURCE_ID` controls which repo Jules opens PRs against. `JULES_STARTING_BRANCH` controls the base branch for created sessions.

Additional environment needed for the Smallweb Linear receiver:

```sh
export LINEAR_WEBHOOK_SECRET=replace-with-your-linear-webhook-secret
export LINEAR_OAUTH_ACCESS_TOKEN=replace-with-your-app-oauth-access-token
```

`LINEAR_OAUTH_ACCESS_TOKEN` is optional. Without it, the webhook app stays in dry-run mode and records would-be activities locally instead of posting them back into Linear.

Local smoke test shape:

```sh
npm run build
npm run smallweb:start
```

Expected behavior:

- `http://127.0.0.1:7777/healthz` with `Host: admin.tidelands.dev` returns `200`
- `http://127.0.0.1:7777/healthz` with `Host: linear-agent.tidelands.dev` returns `200`
- `http://127.0.0.1:7777/healthz` with `Host: jules.tidelands.dev` returns `200`
- `POST /webhooks/linear` on `Host: linear-agent.tidelands.dev` accepts signed Linear deliveries
- `http://127.0.0.1:7777/` with `Host: admin.tidelands.dev` redirects into OIDC when unauthenticated
- `POST /api/dispatch` on `Host: jules.tidelands.dev` accepts either `Remote-Email` or `Authorization: Bearer <JULES_PROXY_TOKEN>`
- session mappings are appended to `jules/data/sessions.jsonl`, because the Smallweb runtime only grants app write access under `data/`
- `http://www.localhost:7777` serves the same built Astro content as `dist/index.html`
- `http://null-hype.localhost:7777` serves the same built Astro content as `dist/index.html`
