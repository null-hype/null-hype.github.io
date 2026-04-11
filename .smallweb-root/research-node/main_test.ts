import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"

import { createApp, createSignature, isFreshTimestamp, verifySignature } from "./main.ts"
import { createWorkerApp } from "../../spikes/research-worker-poc/main.ts"

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..")

async function createTestApp(configOverrides: Record<string, unknown> = {}, services: Record<string, unknown> = {}) {
  const runtimeDir = await Deno.makeTempDir({ prefix: "research-node-smallweb-" })
  const webhookSecret = "test-webhook-secret"
  const config = {
    allowedClockSkewMs: 60000,
    allowedTools: ["scope.get_current_target", "findings.record_note"],
    appName: "research-node",
    bountybenchGitRef: "plan-329-bountybench-v0",
    daggerBin: path.join(repoRoot, ".tools", "bin", "dagger"),
    gitBin: "git",
    mcpBearerToken: "mcp-secret",
    publicBaseUrl: "http://research-node.tidelands.dev",
    repoRoot,
    runtimeDir,
    targetLabel: "lunary-calibration",
    webhookSecret,
    workerToken: "worker-secret",
    workerUrl: "http://127.0.0.1:7791",
    ...configOverrides,
  }

  return {
    app: createApp(config as any, {
      logger: {
        error() {},
      },
      ...services,
    }),
    runtimeDir,
    webhookSecret,
  }
}

async function createSignedRequest(webhookSecret: string, payload: Record<string, unknown>, url = "https://research-node.tidelands.dev/webhooks/linear") {
  const rawBody = new TextEncoder().encode(JSON.stringify(payload))
  const signature = await createSignature(webhookSecret, rawBody)

  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "linear-delivery": String(payload.webhookId),
      "linear-event": String(payload.type),
      "linear-signature": signature,
    },
    body: rawBody,
  })
}

function createCreatedWebhook(now = Date.now()) {
  return {
    action: "created",
    agentSession: {
      id: "session_research",
      issue: {
        id: "issue_research",
        identifier: "PLAN-358",
      },
    },
    createdAt: new Date(now).toISOString(),
    type: "AgentSessionEvent",
    webhookId: "wh_research",
    webhookTimestamp: now,
  }
}

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

async function resolveBountyBenchGitRef(): Promise<string> {
  for (const ref of ["plan-329-bountybench-v0", "origin/plan-329-bountybench-v0"]) {
    const output = await new Deno.Command("git", {
      args: ["ls-tree", "-r", "--name-only", ref],
      cwd: repoRoot,
      stderr: "null",
      stdout: "piped",
    }).output()

    if (output.code !== 0) {
      continue
    }

    const files = new TextDecoder().decode(output.stdout)
    if (files.includes("dagger/bountybench/")) {
      return ref
    }
  }

  throw new Error("Could not resolve a git ref containing dagger/bountybench.")
}

Deno.test("verifySignature accepts exact raw body signatures", async () => {
  const rawBody = new TextEncoder().encode('{"hello":"world"}')
  const secret = "test-secret"
  const signature = await createSignature(secret, rawBody)

  assert.equal(await verifySignature(secret, signature, rawBody), true)
  assert.equal(await verifySignature(secret, "bad-signature", rawBody), false)
})

Deno.test("isFreshTimestamp rejects stale deliveries", () => {
  const now = Date.now()

  assert.equal(isFreshTimestamp(now, now, 60000), true)
  assert.equal(isFreshTimestamp(now - 61000, now, 60000), false)
})

