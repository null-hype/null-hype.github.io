# Smallweb Root

This workspace now includes a private `admin` app protected by Smallweb OIDC.

It also includes a private `jules` app that proxies authenticated dispatch and session requests into the Jules REST API.

It also includes public `www` and `null-hype` apps that serve the built Astro site from the repo `dist/` directory.

Files:

- `.smallweb/config.json`: domain, OIDC issuer, and app-level allowlist
- `admin/smallweb.json`: marks the app as private while keeping `/healthz` and `/readyz` public
- `admin/main.ts`: minimal admin surface that reads the `Remote-Email` header after auth
- `jules/smallweb.json`: marks the Jules proxy as private while keeping `/healthz` public
- `jules/main.ts`: Jules dispatch proxy with JSONL session recording and server-to-server bearer auth support
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
export JULES_PROXY_TOKEN=replace-with-shared-proxy-token
```

`JULES_PROXY_TOKEN` is optional for browser-driven use through Smallweb OIDC, but required if another backend such as `linear-agent` needs to call `POST /api/dispatch` directly.

Local smoke test shape:

```sh
npm run build

XDG_CACHE_HOME=/tmp/smallweb-cache \
smallweb up --dir "$(pwd)/.smallweb-root" --addr 127.0.0.1:7777
```

Expected behavior:

- `http://127.0.0.1:7777/healthz` with `Host: admin.tidelands.dev` returns `200`
- `http://127.0.0.1:7777/` with `Host: admin.tidelands.dev` redirects into OIDC when unauthenticated
- `http://www.localhost:7777` serves the same built Astro content as `dist/index.html`
- `http://null-hype.localhost:7777` serves the same built Astro content as `dist/index.html`
