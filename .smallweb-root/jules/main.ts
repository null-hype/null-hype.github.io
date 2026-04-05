const julesApiBaseUrl = "https://jules.googleapis.com/v1alpha"
const defaultSessionsFile = new URL("./sessions.jsonl", import.meta.url)

type DispatchRequest = {
  issueId: string
  issueIdentifier: string
  promptContext: string
}

type MessageRequest = {
  message: string
}

type SessionRecord = {
  createdAt: string
  issueId: string
  issueIdentifier: string
  julesSessionId: string
}

class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
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

function errorResponse(status: number, message: string): Response {
  return json({
    error: message,
    ok: false,
  }, status)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `Expected "${fieldName}" to be a non-empty string.`)
  }

  return value.trim()
}

function hasValidProxyToken(req: Request): boolean {
  const configuredToken = Deno.env.get("JULES_PROXY_TOKEN")?.trim()
  if (!configuredToken) {
    return false
  }

  const authorization = req.headers.get("Authorization")
  if (!authorization?.startsWith("Bearer ")) {
    return false
  }

  return authorization.slice("Bearer ".length).trim() === configuredToken
}

function requireAuthenticatedRequest(req: Request): Response | null {
  const remoteEmail = req.headers.get("Remote-Email")
  if (remoteEmail) {
    return null
  }

  if (hasValidProxyToken(req)) {
    return null
  }

  return errorResponse(
    401,
    Deno.env.get("JULES_PROXY_TOKEN")?.trim()
      ? "Authenticated routes require the Remote-Email header or a valid bearer token."
      : "Authenticated routes require the Remote-Email header.",
  )
}

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim()

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function getSessionsFile(): string | URL {
  return Deno.env.get("JULES_SESSIONS_FILE")?.trim() || defaultSessionsFile
}

function normalizeSessionId(sessionId: string): string {
  return sessionId.startsWith("sessions/") ? sessionId.slice("sessions/".length) : sessionId
}

function normalizeSourceId(sourceId: string): string {
  return sourceId.startsWith("sources/") ? sourceId : `sources/${sourceId}`
}

function extractSessionId(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null
  }

  if (typeof payload.name === "string" && payload.name.startsWith("sessions/")) {
    return normalizeSessionId(payload.name)
  }

  for (const key of ["julesSessionId", "sessionId", "id"] as const) {
    const value = payload[key]
    if (typeof value === "string" && value.trim() !== "") {
      return normalizeSessionId(value.trim())
    }
  }

  return null
}

async function parseJsonBody<T>(req: Request): Promise<T> {
  try {
    return await req.json() as T
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.")
  }
}

async function readSessions(): Promise<SessionRecord[]> {
  try {
    const file = await Deno.readTextFile(getSessionsFile())

    return file
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as SessionRecord)
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return []
    }

    throw error
  }
}

async function appendSession(record: SessionRecord): Promise<void> {
  await Deno.writeTextFile(
    getSessionsFile(),
    `${JSON.stringify(record)}\n`,
    { append: true, create: true },
  )
}

async function readUpstreamPayload(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return {}
  }

  const contentType = response.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    return await response.json()
  }

  const text = await response.text()
  if (text === "") {
    return {}
  }

  try {
    return JSON.parse(text)
  } catch {
    return { body: text }
  }
}

async function fetchJules(pathname: string, init: RequestInit = {}): Promise<Response> {
  const apiKey = getRequiredEnv("JULES_API_KEY")
  const headers = new Headers(init.headers)

  headers.set("X-Goog-Api-Key", apiKey)
  headers.set("Accept", "application/json")

  return await fetch(`${julesApiBaseUrl}${pathname}`, {
    ...init,
    headers,
  })
}

function getSessionIdFromPath(url: URL, suffix = ""): string | null {
  const pattern = suffix === ""
    ? /^\/api\/sessions\/([^/]+)$/
    : new RegExp(`^/api/sessions/([^/]+)/${suffix}$`)

  const match = url.pathname.match(pattern)
  if (!match) {
    return null
  }

  return normalizeSessionId(decodeURIComponent(match[1]))
}

async function handleDispatch(req: Request): Promise<Response> {
  const body = await parseJsonBody<DispatchRequest>(req)
  const promptContext = readRequiredString(body.promptContext, "promptContext")
  const issueId = readRequiredString(body.issueId, "issueId")
  const issueIdentifier = readRequiredString(body.issueIdentifier, "issueIdentifier")
  const sourceId = normalizeSourceId(getRequiredEnv("JULES_SOURCE_ID"))

  const upstream = await fetchJules("/sessions", {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      prompt: promptContext,
      sourceContext: {
        source: sourceId,
        githubRepoContext: {
          startingBranch: "master",
        },
      },
      title: issueIdentifier,
      requirePlanApproval: true,
      automationMode: "AUTO_CREATE_PR",
    }),
  })

  const payload = await readUpstreamPayload(upstream)

  if (!upstream.ok) {
    return json(payload, upstream.status)
  }

  const julesSessionId = extractSessionId(payload)
  if (!julesSessionId) {
    return errorResponse(502, "Jules created a session but the response did not include a usable session id.")
  }

  const createdAt = isRecord(payload) && typeof payload.createTime === "string"
    ? payload.createTime
    : new Date().toISOString()

  await appendSession({
    createdAt,
    issueId,
    issueIdentifier,
    julesSessionId,
  })

  return json(payload, upstream.status)
}

async function handleGetSession(sessionId: string): Promise<Response> {
  const upstream = await fetchJules(`/sessions/${encodeURIComponent(sessionId)}`)
  const payload = await readUpstreamPayload(upstream)
  return json(payload, upstream.status)
}

async function handleApproveSession(sessionId: string): Promise<Response> {
  const upstream = await fetchJules(`/sessions/${encodeURIComponent(sessionId)}:approvePlan`, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: "{}",
  })
  const payload = await readUpstreamPayload(upstream)
  return json(payload, upstream.status)
}

async function handleMessageSession(req: Request, sessionId: string): Promise<Response> {
  const body = await parseJsonBody<MessageRequest>(req)
  const message = readRequiredString(body.message, "message")

  const upstream = await fetchJules(`/sessions/${encodeURIComponent(sessionId)}:sendMessage`, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      prompt: message,
    }),
  })

  const payload = await readUpstreamPayload(upstream)
  return json(payload, upstream.status)
}

export default {
  fetch: async (req: Request) => {
    const url = new URL(req.url)

    if (url.pathname === "/healthz") {
      return json({ ok: true })
    }

    const authError = requireAuthenticatedRequest(req)
    if (authError) {
      return authError
    }

    try {
      if (url.pathname === "/api/dispatch" && req.method === "POST") {
        return await handleDispatch(req)
      }

      if (url.pathname === "/api/sessions" && req.method === "GET") {
        return json(await readSessions())
      }

      const sessionId = getSessionIdFromPath(url)
      if (sessionId && req.method === "GET") {
        return await handleGetSession(sessionId)
      }

      const approveSessionId = getSessionIdFromPath(url, "approve")
      if (approveSessionId && req.method === "POST") {
        return await handleApproveSession(approveSessionId)
      }

      const messageSessionId = getSessionIdFromPath(url, "message")
      if (messageSessionId && req.method === "POST") {
        return await handleMessageSession(req, messageSessionId)
      }
    } catch (error) {
      if (error instanceof HttpError) {
        return errorResponse(error.status, error.message)
      }

      const message = error instanceof Error ? error.message : String(error)
      return errorResponse(500, message)
    }

    return errorResponse(404, `Route not found: ${req.method} ${url.pathname}`)
  },
}
