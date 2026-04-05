import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"

import { createApp, createSignature, isFreshTimestamp, verifySignature } from "./main.ts"

async function createTestApp(configOverrides: Record<string, unknown> = {}, services: Record<string, unknown> = {}) {
  const runtimeDir = await Deno.makeTempDir({ prefix: "linear-agent-smallweb-" })
  const webhookSecret = "test-secret"
  const config = {
    agentName: "Test Harness",
    allowedClockSkewMs: 60000,
    dryRun: true,
    graphqlEndpoint: "https://api.linear.app/graphql",
    julesProxyHost: "",
    julesProxyToken: "",
    julesProxyUrl: "",
    oauthAccessToken: "",
    runtimeDir,
    webhookSecret,
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

async function createSignedRequest(webhookSecret: string, payload: Record<string, unknown>) {
  const rawBody = new TextEncoder().encode(JSON.stringify(payload))
  const signature = await createSignature(webhookSecret, rawBody)

  return new Request("https://linear-agent.tidelands.dev/webhooks/linear", {
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

Deno.test("AgentSessionEvent created is accepted and writes dry-run activities", async () => {
  const { app, runtimeDir, webhookSecret } = await createTestApp()
  const now = Date.now()
  const payload = {
    action: "created",
    agentSession: {
      id: "session_created",
      issue: {
        id: "issue_created",
        identifier: "PLAN-101",
        title: "Spike: Deploy minimal Linear agent",
      },
    },
    appUserId: "app_user_test",
    createdAt: new Date(now).toISOString(),
    oauthClientId: "oauth_test",
    organizationId: "org_test",
    promptContext: '<issue identifier="PLAN-101"><title>Spike</title></issue>',
    type: "AgentSessionEvent",
    webhookId: "wh_test_created",
    webhookTimestamp: now,
  }

  const response = await app.fetch(await createSignedRequest(webhookSecret, payload))
  assert.equal(response.status, 200)

  const activityLog = await readFile(path.join(runtimeDir, "activities.jsonl"), "utf8")
  assert.match(activityLog, /"type":"thought"/)
  assert.match(activityLog, /"type":"response"/)
})

Deno.test("AgentSessionEvent created dispatches to Jules when configured", async () => {
  const fetchCalls: Array<{ init?: RequestInit; url: string | URL | Request }> = []
  const { app, runtimeDir, webhookSecret } = await createTestApp(
    {
      julesProxyHost: "jules.tidelands.dev",
      julesProxyToken: "proxy-token",
      julesProxyUrl: "https://jules.tidelands.dev",
    },
    {
      fetchImpl: async (url: string | URL | Request, init?: RequestInit) => {
        fetchCalls.push({ init, url })
        return new Response(
          JSON.stringify({
            name: "sessions/session-live",
          }),
          {
            headers: {
              "content-type": "application/json",
            },
            status: 200,
          },
        )
      },
    },
  )
  const now = Date.now()
  const payload = {
    action: "created",
    agentSession: {
      id: "session_created",
      issue: {
        description: "Issue body markdown",
        id: "issue_created",
        identifier: "PLAN-234",
        title: "Wire Jules dispatch",
      },
    },
    appUserId: "app_user_test",
    createdAt: new Date(now).toISOString(),
    oauthClientId: "oauth_test",
    organizationId: "org_test",
    promptContext: '<issue identifier="PLAN-234"><title>Wire Jules</title></issue>',
    type: "AgentSessionEvent",
    webhookId: "wh_test_dispatch",
    webhookTimestamp: now,
  }

  const response = await app.fetch(await createSignedRequest(webhookSecret, payload))
  assert.equal(response.status, 200)

  assert.equal(fetchCalls.length, 1)
  assert.equal(String(fetchCalls[0].url), "https://jules.tidelands.dev/api/dispatch")

  const headers = new Headers(fetchCalls[0].init?.headers)
  assert.equal(fetchCalls[0].init?.method, "POST")
  assert.equal(headers.get("host"), "jules.tidelands.dev")
  assert.equal(headers.get("authorization"), "Bearer proxy-token")
  assert.deepEqual(JSON.parse(String(fetchCalls[0].init?.body)), {
    issueId: "issue_created",
    issueIdentifier: "PLAN-234",
    promptContext: '<issue identifier="PLAN-234"><title>Wire Jules</title></issue>',
  })

  const activityLog = await readFile(path.join(runtimeDir, "activities.jsonl"), "utf8")
  assert.match(activityLog, /"type":"thought"/)
  assert.match(activityLog, /"type":"response"/)
})

Deno.test("AppUserNotification contributes to the matrix summary", async () => {
  const { app, webhookSecret } = await createTestApp()
  const now = Date.now()
  const payload = {
    action: "issueStatusChanged",
    appUserId: "app_user_test",
    createdAt: new Date(now).toISOString(),
    notification: {
      issue: {
        id: "issue_notification",
        identifier: "PLAN-101",
        project: {
          id: "project_security_research",
          name: "Security Research",
        },
        title: "Spike: Deploy minimal Linear agent",
      },
    },
    oauthClientId: "oauth_test",
    organizationId: "org_test",
    type: "AppUserNotification",
    webhookId: "wh_test_notification",
    webhookTimestamp: now,
  }

  const response = await app.fetch(await createSignedRequest(webhookSecret, payload))
  assert.equal(response.status, 200)

  const matrixResponse = await app.fetch(new Request("https://linear-agent.tidelands.dev/matrix"))
  const matrix = await matrixResponse.json()

  assert.equal(matrix.totalNotifications, 1)
  assert.equal(matrix.actions.issueStatusChanged.count, 1)
})

Deno.test("AgentSessionEvent stop signal records only a terminal response", async () => {
  const { app, runtimeDir, webhookSecret } = await createTestApp()
  const now = Date.now()
  const payload = {
    action: "prompted",
    agentActivity: {
      body: "Stop",
      id: "activity_stop",
      signal: "stop",
      type: "prompt",
    },
    agentSession: {
      id: "session_stop",
    },
    appUserId: "app_user_test",
    createdAt: new Date(now).toISOString(),
    oauthClientId: "oauth_test",
    organizationId: "org_test",
    type: "AgentSessionEvent",
    webhookId: "wh_test_stop",
    webhookTimestamp: now,
  }

  const response = await app.fetch(await createSignedRequest(webhookSecret, payload))
  assert.equal(response.status, 200)

  const activityLog = await readFile(path.join(runtimeDir, "activities.jsonl"), "utf8")
  const entries = activityLog
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))

  assert.equal(entries.length, 1)
  assert.equal(entries[0].content.type, "response")
  assert.match(entries[0].content.body, /stop signal/i)
})

Deno.test("Jules dispatch failures are logged without failing the webhook response", async () => {
  const { app, runtimeDir, webhookSecret } = await createTestApp(
    {
      julesProxyUrl: "https://jules.tidelands.dev",
    },
    {
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: "upstream failure", ok: false }), {
          headers: {
            "content-type": "application/json",
          },
          status: 502,
        }),
    },
  )
  const now = Date.now()
  const payload = {
    action: "created",
    agentSession: {
      id: "session_created",
      issue: {
        id: "issue_created",
        identifier: "PLAN-235",
        title: "Wire Jules dispatch",
      },
    },
    appUserId: "app_user_test",
    createdAt: new Date(now).toISOString(),
    oauthClientId: "oauth_test",
    organizationId: "org_test",
    promptContext: '<issue identifier="PLAN-235"><title>Dispatch failure</title></issue>',
    type: "AgentSessionEvent",
    webhookId: "wh_test_dispatch_failure",
    webhookTimestamp: now,
  }

  const response = await app.fetch(await createSignedRequest(webhookSecret, payload))
  assert.equal(response.status, 200)

  const activityLog = await readFile(path.join(runtimeDir, "activities.jsonl"), "utf8")
  assert.match(activityLog, /"type":"thought"/)
  assert.match(activityLog, /"type":"response"/)

  const errorLog = await readFile(path.join(runtimeDir, "errors.jsonl"), "utf8")
  assert.match(errorLog, /Jules dispatch failed: 502/)
  assert.match(errorLog, /AgentSessionEvent/)
})

