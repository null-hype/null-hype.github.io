type WorkerConfig = {
  port: number
  sharedToken: string
}

type WorkerServices = {
  fetchImpl?: typeof fetch
}

type WorkerSessionRecord = {
  createdAt: string
  issueId: string
  issueIdentifier: string
  lastMessage: string | null
  sessionId: string
  status: "running" | "completed" | "failed"
  summary: string
  toolCalls: Array<{
    ok: boolean
    tool: string
  }>
  updatedAt: string
}

type StartSessionPayload = {
  allowedTools?: string[]
  callbackToken?: string
  callbackUrl?: string
  issueId?: string
  issueIdentifier?: string
  mcpBearerToken?: string
  mcpServerUrl?: string
  sessionId?: string
}

type JsonRpcSuccess = {
  result?: Record<string, unknown>
}

type WorkerResultCallbackPayload = {
  sessionId: string
  status: "completed" | "failed"
  summary: string
  toolCalls: Array<{
    ok: boolean
    tool: string
  }>
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Expected "${fieldName}" to be a non-empty string.`)
  }

  return value.trim()
}

function hasValidBearer(req: Request, expectedToken: string): boolean {
  if (!expectedToken) {
    return false
  }

  const authorization = req.headers.get("authorization")
  if (!authorization?.startsWith("Bearer ")) {
    return false
  }

  return authorization.slice("Bearer ".length).trim() === expectedToken
}

async function parseJsonBody<T>(req: Request): Promise<T> {
  try {
    return await req.json() as T
  } catch {
    throw new Error("Request body must be valid JSON.")
  }
}

export function loadConfig(env = Deno.env.toObject()): WorkerConfig {
  const port = Number.parseInt(env.RESEARCH_WORKER_PORT ?? "7791", 10)

  return {
    port: Number.isFinite(port) ? port : 7791,
    sharedToken: env.RESEARCH_WORKER_SHARED_TOKEN?.trim() || env.RESEARCH_NODE_WORKER_TOKEN?.trim() || "",
  }
}

async function callMcp(
  fetchImpl: typeof fetch,
  mcpServerUrl: string,
  mcpBearerToken: string,
  sessionId: string,
  method: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await fetchImpl(mcpServerUrl, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${mcpBearerToken}`,
      "content-type": "application/json",
      "x-research-session-id": sessionId,
    },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      jsonrpc: "2.0",
      method,
      params,
    }),
  })

  const body = await response.json() as JsonRpcSuccess & { error?: { message?: string } }
  if (!response.ok) {
    throw new Error(body.error?.message || `MCP call failed with status ${response.status}.`)
  }

  if (body.error) {
    throw new Error(body.error.message || "MCP call returned an error.")
  }

  return body.result ?? {}
}

async function initializeMcp(
  fetchImpl: typeof fetch,
  mcpServerUrl: string,
  mcpBearerToken: string,
  sessionId: string,
): Promise<void> {
  await callMcp(fetchImpl, mcpServerUrl, mcpBearerToken, sessionId, "initialize", {
    capabilities: {},
    clientInfo: {
      name: "research-worker",
      version: "0.1.0",
    },
    protocolVersion: "2025-03-26",
  })

  const notificationResponse = await fetchImpl(mcpServerUrl, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${mcpBearerToken}`,
      "content-type": "application/json",
      "x-research-session-id": sessionId,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  })
  await notificationResponse.text()

  if (!notificationResponse.ok) {
    throw new Error(`MCP initialized notification failed with status ${notificationResponse.status}.`)
  }
}

function extractTargetLabel(result: Record<string, unknown>): string {
  const structuredContent = isRecord(result.structuredContent) ? result.structuredContent : null
  if (structuredContent && typeof structuredContent.targetLabel === "string") {
    return structuredContent.targetLabel
  }

  return "unknown-target"
}

async function postWorkerResult(
  fetchImpl: typeof fetch,
  callbackUrl: string,
  callbackToken: string,
  payload: WorkerResultCallbackPayload,
): Promise<void> {
  const response = await fetchImpl(callbackUrl, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${callbackToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Worker callback failed with status ${response.status}.`)
  }

  await response.text()
}

