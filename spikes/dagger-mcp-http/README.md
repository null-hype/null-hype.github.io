# Dagger MCP Over Smallweb Spike

This spike proves that a Smallweb app can expose an addressable `/mcp` endpoint backed by a Dagger module.

The working shape is:

1. `dagger mcp --stdio` serves the module over stdio.
2. `bridge.mjs` converts that stdio MCP server into Streamable HTTP on `127.0.0.1:7790/mcp`.
3. `.smallweb-root/dagger-module/main.ts` proxies `/mcp` to the local bridge.

This is intentionally not "Dagger inside Smallweb". Smallweb is the network facade; the Dagger runtime stays outside the Smallweb sandbox.

## Files

- `bridge.mjs`: stdio-to-HTTP MCP bridge
- `probe-client.mjs`: end-to-end MCP probe using the official SDK client
- `../dagger-deno-upgrade/`: modern Dagger TypeScript module used as the backend
- `../../.smallweb-root/dagger-module/`: Smallweb app exposing `/mcp`

## Run

Start the bridge:

```sh
cd /workspaces/null-hype.github.io/spikes/dagger-mcp-http
node bridge.mjs
```

Start Smallweb:

```sh
cd /workspaces/null-hype.github.io
~/.local/bin/smallweb up --dir /workspaces/null-hype.github.io/.smallweb-root --domain smallweb.localhost --addr 127.0.0.1:7777 --log-format text
```

Probe the direct bridge:

```sh
cd /workspaces/null-hype.github.io/spikes/dagger-mcp-http
node probe-client.mjs
```

Probe through Smallweb:

```sh
cd /workspaces/null-hype.github.io/spikes/dagger-mcp-http
MCP_SERVER_URL='http://dagger-module.smallweb.localhost:7777/mcp' node probe-client.mjs
```

The probe selects `DenoUpgradeSpike_echoValue` and expects `mcp-http-ok`.

## Result

The end-to-end Smallweb route works for MCP tool calls. The bridge uses JSON-response mode for Streamable HTTP, so `GET /mcp` correctly returns `405 Method Not Allowed` instead of trying to hold an SSE stream open.
