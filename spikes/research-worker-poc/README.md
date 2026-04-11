# Research Worker POC

This spike is the ACP/Argo stand-in for PLAN-358.

It exposes a tiny session API:

- `POST /sessions`
- `GET /sessions/:id`
- `POST /sessions/:id/messages`

The worker does not run a real model. It deterministically:

1. lists tools from the Smallweb node's `/mcp` endpoint
2. calls `scope.get_current_target`
3. calls `findings.record_note`
4. stores the completed session summary in memory

Run it locally:

```sh
npm run research:worker:start
```

By default it listens on `127.0.0.1:7791` and expects `RESEARCH_WORKER_SHARED_TOKEN`
or `RESEARCH_NODE_WORKER_TOKEN`.
