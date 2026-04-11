import assert from "node:assert/strict"

import { createWorkerApp } from "./main.ts"

function getAvailablePort(): number {
  const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 })
  const port = (listener.addr as Deno.NetAddr).port
  listener.close()
  return port
}

async function waitFor(check: () => Promise<void>, timeoutMs = 2000, intervalMs = 25): Promise<void> {
  const startedAt = Date.now()
  let lastError: unknown = null

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await check()
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Timed out waiting for condition.")
}

Deno.test("worker requires bearer auth", async () => {
  const app = createWorkerApp({
    port: 7791,
    sharedToken: "worker-secret",
  })

  const response = await app.fetch(new Request("http://worker.local/sessions", {
    body: JSON.stringify({}),
    method: "POST",
  }))

  assert.equal(response.status, 401)
})

Deno.test("worker session start calls back to mcp and stores the completed session", async () => {
  const calls: string[] = []
  const mcpPort = getAvailablePort()
  const callbackPort = getAvailablePort()
  const abortController = new AbortController()
  const callbackAbort = new AbortController()
  const callbackPayloads: Array<{ sessionId: string; status: string; summary: string }> = []

  const mcpServer = Deno.serve({
    hostname: "127.0.0.1",
    onListen() {},
    port: mcpPort,
    signal: abortController.signal,
  }, async (req: Request) => {
    const payload = await req.json() as { method: string; params?: { name?: string; arguments?: { note?: string } } }
    calls.push(payload.method === "tools/call" ? String(payload.params?.name) : payload.method)

    if (payload.method === "initialize") {
      return new Response(JSON.stringify({
        id: "0",
        jsonrpc: "2.0",
        result: {
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
          protocolVersion: "2025-03-26",
          serverInfo: {
            name: "research-node",
            version: "0.1.0",
          },
        },
      }), {
        headers: { "content-type": "application/json" },
      })
    }

    if (payload.method === "notifications/initialized") {
      return new Response(null, { status: 202 })
    }

    if (payload.method === "tools/list") {
      return new Response(JSON.stringify({
        id: "1",
        jsonrpc: "2.0",
        result: {
          tools: [
            { name: "scope.get_current_target" },
            { name: "findings.record_note" },
          ],
        },
      }), {
        headers: { "content-type": "application/json" },
      })
    }

    if (payload.params?.name === "scope.get_current_target") {
      return new Response(JSON.stringify({
        id: "2",
        jsonrpc: "2.0",
        result: {
          structuredContent: {
            issueIdentifier: "PLAN-358",
            targetLabel: "lunary-calibration",
          },
        },
      }), {
        headers: { "content-type": "application/json" },
      })
    }

    if (payload.params?.name === "findings.record_note") {
      return new Response(JSON.stringify({
        id: "3",
        jsonrpc: "2.0",
        result: {
          structuredContent: {
            ok: true,
            note: payload.params.arguments?.note ?? null,
          },
        },
      }), {
        headers: { "content-type": "application/json" },
      })
    }

    return new Response(JSON.stringify({
      error: { message: "unsupported" },
      id: "4",
      jsonrpc: "2.0",
    }), {
      headers: { "content-type": "application/json" },
      status: 400,
    })
  })

  const callbackServer = Deno.serve({
    hostname: "127.0.0.1",
    onListen() {},
    port: callbackPort,
    signal: callbackAbort.signal,
  }, async (req: Request) => {
    callbackPayloads.push(await req.json())
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
      status: 202,
    })
  })

  try {
    const app = createWorkerApp({
      port: 7791,
      sharedToken: "worker-secret",
    })

    const response = await app.fetch(new Request("http://worker.local/sessions", {
      body: JSON.stringify({
        allowedTools: ["scope.get_current_target", "findings.record_note"],
        callbackToken: "callback-secret",
        callbackUrl: `http://127.0.0.1:${callbackPort}/worker-results`,
        issueId: "issue_research",
        issueIdentifier: "PLAN-358",
        mcpBearerToken: "mcp-secret",
        mcpServerUrl: `http://127.0.0.1:${mcpPort}/mcp`,
        sessionId: "session_research",
      }),
      headers: {
        "authorization": "Bearer worker-secret",
        "content-type": "application/json",
      },
      method: "POST",
    }))

    assert.equal(response.status, 202)
    const body = await response.json()
    assert.equal(body.status, "accepted")

    await waitFor(async () => {
      assert.deepEqual(calls, [
        "initialize",
        "notifications/initialized",
        "tools/list",
        "scope.get_current_target",
        "findings.record_note",
      ])
    })

    await waitFor(async () => {
      const sessionResponse = await app.fetch(new Request("http://worker.local/sessions/session_research", {
        headers: {
          "authorization": "Bearer worker-secret",
        },
        method: "GET",
      }))
      assert.equal(sessionResponse.status, 200)
      const session = await sessionResponse.json()
      assert.equal(session.status, "completed")
      assert.match(session.summary, /Recorded a scoped note/)
    })

    assert.equal(callbackPayloads.length, 1)
    assert.equal(callbackPayloads[0].status, "completed")
    assert.equal(callbackPayloads[0].sessionId, "session_research")

    const messageResponse = await app.fetch(new Request("http://worker.local/sessions/session_research/messages", {
      body: JSON.stringify({ message: "hello from operator" }),
      headers: {
        "authorization": "Bearer worker-secret",
        "content-type": "application/json",
      },
      method: "POST",
    }))
    assert.equal(messageResponse.status, 200)
    const updated = await messageResponse.json()
    assert.equal(updated.lastMessage, "hello from operator")
  } finally {
    abortController.abort()
    callbackAbort.abort()
    await Promise.allSettled([mcpServer.finished, callbackServer.finished])
  }
})