Deno.test("webhook starts a worker session and writes session records", async () => {
  const fetchCalls: Array<{ init?: RequestInit; url: string | URL | Request }> = []
  const { app, runtimeDir, webhookSecret } = await createTestApp(
    {},
    {
      fetchImpl: async (url: string | URL | Request, init?: RequestInit) => {
        fetchCalls.push({ init, url })
        return new Response(JSON.stringify({
          sessionId: "session_research",
          status: "accepted",
          summary: "worker accepted",
        }), {
          headers: { "content-type": "application/json" },
          status: 202,
        })
      },
    },
  )

  const response = await app.fetch(await createSignedRequest(webhookSecret, createCreatedWebhook()))
  assert.equal(response.status, 202)
  const responseBody = await response.json()
  assert.equal(responseBody.status, "accepted")
  assert.equal(fetchCalls.length, 1)
  assert.equal(String(fetchCalls[0].url), "http://127.0.0.1:7791/sessions")
  assert.deepEqual(JSON.parse(String(fetchCalls[0].init?.body)), {
    allowedTools: ["scope.get_current_target", "findings.record_note"],
    callbackToken: "worker-secret",
    callbackUrl: "https://research-node.tidelands.dev/worker-results",
    issueId: "issue_research",
    issueIdentifier: "PLAN-358",
    mcpBearerToken: "mcp-secret",
    mcpServerUrl: "https://research-node.tidelands.dev/mcp",
    sessionId: "session_research",
  })

  const sessionsLog = await readFile(path.join(runtimeDir, "sessions.jsonl"), "utf8")
  assert.match(sessionsLog, /"event":"session-created"/)
  assert.doesNotMatch(sessionsLog, /"event":"worker-finished"/)
})

Deno.test("mcp requires bearer auth", async () => {
  const { app } = await createTestApp()
  const response = await app.fetch(new Request("https://research-node.tidelands.dev/mcp", {
    body: JSON.stringify({
      id: "1",
      jsonrpc: "2.0",
      method: "tools/list",
    }),
    method: "POST",
  }))

  assert.equal(response.status, 401)
})

Deno.test("mcp initialize negotiates a supported protocol version", async () => {
  const { app } = await createTestApp()
  const response = await app.fetch(new Request("https://research-node.tidelands.dev/mcp", {
    body: JSON.stringify({
      id: "initialize-1",
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        capabilities: {},
        clientInfo: {
          name: "test-client",
          version: "1.0.0",
        },
        protocolVersion: "2025-03-26",
      },
    }),
    headers: {
      "authorization": "Bearer mcp-secret",
      "content-type": "application/json",
    },
    method: "POST",
  }))

  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.result.protocolVersion, "2025-03-26")
  assert.equal(payload.result.serverInfo.name, "research-node")
  assert.deepEqual(payload.result.capabilities, {
    tools: {
      listChanged: false,
    },
  })
})

Deno.test("mcp initialized notification is accepted without a JSON response body", async () => {
  const { app } = await createTestApp()
  const response = await app.fetch(new Request("https://research-node.tidelands.dev/mcp", {
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
    headers: {
      "authorization": "Bearer mcp-secret",
      "content-type": "application/json",
    },
    method: "POST",
  }))

  assert.equal(response.status, 202)
  assert.equal(await response.text(), "")
})

Deno.test("mcp only lists allowed tools and forbids direct disallowed calls", async () => {
  const { app } = await createTestApp()
  const headers = {
    "authorization": "Bearer mcp-secret",
    "content-type": "application/json",
  }

  const listResponse = await app.fetch(new Request("https://research-node.tidelands.dev/mcp", {
    body: JSON.stringify({
      id: "1",
      jsonrpc: "2.0",
      method: "tools/list",
    }),
    headers,
    method: "POST",
  }))
  assert.equal(listResponse.status, 200)

  const listPayload = await listResponse.json()
  assert.equal(listPayload.result.tools.length, 2)
  assert.deepEqual(listPayload.result.tools.map((tool: { name: string }) => tool.name), [
    "scope.get_current_target",
    "findings.record_note",
  ])

  const forbiddenResponse = await app.fetch(new Request("https://research-node.tidelands.dev/mcp", {
    body: JSON.stringify({
      id: "2",
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: {},
        name: "ops.shell",
      },
    }),
    headers,
    method: "POST",
  }))
  assert.equal(forbiddenResponse.status, 403)
})

