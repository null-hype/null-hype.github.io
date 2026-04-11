# Research Worker POC

This spike is the ACP/Argo stand-in for PLAN-358.

It exposes a tiny session API:

- `POST /sessions`
- `GET /sessions/:id`
- `POST /sessions/:id/messages`

The worker does not run a real model. It deterministically:

1. handshakes with the Smallweb node's `/mcp` endpoint
2. lists tools from `/mcp`
3. calls the configured MCP tools in order
4. defaults to `scope.get_current_target` then `findings.record_note`
5. can insert BountyBench tools like `target.start_service` between those steps
6. posts the final result to the node's worker callback endpoint
7. stores the completed session summary in memory

Run it locally:

```sh
npm run research:worker:start
```

By default it listens on `127.0.0.1:7791` and expects `RESEARCH_WORKER_SHARED_TOKEN`
or `RESEARCH_NODE_WORKER_TOKEN`.
