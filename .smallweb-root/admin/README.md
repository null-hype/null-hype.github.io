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

`smallweb run admin ...` exercises the same session lifecycle without going through HTTP.

For each selected persona slot, the admin conductor now acts as an ACP client:

1. `initialize`
2. `session/new`
3. `session/prompt`
4. collect downstream summary
5. write result back

## Queue fixture convention

The spike reads queue fixtures from the Planning team and only considers issues labeled `test`.

Each fixture issue body must contain an `ACP Task Spec` block:

~~~md
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
~~~

Supported `taskType` values in this spike:

- `aging`
- `recon`
- `exploit`

At most 3 personas are allowed for one task.

## Persona slot layout

`TIDELANE_SLOT_ROOT` must point at a directory containing one folder per persona slot:

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