Deno.test("mcp can recover session context from persisted session records", async () => {
  const { app, runtimeDir } = await createTestApp()
  await Deno.writeTextFile(path.join(runtimeDir, "sessions.jsonl"), `${JSON.stringify({
    createdAt: new Date().toISOString(),
    event: "session-created",
    issueId: "issue_research",
    issueIdentifier: "PLAN-358",
    sessionId: "session_research",
    source: "webhook",
    status: "pending",
    targetLabel: "lunary-calibration",
  })}\n`)

  const response = await app.fetch(new Request("https://research-node.tidelands.dev/mcp", {
    body: JSON.stringify({
      id: "scope-1",
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: {},
        name: "scope.get_current_target",
      },
    }),
    headers: {
      "authorization": "Bearer mcp-secret",
      "content-type": "application/json",
      "x-research-session-id": "session_research",
    },
    method: "POST",
  }))

  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.result.structuredContent.issueIdentifier, "PLAN-358")
  assert.equal(payload.result.structuredContent.targetLabel, "lunary-calibration")
})

Deno.test("mcp can proxy target.start_service through the injected BountyBench bridge", async () => {
  const { app } = await createTestApp(
    {
      allowedTools: ["target.start_service", "target.reset"],
    },
    {
      runBountyBenchTool: async ({ tool }: { tool: string }) => ({
        endpoint: tool === "target.reset" ? "lunary-app:3334" : "lunary-app:3333",
        gitRef: "plan-329-bountybench-v0",
        mode: "baseline",
        operation: tool === "target.reset" ? "reset" : "start_service",
      }),
    },
  )

  const response = await app.fetch(new Request("https://research-node.tidelands.dev/mcp", {
    body: JSON.stringify({
      id: "target-1",
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: { mode: "baseline" },
        name: "target.start_service",
      },
    }),
    headers: {
      "authorization": "Bearer mcp-secret",
      "content-type": "application/json",
    },
    method: "POST",
  }))

  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.result.structuredContent.endpoint, "lunary-app:3333")
  assert.equal(payload.result.structuredContent.operation, "start_service")
  assert.equal(payload.result.structuredContent.gitRef, "plan-329-bountybench-v0")
})

Deno.test("webhook worker integration completes the callback loop against /mcp", async () => {
  const runtimeDir = await Deno.makeTempDir({ prefix: "research-node-loop-" })
  const workerToken = "worker-loop-secret"
  const mcpToken = "mcp-loop-secret"
  const webhookSecret = "webhook-loop-secret"

  const workerPort = getAvailablePort()
  const workerAbort = new AbortController()
  const workerApp = createWorkerApp({
    port: workerPort,
    sharedToken: workerToken,
  })
  const workerServer = Deno.serve({
    hostname: "127.0.0.1",
    onListen() {},
    port: workerPort,
    signal: workerAbort.signal,
  }, workerApp.fetch)

  const appConfig = {
    allowedClockSkewMs: 60000,
    allowedTools: ["scope.get_current_target", "findings.record_note"],
    appName: "research-node",
    bountybenchGitRef: "plan-329-bountybench-v0",
    daggerBin: path.join(repoRoot, ".tools", "bin", "dagger"),
    gitBin: "git",
    mcpBearerToken: mcpToken,
    publicBaseUrl: "http://127.0.0.1",
    repoRoot,
    runtimeDir,
    targetLabel: "lunary-calibration",
    webhookSecret,
    workerToken,
    workerUrl: `http://127.0.0.1:${workerPort}`,
  }
  const app = createApp(appConfig)
  const appPort = getAvailablePort()
  const appAbort = new AbortController()
  const appServer = Deno.serve({
    hostname: "127.0.0.1",
    onListen() {},
    port: appPort,
    signal: appAbort.signal,
  }, app.fetch)

  try {
    const payload = createCreatedWebhook()
    const response = await fetch(`http://127.0.0.1:${appPort}/webhooks/linear`, {
      method: "POST",
      headers: new Headers((await createSignedRequest(webhookSecret, payload, `http://127.0.0.1:${appPort}/webhooks/linear`)).headers),
      body: JSON.stringify(payload),
    })

    assert.equal(response.status, 202)
    const body = await response.json()
    assert.equal(body.ok, true)
    assert.equal(body.status, "accepted")

    await waitFor(async () => {
      const workerEvents = await readFile(path.join(runtimeDir, "worker-events.jsonl"), "utf8")
      assert.match(workerEvents, /"type":"worker-result"/)
      assert.match(workerEvents, /"tool":"scope.get_current_target"/)
      assert.match(workerEvents, /"type":"finding-note"/)
      assert.match(workerEvents, /"summary":"Recorded a scoped note for PLAN-358 against lunary-calibration\."/)
    })
  } finally {
    workerAbort.abort()
    appAbort.abort()
    await Promise.allSettled([workerServer.finished, appServer.finished])
  }
})

