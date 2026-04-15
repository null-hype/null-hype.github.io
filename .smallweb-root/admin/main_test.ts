import assert from "node:assert/strict"
import os from "node:os"
import path from "node:path"
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises"

import { createRangeFixtureApp } from "../range-fixture/main.ts"
import { createTestSlotApp } from "../test-slot/main.ts"
import { createAdminApp, type AdminConfig, type LinearIssue } from "./core.ts"

function taskSpec(taskType: "aging" | "exploit" | "recon", personas: string[], url: string, extra: Record<string, unknown> = {}) {
  return `## ACP Task Spec
\`\`\`json
${JSON.stringify({
    instructions: `Fixture ${taskType} task`,
    oracle: {
      expectedSubstrings: ["Fixture Target", "reflected-search-param"],
    },
    personas,
    target: {
      expectedTitle: "Fixture Target",
      method: "GET",
      url,
    },
    taskType,
    ...extra,
  }, null, 2)}
\`\`\`
`
}

async function createSlot(
  root: string,
  slotId: string,
  overrides: {
    env?: Record<string, string>
    network?: Record<string, string>
  } = {},
) {
  const slotDir = path.join(root, slotId)
  await mkdir(path.join(slotDir, ".playwright-profile"), { recursive: true })
  const envValues = {
    ACP_URL: `https://${slotId}.persona.test/acp`,
    PROXY_URL: "https://proxy.example.test",
    TZ: "Australia/Sydney",
    ...(overrides.env ?? {}),
  }
  await writeFile(
    path.join(slotDir, ".env"),
    [
      ...Object.entries(envValues).map(([key, value]) => `${key}=${value}`),
    ].join("\n"),
  )
  const networkValues = {
    acpUrl: `https://${slotId}.persona.test/acp`,
    proxyUrl: "https://proxy.example.test",
    timeZone: "Australia/Sydney",
    ...(overrides.network ?? {}),
  }
  await writeFile(
    path.join(slotDir, "network.json"),
    JSON.stringify(networkValues, null, 2),
  )
}

function createRouterFetch(routes: Record<string, { fetch(req: Request): Response | Promise<Response> }>) {
  const fetchImpl = async (target: string | URL | Request, init?: RequestInit) => {
    const request = target instanceof Request ? target : new Request(String(target), init)
    const url = new URL(request.url)
    const app = routes[url.host]

    if (!app) {
      throw new Error(`Unexpected routed host: ${url.host}`)
    }

    return await app.fetch(request)
  }

  return fetchImpl
}

async function readNdjson(response: Response) {
  const body = await response.text()

  return body
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

async function postAcp(app: ReturnType<typeof createAdminApp>, payload: unknown) {
  const response = await app.fetch(new Request("https://admin.tidelands.dev/acp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  }))

  return readNdjson(response)
}

async function createFixtureApp(
  issues: LinearIssue[],
  options: {
    fetchImpl?: typeof fetch
    writebackMode?: AdminConfig["writebackMode"]
  } = {},
) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "admin-acp-test-"))
  const slotRoot = path.join(tempRoot, "slots")
  const runtimeDir = path.join(tempRoot, "runtime")
  await mkdir(slotRoot, { recursive: true })
  await mkdir(runtimeDir, { recursive: true })

  return {
    app: createAdminApp({
      config: {
        graphqlEndpoint: "https://api.linear.app/graphql",
        linearApiKey: "",
        protocolVersion: 1,
        queueLabel: "test",
        runtimeDir,
        slotRoot,
        teamName: "Planning",
        writebackMode: options.writebackMode ?? "dry-run",
      },
      services: {
        fetchImpl: options.fetchImpl,
        linear: {
          async listIssues() {
            return issues
          },
        },
      },
    }),
    runtimeDir,
    slotRoot,
  }
}

function ndjsonResponse(messages: unknown[]) {
  return new Response(
    `${messages.map((message) => JSON.stringify(message)).join("\n")}\n`,
    {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
      },
      status: 200,
    },
  )
}

