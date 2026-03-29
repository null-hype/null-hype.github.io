# Smallweb Root

This workspace now includes a private `admin` app protected by Smallweb OIDC.

Files:

- `.smallweb/config.json`: domain, OIDC issuer, and app-level allowlist
- `admin/smallweb.json`: marks the app as private while keeping `/healthz` and `/readyz` public
- `admin/main.ts`: minimal admin surface that reads the `Remote-Email` header after auth

Before a real deploy, replace the placeholder allowlist in `.smallweb/config.json`:

```json
"authorizedEmails": [
  "replace-me@example.com"
]
```

Local smoke test shape:

```sh
XDG_CACHE_HOME=/tmp/smallweb-cache \
smallweb up --dir .smallweb-root --addr 127.0.0.1:7777
```

Expected behavior:

- `http://127.0.0.1:7777/healthz` with `Host: admin.tidelands.dev` returns `200`
- `http://127.0.0.1:7777/` with `Host: admin.tidelands.dev` redirects into OIDC when unauthenticated
