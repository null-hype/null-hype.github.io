# Admin ACP Spike

`admin` is now the single-conductor control plane for `PLAN-394`.

## ACP transport

The app exposes a minimal ACP-flavored JSON-RPC surface at `/acp`.

- Requests: `POST /acp` with one JSON-RPC message
- Responses: newline-delimited JSON (`application/x-ndjson`)
- Implemented methods:
  - `initialize`
  - `session/new`
  - `session/prompt`
  - `session/cancel`

`smallweb run admin ...` exercises the same session lifecycle without going
through HTTP.

For each selected persona slot, the admin conductor now acts as an ACP client:

1. `initialize`
2. `session/new`
3. attach configured default MCP servers plus any MCP servers from the parent
   session
4. `session/prompt`
5. collect downstream summary
6. write result back

## Queue fixture convention

The spike reads queue fixtures from the Planning team and only considers issues
labeled `test`.

Each fixture issue body must contain an `ACP Task Spec` block:

````md
## ACP Task Spec

```json
{
  "taskType": "recon",
  "personas": ["apac-slot-07"],
  "instructions": "Run a bounded recon pass",
  "target": {
    "url": "https://fixture.test/recon",
    "method": "GET",
    "expectedTitle": "Fixture Target"
  },
  "blockedBy": []
}
```
````

Supported `taskType` values in this spike:

- `aging`
- `recon`
- `exploit`

At most 3 personas are allowed for one task.

## Persona slot layout

`TIDELANE_SLOT_ROOT` must point at a directory containing one folder per persona
slot:

```text
<slot-root>/
  apac-slot-07/
    .env
    network.json
    .playwright-profile/
```

Fail-fast validation requires:

- `ACP_URL`
- `TZ`
- `PROXY_URL`
- `.playwright-profile/`
- `.env`
- `network.json`

Typical slot config values:

```sh
ACP_URL=https://apac-slot-07.persona.tidelands.dev/acp
TZ=Australia/Sydney
PROXY_URL=https://proxy.example.test
```

## Runtime

Environment variables:

- `TIDELANE_SLOT_ROOT`
- `LINEAR_TEST_LABEL` (default: `test`)
- `ADMIN_LINEAR_TEAM` (default: `Planning`)
- `ADMIN_RUNTIME_DIR` (default: `./data`)
- `ADMIN_WRITEBACK_MODE` (`dry-run` by default, `live` optional)
- `LINEAR_API_KEY` for live Linear reads/writebacks
- `ADMIN_DAGGER_MCP=1` to attach the local Dagger module as a default MCP server
- `ADMIN_DAGGER_COMMAND` absolute path to the `dagger` executable
- `ADMIN_DAGGER_MODULE` absolute path to the Dagger module directory
- `ADMIN_GOOSE_WS_URL` Goose ACP WebSocket upstream for the mobile bridge
  (for local `goose serve`, use `ws://127.0.0.1:7780/acp`)
- `ADMIN_GOOSE_SERVE_URL` convenience form for a Goose sidecar base URL, such as
  `http://127.0.0.1:7780`; the admin app normalizes it to `/acp` over
  WebSocket
- `ADMIN_GOOSE_COMMAND` command used by the fallback stdio bridge
  (default: `goose`)
- `ADMIN_GOOSE_ARGS` args used by the fallback stdio bridge (default: `acp`)
- `ADMIN_GOOSE_SESSION_CWD` working directory passed to the React client for
  `session/new`
- `ADMIN_GOOSE_IDLE_TIMEOUT_MS` idle timeout before a disconnected bridge
  session is cleaned up. In fallback stdio mode, this also terminates the
  spawned Goose process.
- `ADMIN_GOOSE_HOME`, `ADMIN_GOOSE_XDG_CONFIG_HOME`,
  `ADMIN_GOOSE_XDG_STATE_HOME`, and `ADMIN_GOOSE_XDG_CACHE_HOME` are passed to
  the spawned Goose process when fallback stdio mode is used. They are also
  useful when starting a local Goose sidecar from a sandboxed dev environment
  where the normal home directory is read-only.

When Dagger MCP is enabled, every admin ACP session starts with this MCP server
descriptor:

```json
{
  "name": "dagger",
  "command": "$ADMIN_DAGGER_COMMAND",
  "args": ["--silent", "mcp", "--mod", "$ADMIN_DAGGER_MODULE", "--stdio"],
  "env": []
}
```