Deno.test("ACP initialize -> session/new -> session/prompt executes a bounded recon fixture", async () => {
  const issue = {
    description: taskSpec("recon", ["apac-slot-07"], "https://range-fixture.tidelands.dev/recon"),
    id: "issue_fixture_recon",
    identifier: "PLAN-700",
    labels: ["test"],
    priority: 2,
    stateName: "Backlog",
    stateType: "unstarted",
    title: "Fixture recon task",
    updatedAt: new Date().toISOString(),
  }
  const rangeFixture = createRangeFixtureApp()
  const calls: Array<{ method: string; url: string }> = []
  const routes: Record<string, { fetch(req: Request): Response | Promise<Response> }> = {
    "range-fixture.tidelands.dev": rangeFixture,
  }
  const baseRouter = createRouterFetch(routes)
  const routedFetch = async (target: string | URL | Request, init?: RequestInit) => {
    const request = target instanceof Request ? target : new Request(String(target), init)
    calls.push({
      method: request.method,
      url: request.url,
    })

    return await baseRouter(request)
  }
  const testSlot = createTestSlotApp({
    fetchImpl: routedFetch,
  })
  routes["apac-slot-07.persona.test"] = testSlot
  const { app, runtimeDir, slotRoot } = await createFixtureApp([issue], {
    fetchImpl: routedFetch,
  })
  await createSlot(slotRoot, "apac-slot-07", {
    env: { SLOT_MODE: "test" },
    network: { mode: "test" },
  })

  const initializeMessages = await postAcp(app, {
    id: 0,
    jsonrpc: "2.0",
    method: "initialize",
    params: {
      clientCapabilities: {
        terminal: false,
      },
      protocolVersion: 1,
    },
  })
  assert.equal(initializeMessages[0].result.protocolVersion, 1)

  const newSessionMessages = await postAcp(app, {
    id: 1,
    jsonrpc: "2.0",
    method: "session/new",
    params: {
      cwd: runtimeDir,
      mcpServers: [],
    },
  })
  const sessionId = newSessionMessages[0].result.sessionId
  assert.match(sessionId, /^sess_/)

  const promptMessages = await postAcp(app, {
    id: 2,
    jsonrpc: "2.0",
    method: "session/prompt",
    params: {
      prompt: [
        {
          text: "Run the next recon fixture",
          type: "text",
        },
      ],
      sessionId,
    },
  })
  const agentChunks = promptMessages
    .filter((message) => message.method === "session/update")
    .map((message) => message.params.update)
    .filter((update) => update.sessionUpdate === "agent_message_chunk")
    .map((update) => update.content.text)
    .join("\n")

  assert.match(agentChunks, /Selected PLAN-700/)
  assert.match(agentChunks, /Fixture Target/)
  assert.match(agentChunks, /oracle PASS 2\/2/)
  assert.equal(
    calls.filter((call) => call.url === "https://apac-slot-07.persona.test/acp").length,
    3,
  )
  assert.equal(
    calls.filter((call) => call.url === "https://range-fixture.tidelands.dev/recon").length,
    1,
  )
  assert.equal(promptMessages.at(-1)?.result.stopReason, "end_turn")

  const writebackLog = await readFile(path.join(runtimeDir, "writebacks.jsonl"), "utf8")
  assert.match(writebackLog, /PLAN-700/)
  assert.match(writebackLog, /Fixture Target/)
  assert.match(writebackLog, /Slot mode: test/)
  assert.match(writebackLog, /oracle PASS 2\/2/)
  const personaLog = await readFile(path.join(runtimeDir, "persona-sessions.jsonl"), "utf8")
  assert.match(personaLog, /apac-slot-07/)
  assert.match(personaLog, /reflected-search-param/)
})

