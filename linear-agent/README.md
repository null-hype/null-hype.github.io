# Linear Agent Spike

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
```

`LINEAR_DRY_RUN=1` logs would-be activities to `.linear-agent-runtime/activities.jsonl` instead of calling the Linear GraphQL API.

## Commands

Start the local webhook server:

```bash
npm run agent:start
```

Run the local verification tests:

```bash
npm run agent:test
```

Send a signed mock session webhook into the running server:

```bash
node linear-agent/mock-webhook.mjs created
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
2. Start the webhook server with `npm run agent:start`.
3. Point the Linear app webhook URL at `<your-localtunnel-url>/webhooks/linear`.
4. Delegate a test issue to the app user.
5. Check `.linear-agent-runtime/activities.jsonl` and `GET /matrix`.

If `LINEAR_OAUTH_ACCESS_TOKEN` is present, live activity mutations will be sent back to Linear. If not, the server stays in dry-run mode and only logs what it would have sent.
