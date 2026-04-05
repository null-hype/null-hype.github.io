# Linear Agent Spike

This Node service is now a secondary harness. The production Linear webhook ingress lives in the Smallweb app at `.smallweb-root/linear-agent/`.

This folder turns the current repo into a minimal local Linear agent harness for `PLAN-101`.

## What it verifies

- A local Node webhook endpoint can receive signed Linear webhooks on `POST /webhooks/linear`.
- `AgentSessionEvent` deliveries produce `thought` and `response` agent activities.
- `AppUserNotification` deliveries are recorded and summarized so the project-member notification matrix can be filled in.
- The setup works behind a tunnel as soon as something is listening on local port `3000`.

## What it does not prove by itself

- Live Linear delivery from your workspace.
- Live `agentActivityCreate` mutations back into Linear unless `LINEAR_OAUTH_ACCESS_TOKEN` is configured.
- Whether project membership alone is enough to trigger `issueStatusChanged` and `issueNewComment`; that still requires real workspace traffic.

## Environment

Required for all webhook tests:

```bash
export LINEAR_WEBHOOK_SECRET=replace-with-your-linear-webhook-secret
```

Required for live agent responses inside Linear:

```bash
export LINEAR_OAUTH_ACCESS_TOKEN=replace-with-your-app-oauth-access-token
```

Optional:

```bash
export PORT=3000
export LINEAR_DRY_RUN=1
export JULES_PROXY_URL=https://jules.tidelands.dev
export JULES_PROXY_HOST=jules.tidelands.dev
export JULES_PROXY_TOKEN=replace-with-shared-proxy-token
```

`LINEAR_DRY_RUN=1` logs would-be activities to `.linear-agent-runtime/activities.jsonl` instead of calling the Linear GraphQL API.

## Commands

Start the local webhook server:

```bash
npm run agent:start
```

Start the Smallweb stack in a second terminal:

```bash
npm run smallweb:start
```

Run the local verification tests:

```bash
npm run agent:test
```

Send a signed mock session webhook into the running server:

```bash
npm run agent:mock-created
node linear-agent/mock-webhook.mjs prompted
node linear-agent/mock-webhook.mjs stop
node linear-agent/mock-webhook.mjs notification issueStatusChanged
node linear-agent/mock-webhook.mjs notification issueNewComment
```

## HTTP endpoints

- `GET /healthz`: runtime status and whether secret/token are configured.
- `POST /webhooks/linear`: signed Linear webhook receiver.
- `GET /matrix`: summarized `AppUserNotification` counts by action.

## Live hookup

1. Keep your existing `localtunnel` session running against port `3000`.
2. Start the Smallweb stack with `npm run smallweb:start`.
3. Start the Node webhook server with `npm run agent:start`.
4. Point the Linear app webhook URL at `<your-localtunnel-url>/webhooks/linear`.
5. Delegate a test issue to the app user.
6. Check `.linear-agent-runtime/activities.jsonl`, `.linear-agent-runtime/errors.jsonl`, and `.smallweb-root/jules/data/sessions.jsonl`.

If `LINEAR_OAUTH_ACCESS_TOKEN` is present, live activity mutations will be sent back to Linear. If not, the server stays in dry-run mode and only logs what it would have sent.

If `JULES_PROXY_URL` is present, `AgentSessionEvent` deliveries with `action="created"` are also forwarded to the Jules Smallweb proxy. `JULES_PROXY_HOST` is optional and useful for local Smallweb routing where the proxy is reached at `127.0.0.1` but needs a host header such as `jules.tidelands.dev`. If `JULES_PROXY_TOKEN` is set, it is sent as a bearer token so the proxy can accept server-to-server dispatches without relying on a browser-authenticated `Remote-Email` header.