Deno.test("missing PROXY_URL fails before any downstream ACP session starts", async () => {
  const issue = {
    description: taskSpec("recon", ["apac-slot-08"], "https://range-fixture.tidelands.dev/recon"),
    id: "issue_fixture_bad_slot",
    identifier: "PLAN-701",
    labels: ["test"],
    priority: 1,
    stateName: "Backlog",
    stateType: "unstarted",
    title: "Fixture recon missing proxy",
    updatedAt: new Date().toISOString(),
  }
  const rangeFixture = createRangeFixtureApp()
  const routes: Record<string, { fetch(req: Request): Response | Promise<Response> }> = {
    "range-fixture.tidelands.dev": rangeFixture,
  }
  const routerFetch = createRouterFetch(routes)
  const testSlot = createTestSlotApp({
    fetchImpl: routerFetch,
  })
  routes["apac-slot-08.persona.test"] = testSlot
  const { app, runtimeDir, slotRoot } = await createFixtureApp([issue], {
    fetchImpl: routerFetch,
  })
  await createSlot(slotRoot, "apac-slot-08", {
    env: { PROXY_URL: "" },
    network: { proxyUrl: "" },
  })

  const newSession = await postAcp(app, {
    id: 1,
    jsonrpc: "2.0",
    method: "session/new",
    params: {
      cwd: runtimeDir,
      mcpServers: [],
    },
  })
  const sessionId = newSession[0].result.sessionId
  const promptMessages = await postAcp(app, {
    id: 2,
    jsonrpc: "2.0",
    method: "session/prompt",
    params: {
      prompt: [{ text: "Run the next task", type: "text" }],
      sessionId,
    },
  })
  const agentChunks = promptMessages
    .filter((message) => message.method === "session/update")
    .map((message) => message.params.update)
    .filter((update) => update.sessionUpdate === "agent_message_chunk")
    .map((update) => update.content.text)
    .join("\n")

  const personaLogPath = path.join(runtimeDir, "persona-sessions.jsonl")
  await assert.rejects(() => readFile(personaLogPath, "utf8"))
  assert.match(agentChunks, /Fail-fast aborted PLAN-701/)
  assert.match(agentChunks, /Missing PROXY_URL/)
})

Deno.test("test-mode slots skip proxy and timezone requirements but still run scoring", async () => {
  const issue = {
    description: taskSpec("recon", ["slot-test-mode"], "https://range-fixture.tidelands.dev/recon"),
    id: "issue_fixture_test_mode",
    identifier: "PLAN-706",
    labels: ["test"],
    priority: 1,
    stateName: "Backlog",
    stateType: "unstarted",
    title: "Fixture test mode task",
    updatedAt: new Date().toISOString(),
  }
  const rangeFixture = createRangeFixtureApp()
  const routes: Record<string, { fetch(req: Request): Response | Promise<Response> }> = {
    "range-fixture.tidelands.dev": rangeFixture,
  }
  const routedFetch = createRouterFetch(routes)
  const testSlot = createTestSlotApp({
    fetchImpl: routedFetch,
  })
  routes["slot-test-mode.persona.test"] = testSlot
  const { app, runtimeDir, slotRoot } = await createFixtureApp([issue], {
    fetchImpl: routedFetch,
  })
  await createSlot(slotRoot, "slot-test-mode", {
    env: {
      PROXY_URL: "",
      SLOT_MODE: "test",
      TZ: "",
    },
    network: {
      mode: "test",
      proxyUrl: "",
      timeZone: "",
    },
  })

  const newSession = await postAcp(app, {
    id: 1,
    jsonrpc: "2.0",
    method: "session/new",
    params: {
      cwd: runtimeDir,
      mcpServers: [],
    },
  })
  const sessionId = newSession[0].result.sessionId
  const promptMessages = await postAcp(app, {
    id: 2,
    jsonrpc: "2.0",
    method: "session/prompt",
    params: {
      prompt: [{ text: "Run the next test-mode task", type: "text" }],
      sessionId,
    },
  })
  const agentChunks = promptMessages
    .filter((message) => message.method === "session/update")
    .map((message) => message.params.update)
    .filter((update) => update.sessionUpdate === "agent_message_chunk")
    .map((update) => update.content.text)
    .join("\n")

  assert.match(agentChunks, /Selected PLAN-706/)
  assert.match(agentChunks, /oracle PASS 2\/2/)

  const writebackLog = await readFile(path.join(runtimeDir, "writebacks.jsonl"), "utf8")
  assert.match(writebackLog, /PLAN-706/)
  assert.match(writebackLog, /Slot mode: test/)
})