The descriptor is also forwarded to downstream persona ACP sessions. If the ACP
client supplies another MCP server named `dagger`, the client-supplied
descriptor replaces the default one for that session.

## Goose mobile bridge

The admin app also exposes a private WebSocket bridge for browser ACP clients:

- `POST /api/goose-sessions` creates a Smallweb-side bridge session and returns
  `{ sessionId, wsUrl, cwd, status }`
- `GET /acp/ws/:sessionId` upgrades to WebSocket and proxies ACP JSON-RPC
  messages between the browser and Goose

The preferred local shape is to run Goose as a sidecar and point Smallweb at it:

```sh
HOME=/tmp/goose-home \
XDG_CONFIG_HOME=/tmp/goose-config \
XDG_STATE_HOME=/tmp/goose-state \
XDG_CACHE_HOME=/tmp/goose-cache \
goose serve --host 127.0.0.1 --port 7780
```

Then set:

```sh
ADMIN_GOOSE_WS_URL=ws://127.0.0.1:7780/acp
```

Smallweb's Deno runtime currently does not grant `Deno.Command` run permission
to the HTTP app, so the sidecar WebSocket bridge is the practical path for the
admin-hosted mobile client. The older stdio bridge remains in the code as a
fallback for runtimes that do allow spawning `goose acp`.

This bridge does not inject Dagger MCP servers. Configure Dagger as a Goose
extension in the Goose config used by the sidecar host.
For the current local proof, `/api/goose-sessions` and `/acp/ws/**` are listed
as public routes alongside `/acp`; add the QR/OIDC/share gate before exposing
the bridge on an internet-facing domain.

Example Goose extension:

```yaml
extensions:
  dagger:
    enabled: true
    name: dagger
    type: stdio
    cmd: /home/smallweb/.local/bin/dagger
    args:
      - --silent
      - mcp
      - --mod
      - /home/smallweb/tidelands/infra
      - --stdio
    timeout: 300
    env_keys: []
    envs: {}
```

The Astro homepage is the Goose terminal client. In local development, Astro
proxies `/api/goose-sessions` and `/acp/ws` to the admin app. In production,
build the static site with
`PUBLIC_GOOSE_SESSION_API_URL=https://admin.tidelands.dev/api/goose-sessions`
so the client can create bridge sessions against this app.

The server-side `.smallweb-root/admin/.env` should stay environment-specific
and is preserved by the Mutagen deploy sync. For the OpenRouter-backed Goose
terminal, the production admin env needs the OpenRouter key plus:

```sh
GOOSE_PROVIDER=openrouter
GOOSE_MODEL=google/gemini-2.5-flash
GOOSE_MAX_TOKENS=4096
ADMIN_GOOSE_ARGS=acp
ADMIN_GOOSE_SESSION_CWD=/home/smallweb/dev-state/repo
```

## Zed custom agent

Zed custom agents launch an ACP process over stdio. Use
`smallweb run admin --stdio` so the admin app reads JSON-RPC requests from stdin
and writes ACP messages to stdout.

```json
{
  "agent_servers": {
    "Tidelands Admin": {
      "type": "custom",
      "command": "/home/smallweb/.local/bin/smallweb",
      "args": [
        "--dir",
        "/home/smallweb/tidelands/.smallweb-root",
        "run",
        "admin",
        "--stdio"
      ],
      "env": {
        "ADMIN_LINEAR_TEAM": "Planning",
        "ADMIN_DAGGER_COMMAND": "/home/smallweb/.local/bin/dagger",
        "ADMIN_DAGGER_MCP": "1",
        "ADMIN_DAGGER_MODULE": "/home/smallweb/tidelands/infra",
        "ADMIN_RUNTIME_DIR": "/home/smallweb/tidelands/.smallweb-root/admin/data",
        "ADMIN_WRITEBACK_MODE": "dry-run",
        "LINEAR_TEST_LABEL": "test",
        "TIDELANE_SLOT_ROOT": "/opt/tidelands/tidelane-slots"
      }
    }
  }
}
```

Add `LINEAR_API_KEY` to `env` when the remote shell does not already provide it.
Alternatively, put it in `admin/.env` on the remote Smallweb root so it is kept
out of Zed settings.