Deno.test("Linear activity failures are logged and do not block Jules dispatch", async () => {
  const fetchCalls: string[] = []
  const { app, runtimeDir, webhookSecret } = await createTestApp(
    {
      dryRun: false,
      julesProxyUrl: "https://jules.tidelands.dev",
      oauthAccessToken: "linear-token",
    },
    {
      fetchImpl: async (url: string | URL | Request) => {
        const target = String(url)
        fetchCalls.push(target)

        if (target === "https://api.linear.app/graphql") {
          return new Response(JSON.stringify({
            errors: [{ message: "activity rejected" }],
          }), {
            headers: {
              "content-type": "application/json",
            },
            status: 200,
          })
        }

        return new Response(JSON.stringify({
          name: "sessions/session-live",
        }), {
          headers: {
            "content-type": "application/json",
          },
          status: 200,
        })
      },
    },
  )
  const now = Date.now()
  const payload = {
    action: "created",
    agentSession: {
      id: "session_created",
      issue: {
        id: "issue_created",
        identifier: "PLAN-234",
        title: "Wire Jules dispatch",
      },
    },
    appUserId: "app_user_test",
    createdAt: new Date(now).toISOString(),
    oauthClientId: "oauth_test",
    organizationId: "org_test",
    promptContext: '<issue identifier="PLAN-234"><title>Activity failure</title></issue>',
    type: "AgentSessionEvent",
    webhookId: "wh_test_activity_failure",
    webhookTimestamp: now,
  }

  const response = await app.fetch(await createSignedRequest(webhookSecret, payload))
  assert.equal(response.status, 200)

  assert.deepEqual(fetchCalls, [
    "https://api.linear.app/graphql",
    "https://api.linear.app/graphql",
    "https://jules.tidelands.dev/api/dispatch",
  ])

  const errorLog = await readFile(path.join(runtimeDir, "errors.jsonl"), "utf8")
  assert.match(errorLog, /Linear GraphQL request failed/)
  assert.match(errorLog, /emitActivity/)
})