async function runSession(
  fetchImpl: typeof fetch,
  payload: StartSessionPayload,
  record: WorkerSessionRecord,
  sessions: Map<string, WorkerSessionRecord>,
): Promise<void> {
  const mcpServerUrl = readRequiredString(payload.mcpServerUrl, "mcpServerUrl")
  const mcpBearerToken = readRequiredString(payload.mcpBearerToken, "mcpBearerToken")
  const callbackUrl = readRequiredString(payload.callbackUrl, "callbackUrl")
  const callbackToken = readRequiredString(payload.callbackToken, "callbackToken")

  try {
    await initializeMcp(fetchImpl, mcpServerUrl, mcpBearerToken, record.sessionId)

    const listedTools = await callMcp(fetchImpl, mcpServerUrl, mcpBearerToken, record.sessionId, "tools/list", {})
    const tools = Array.isArray(listedTools.tools) ? listedTools.tools : []
    record.toolCalls.push({ ok: true, tool: "tools/list" })

    const availableToolNames = tools
      .filter((entry) => isRecord(entry) && typeof entry.name === "string")
      .map((entry) => String(entry.name))

    const requiredTools = payload.allowedTools ?? ["scope.get_current_target", "findings.record_note"]
    for (const tool of requiredTools) {
      if (!availableToolNames.includes(tool)) {
        throw new Error(`Expected tool "${tool}" to be exposed by the MCP surface.`)
      }
    }

    const currentTarget = await callMcp(
      fetchImpl,
      mcpServerUrl,
      mcpBearerToken,
      record.sessionId,
      "tools/call",
      {
        arguments: {},
        name: "scope.get_current_target",
      },
    )
    record.toolCalls.push({ ok: true, tool: "scope.get_current_target" })

    const targetLabel = extractTargetLabel(currentTarget)
    const note = `Worker confirmed ${record.issueIdentifier} against ${targetLabel}.`

    await callMcp(
      fetchImpl,
      mcpServerUrl,
      mcpBearerToken,
      record.sessionId,
      "tools/call",
      {
        arguments: { note },
        name: "findings.record_note",
      },
    )
    record.toolCalls.push({ ok: true, tool: "findings.record_note" })

    record.status = "completed"
    record.summary = `Recorded a scoped note for ${record.issueIdentifier} against ${targetLabel}.`
    record.updatedAt = new Date().toISOString()
    sessions.set(record.sessionId, record)

    await postWorkerResult(fetchImpl, callbackUrl, callbackToken, {
      sessionId: record.sessionId,
      status: record.status,
      summary: record.summary,
      toolCalls: record.toolCalls,
    })
  } catch (error) {
    record.status = "failed"
    record.summary = error instanceof Error ? error.message : String(error)
    record.updatedAt = new Date().toISOString()
    sessions.set(record.sessionId, record)

    try {
      await postWorkerResult(fetchImpl, callbackUrl, callbackToken, {
        sessionId: record.sessionId,
        status: record.status,
        summary: record.summary,
        toolCalls: record.toolCalls,
      })
    } catch (callbackError) {
      record.summary = `${record.summary} Callback error: ${
        callbackError instanceof Error ? callbackError.message : String(callbackError)
      }`
      record.updatedAt = new Date().toISOString()
      sessions.set(record.sessionId, record)
    }
  }
}

export function createWorkerApp(config = loadConfig(), services: WorkerServices = {}) {
  const fetchImpl = services.fetchImpl ?? fetch
  const sessions = new Map<string, WorkerSessionRecord>()

  return {
    fetch: async (req: Request): Promise<Response> => {
      const url = new URL(req.url)

      if (req.method === "GET" && url.pathname === "/healthz") {
        return json({
          ok: true,
          sharedTokenConfigured: Boolean(config.sharedToken),
        })
      }

      if (!hasValidBearer(req, config.sharedToken)) {
        return json({ error: "Bearer token required for the worker API.", ok: false }, 401)
      }

      const messageMatch = url.pathname.match(/^\/sessions\/([^/]+)\/messages$/)
      if (req.method === "POST" && messageMatch) {
        const sessionId = decodeURIComponent(messageMatch[1])
        const session = sessions.get(sessionId)

        if (!session) {
          return json({ error: "Session not found.", ok: false }, 404)
        }

        const body = await parseJsonBody<{ message?: string }>(req)
        session.lastMessage = readRequiredString(body.message, "message")
        session.updatedAt = new Date().toISOString()
        sessions.set(sessionId, session)

        return json(session)
      }

      const sessionMatch = url.pathname.match(/^\/sessions\/([^/]+)$/)
      if (req.method === "GET" && sessionMatch) {
        const sessionId = decodeURIComponent(sessionMatch[1])
        const session = sessions.get(sessionId)
        return session ? json(session) : json({ error: "Session not found.", ok: false }, 404)
      }

      if (req.method !== "POST" || url.pathname !== "/sessions") {
        return json({ error: "Not found", ok: false }, 404)
      }

      let payload: StartSessionPayload

      try {
        payload = await parseJsonBody<StartSessionPayload>(req)
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Invalid JSON.", ok: false }, 400)
      }

      try {
        const sessionId = readRequiredString(payload.sessionId, "sessionId")
        const issueId = readRequiredString(payload.issueId, "issueId")
        const issueIdentifier = readRequiredString(payload.issueIdentifier, "issueIdentifier")
        readRequiredString(payload.mcpServerUrl, "mcpServerUrl")
        readRequiredString(payload.mcpBearerToken, "mcpBearerToken")
        readRequiredString(payload.callbackUrl, "callbackUrl")
        readRequiredString(payload.callbackToken, "callbackToken")

        const record: WorkerSessionRecord = {
          createdAt: new Date().toISOString(),
          issueId,
          issueIdentifier,
          lastMessage: null,
          sessionId,
          status: "running",
          summary: "Worker session started.",
          toolCalls: [],
          updatedAt: new Date().toISOString(),
        }
        sessions.set(sessionId, record)

        queueMicrotask(() => {
          void runSession(fetchImpl, payload, record, sessions)
        })

        return json({
          sessionId: record.sessionId,
          status: "accepted",
          summary: "Worker accepted the session for background execution.",
        }, 202)
      } catch (error) {
        const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : crypto.randomUUID()
        const existing = sessions.get(sessionId)

        if (existing) {
          existing.status = "failed"
          existing.summary = error instanceof Error ? error.message : String(error)
          existing.updatedAt = new Date().toISOString()
          sessions.set(sessionId, existing)
        }

        return json({
          sessionId,
          status: "failed",
          summary: error instanceof Error ? error.message : String(error),
          toolCalls: existing?.toolCalls ?? [],
        }, 502)
      }
    },
  }
}

if (import.meta.main) {
  const config = loadConfig()

  console.log(`research-worker listening on http://127.0.0.1:${config.port}`)
  Deno.serve({
    hostname: "127.0.0.1",
    port: config.port,
  }, createWorkerApp(config).fetch)
}
