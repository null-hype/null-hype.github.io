import assert from "node:assert/strict"
import os from "node:os"
import path from "node:path"
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises"

import { createAdminApp, type AdminConfig, type LinearIssue } from "./core.ts"

function taskSpec(taskType: "aging" | "exploit" | "recon", personas: string[], url: string, extra: Record<string, unknown> = {}) {
  return `## ACP Task Spec
\`\`\`json
${JSON.stringify({
    instructions: `Fixture ${taskType} task`,
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

function createPersonaAcpFetch(handlers: Record<string, {
  onPrompt?: (promptText: string) => void
  summary: string
}>) {
  const calls: Array<{ method: string; payload: Record<string, unknown>; url: string }> = []

  const fetchImpl = async (target: string | URL | Request, init?: RequestInit) => {
    const url = String(target)
    const handler = handlers[url]

    if (!handler) {
      throw new Error(`Unexpected downstream ACP URL: ${url}`)
    }

    const payload = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
    const method = String(payload.method ?? "")
    calls.push({ method, payload, url })

    if (method === "initialize") {
      return ndjsonResponse([
        {
          id: payload.id ?? 0,
          jsonrpc: "2.0",
          result: {
            agentCapabilities: {},
            agentInfo: {
              name: "persona-agent",
              version: "0.1.0",
            },
            protocolVersion: 1,
          },
        },
      ])
    }

    if (method === "session/new") {
      return ndjsonResponse([
        {
          id: payload.id ?? 1,
          jsonrpc: "2.0",
          result: {
            sessionId: `persona_${calls.length}`,
          },
        },
      ])
    }

    if (method === "session/prompt") {
      const params = payload.params as { prompt?: Array<{ text?: string }> } | undefined
      const promptText = params?.prompt?.[0]?.text ?? ""
      handler.onPrompt?.(promptText)

      return ndjsonResponse([
        {
          jsonrpc: "2.0",
          method: "session/update",
          params: {
            sessionId: "persona_session",
            update: {
              content: {
                text: handler.summary,
                type: "text",
              },
              sessionUpdate: "agent_message_chunk",
            },
          },
        },
        {
          id: payload.id ?? 2,
          jsonrpc: "2.0",
          result: {
            stopReason: "end_turn",
          },
        },
      ])
    }

    throw new Error(`Unexpected downstream ACP method: ${method}`)
  }

  return { calls, fetchImpl }
}

Deno.test("ACP initialize -> session/new -> session/prompt executes a bounded recon fixture", async () => {
  let observedPrompt = ""
  const issue = {
    description: taskSpec("recon", ["apac-slot-07"], "https://fixture.test/recon"),
    id: "issue_fixture_recon",
    identifier: "PLAN-700",
    labels: ["test"],
    priority: 2,
    stateName: "Backlog",
    stateType: "unstarted",
    title: "Fixture recon task",
    updatedAt: new Date().toISOString(),
  }
  const downstream = createPersonaAcpFetch({
    "https://apac-slot-07.persona.test/acp": {
      onPrompt(promptText) {
        observedPrompt = promptText
      },
      summary: 'Visited https://fixture.test/recon and observed title "Fixture Target".',
    },
  })
  const { app, runtimeDir, slotRoot } = await createFixtureApp([issue], {
    fetchImpl: downstream.fetchImpl,
  })
  await createSlot(slotRoot, "apac-slot-07")

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
  assert.match(observedPrompt, /Target URL: https:\/\/fixture\.test\/recon/)
  assert.match(observedPrompt, /Persona: apac-slot-07/)
  assert.deepEqual(
    downstream.calls.map((call) => call.method),
    ["initialize", "session/new", "session/prompt"],
  )
  assert.equal(promptMessages.at(-1)?.result.stopReason, "end_turn")

  const writebackLog = await readFile(path.join(runtimeDir, "writebacks.jsonl"), "utf8")
  assert.match(writebackLog, /PLAN-700/)
  assert.match(writebackLog, /Fixture Target/)
  const personaLog = await readFile(path.join(runtimeDir, "persona-sessions.jsonl"), "utf8")
  assert.match(personaLog, /apac-slot-07/)
  assert.match(personaLog, /persona_2/)
})

Deno.test("missing PROXY_URL fails before any downstream ACP session starts", async () => {
  const issue = {
    description: taskSpec("recon", ["apac-slot-08"], "https://fixture.test/recon"),
    id: "issue_fixture_bad_slot",
    identifier: "PLAN-701",
    labels: ["test"],
    priority: 1,
    stateName: "Backlog",
    stateType: "unstarted",
    title: "Fixture recon missing proxy",
    updatedAt: new Date().toISOString(),
  }
  const downstream = createPersonaAcpFetch({
    "https://apac-slot-08.persona.test/acp": {
      summary: "should not execute",
    },
  })
  const { app, runtimeDir, slotRoot } = await createFixtureApp([issue], {
    fetchImpl: downstream.fetchImpl,
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

  assert.equal(downstream.calls.length, 0)
  assert.match(agentChunks, /Fail-fast aborted PLAN-701/)
  assert.match(agentChunks, /Missing PROXY_URL/)
})

Deno.test("blocked fixture issues are skipped in favor of the next eligible task", async () => {
  const blocker = {
    description: taskSpec("aging", ["slot-blocker"], "https://fixture.test/blocker"),
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
    description: taskSpec("recon", ["slot-blocked"], "https://fixture.test/blocked", {
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
    description: taskSpec("recon", ["slot-eligible"], "https://fixture.test/eligible"),
    id: "issue_eligible",
    identifier: "PLAN-704",
    labels: ["test"],
    priority: 3,
    stateName: "Backlog",
    stateType: "unstarted",
    title: "Eligible fixture",
    updatedAt: new Date().toISOString(),
  }
  const downstream = createPersonaAcpFetch({
    "https://slot-blocker.persona.test/acp": {
      summary: 'Visited https://fixture.test/blocker and observed title "Fixture Target".',
    },
    "https://slot-blocked.persona.test/acp": {
      summary: 'Visited https://fixture.test/blocked and observed title "Fixture Target".',
    },
    "https://slot-eligible.persona.test/acp": {
      summary: 'Visited https://fixture.test/eligible and observed title "Fixture Target".',
    },
  })
  const { app, runtimeDir, slotRoot } = await createFixtureApp([blocked, blocker, eligible], {
    fetchImpl: downstream.fetchImpl,
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
  assert.deepEqual(
    downstream.calls.map((call) => call.url),
    [
      "https://slot-blocker.persona.test/acp",
      "https://slot-blocker.persona.test/acp",
      "https://slot-blocker.persona.test/acp",
    ],
  )
})

Deno.test("runCliSession reuses the same ACP session lifecycle without HTTP", async () => {
  const issue = {
    description: taskSpec("recon", ["slot-cli"], "https://fixture.test/cli"),
    id: "issue_cli",
    identifier: "PLAN-705",
    labels: ["test"],
    priority: 2,
    stateName: "Backlog",
    stateType: "unstarted",
    title: "CLI fixture",
    updatedAt: new Date().toISOString(),
  }
  const downstream = createPersonaAcpFetch({
    "https://slot-cli.persona.test/acp": {
      summary: 'Visited https://fixture.test/cli and observed title "Fixture Target".',
    },
  })
  const { app, slotRoot } = await createFixtureApp([issue], {
    fetchImpl: downstream.fetchImpl,
  })
  await createSlot(slotRoot, "slot-cli")

  const messages = await app.runCliSession(["Run the CLI fixture"])

  assert.equal(messages[0].result.protocolVersion, 1)
  assert.equal(messages.at(-1)?.result.stopReason, "end_turn")
  assert.match(JSON.stringify(messages), /PLAN-705/)
  assert.deepEqual(
    downstream.calls.map((call) => call.method),
    ["initialize", "session/new", "session/prompt"],
  )
})