Deno.test("webhook worker integration can invoke target.start_service against real Dagger", async () => {
  const runtimeDir = await Deno.makeTempDir({ prefix: "research-node-dagger-loop-" })
  const workerToken = "worker-loop-secret"
  const mcpToken = "mcp-loop-secret"
  const webhookSecret = "webhook-loop-secret"
  const bountybenchGitRef = await resolveBountyBenchGitRef()

  const workerPort = getAvailablePort()
  const workerAbort = new AbortController()
  const workerApp = createWorkerApp({
    port: workerPort,
    sharedToken: workerToken,
  })
  const workerServer = Deno.serve({
    hostname: "127.0.0.1",
    onListen() {},
    port: workerPort,
    signal: workerAbort.signal,
  }, workerApp.fetch)

  const appConfig = {
    allowedClockSkewMs: 60000,
    allowedTools: ["scope.get_current_target", "target.start_service", "findings.record_note"],
    appName: "research-node",
    bountybenchGitRef,
    daggerBin: path.join(repoRoot, ".tools", "bin", "dagger"),
    gitBin: "git",
    mcpBearerToken: mcpToken,
    publicBaseUrl: "http://127.0.0.1",
    repoRoot,
    runtimeDir,
    targetLabel: "lunary-calibration",
    webhookSecret,
    workerToken,
    workerUrl: `http://127.0.0.1:${workerPort}`,
  }
  const app = createApp(appConfig)
  const appPort = getAvailablePort()
  const appAbort = new AbortController()
  const appServer = Deno.serve({
    hostname: "127.0.0.1",
    onListen() {},
    port: appPort,
    signal: appAbort.signal,
  }, app.fetch)

  try {
    const payload = createCreatedWebhook()
    const response = await fetch(`http://127.0.0.1:${appPort}/webhooks/linear`, {
      method: "POST",
      headers: new Headers((await createSignedRequest(webhookSecret, payload, `http://127.0.0.1:${appPort}/webhooks/linear`)).headers),
      body: JSON.stringify(payload),
    })

    assert.equal(response.status, 202)
    const body = await response.json()
    assert.equal(body.ok, true)
    assert.equal(body.status, "accepted")

    await waitFor(async () => {
      const workerEvents = await readFile(path.join(runtimeDir, "worker-events.jsonl"), "utf8")
      assert.match(workerEvents, /"tool":"target.start_service"/)
      assert.match(workerEvents, /"summary":"Recorded a scoped note for PLAN-358 against lunary-calibration via lunary-app:3333\."/)
    }, 300000, 1000)
  } finally {
    workerAbort.abort()
    appAbort.abort()
    await Promise.allSettled([workerServer.finished, appServer.finished])
  }
})

Deno.test("worker failures are logged without crashing the webhook handler", async () => {
  const { app, runtimeDir, webhookSecret } = await createTestApp(
    {},
    {
      fetchImpl: async () => new Response(JSON.stringify({ error: "worker down" }), {
        headers: { "content-type": "application/json" },
        status: 503,
      }),
    },
  )

  const response = await app.fetch(await createSignedRequest(webhookSecret, createCreatedWebhook()))
  assert.equal(response.status, 202)

  const errorsLog = await readFile(path.join(runtimeDir, "errors.jsonl"), "utf8")
  assert.match(errorsLog, /Worker start failed/)
})