Deno.test("blocked fixture issues are skipped in favor of the next eligible task", async () => {
  const blocker = {
    description: taskSpec("aging", ["slot-blocker"], "https://range-fixture.tidelands.dev/recon"),
    id: "issue_blocker",
    identifier: "PLAN-702",
    labels: ["test"],
    priority: 2,
    stateName: "Backlog",
    stateType: "unstarted",
    title: "Fixture blocker",
    updatedAt: new Date().toISOString(),
  }
  const blocked = {
    description: taskSpec("recon", ["slot-blocked"], "https://range-fixture.tidelands.dev/recon", {
      blockedBy: ["PLAN-702"],
    }),
    id: "issue_blocked",
    identifier: "PLAN-703",
    labels: ["test"],
    priority: 1,
    stateName: "Backlog",
    stateType: "unstarted",
    title: "Blocked fixture",
    updatedAt: new Date().toISOString(),
  }
  const eligible = {
    description: taskSpec("recon", ["slot-eligible"], "https://range-fixture.tidelands.dev/recon"),
    id: "issue_eligible",
    identifier: "PLAN-704",
    labels: ["test"],
    priority: 3,
    stateName: "Backlog",
    stateType: "unstarted",
    title: "Eligible fixture",
    updatedAt: new Date().toISOString(),
  }
  const rangeFixture = createRangeFixtureApp()
  const routes: Record<string, { fetch(req: Request): Response | Promise<Response> }> = {
    "range-fixture.tidelands.dev": rangeFixture,
  }
  const routedFetch = createRouterFetch(routes)
  const slotBlocker = createTestSlotApp({ fetchImpl: routedFetch })
  const slotBlocked = createTestSlotApp({ fetchImpl: routedFetch })
  const slotEligible = createTestSlotApp({ fetchImpl: routedFetch })
  routes["slot-blocker.persona.test"] = slotBlocker
  routes["slot-blocked.persona.test"] = slotBlocked
  routes["slot-eligible.persona.test"] = slotEligible
  const routedCalls: string[] = []
  const fetchImpl = async (target: string | URL | Request, init?: RequestInit) => {
    const request = target instanceof Request ? target : new Request(String(target), init)
    routedCalls.push(request.url)

    return await routedFetch(request)
  }
  const { app, runtimeDir, slotRoot } = await createFixtureApp([blocked, blocker, eligible], {
    fetchImpl,
  })
  await createSlot(slotRoot, "slot-blocker")
  await createSlot(slotRoot, "slot-blocked")
  await createSlot(slotRoot, "slot-eligible")

  const session = await postAcp(app, {
    id: 1,
    jsonrpc: "2.0",
    method: "session/new",
    params: {
      cwd: runtimeDir,
      mcpServers: [],
    },
  })
  const sessionId = session[0].result.sessionId
  const promptMessages = await postAcp(app, {
    id: 2,
    jsonrpc: "2.0",
    method: "session/prompt",
    params: {
      prompt: [{ text: "Run eligible work", type: "text" }],
      sessionId,
    },
  })
  const chunks = promptMessages
    .filter((message) => message.method === "session/update")
    .map((message) => message.params.update)
    .filter((update) => update.sessionUpdate === "agent_message_chunk")
    .map((update) => update.content.text)
    .join("\n")

  assert.match(chunks, /Selected PLAN-702/)
  assert.doesNotMatch(chunks, /Selected PLAN-703/)
  assert.equal(routedCalls.filter((url) => url === "https://slot-blocker.persona.test/acp").length, 3)
  assert.equal(routedCalls.filter((url) => url === "https://slot-blocked.persona.test/acp").length, 0)
})

Deno.test("runCliSession reuses the same ACP session lifecycle without HTTP", async () => {
  const issue = {
    description: taskSpec("recon", ["slot-cli"], "https://range-fixture.tidelands.dev/recon"),
    id: "issue_cli",
    identifier: "PLAN-705",
    labels: ["test"],
    priority: 2,
    stateName: "Backlog",
    stateType: "unstarted",
    title: "CLI fixture",
    updatedAt: new Date().toISOString(),
  }
  const rangeFixture = createRangeFixtureApp()
  const routes: Record<string, { fetch(req: Request): Response | Promise<Response> }> = {
    "range-fixture.tidelands.dev": rangeFixture,
  }
  const routedFetch = createRouterFetch(routes)
  const slotCli = createTestSlotApp({ fetchImpl: routedFetch })
  routes["slot-cli.persona.test"] = slotCli
  const { app, slotRoot } = await createFixtureApp([issue], {
    fetchImpl: routedFetch,
  })
  await createSlot(slotRoot, "slot-cli")

  const messages = await app.runCliSession(["Run the CLI fixture"])

  assert.equal(messages[0].result.protocolVersion, 1)
  assert.equal(messages.at(-1)?.result.stopReason, "end_turn")
  assert.match(JSON.stringify(messages), /PLAN-705/)
  assert.match(JSON.stringify(messages), /oracle PASS 2\/2/)
})
