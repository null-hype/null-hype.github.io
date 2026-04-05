const encoder = new TextEncoder()
const decoder = new TextDecoder()

const AGENT_ACTIVITY_CREATE_MUTATION = `
  mutation AgentActivityCreate($input: AgentActivityCreateInput!) {
    agentActivityCreate(input: $input) {
      success
      agentActivity {
        id
      }
    }
  }
`

type Config = {
  agentName: string
  allowedClockSkewMs: number
  dryRun: boolean
  graphqlEndpoint: string
  julesProxyHost: string
  julesProxyToken: string
  julesProxyUrl: string
  oauthAccessToken: string
  runtimeDir: string
  webhookSecret: string
}

type Services = {
  fetchImpl?: typeof fetch
  logger?: {
    error: (...args: unknown[]) => void
  }
  now?: () => number
}

type NotificationSummary = {
  actions: Record<string, {
    count: number
    lastSeenAt: string | null
    samples: Array<{
      issueIdentifier: string | null
      issueTitle: string | null
      projectName: string | null
    }>
  }>
  totalNotifications: number
}

function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === null || value === "") {
    return fallback
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase())
}

function joinPath(dir: string, fileName: string): string {
  return `${dir.replace(/\/$/, "")}/${fileName}`
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function renderDashboard(req: Request, config: Config): Response {
  const url = new URL(req.url)
  const email = req.headers.get("Remote-Email") ?? "unknown"
  const host = req.headers.get("Host") ?? "unknown"

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Linear Agent</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f2ec;
        --panel: rgba(255, 255, 255, 0.92);
        --ink: #171512;
        --muted: #675f56;
        --line: #d7d1c7;
        --accent: #1650c7;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top left, rgba(22, 80, 199, 0.15), transparent 30%),
          linear-gradient(180deg, #faf8f3 0%, var(--bg) 100%);
        color: var(--ink);
        font: 16px/1.5 Georgia, "Times New Roman", serif;
      }
      main {
        max-width: 900px;
        margin: 0 auto;
        padding: 48px 20px 72px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: clamp(2.2rem, 6vw, 4rem);
        line-height: 0.95;
        letter-spacing: -0.04em;
      }
      p {
        color: var(--muted);
        max-width: 42rem;
      }
      section {
        margin-top: 24px;
        padding: 22px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: var(--panel);
      }
      dl {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 8px 14px;
        margin: 0;
      }
      dt {
        color: var(--muted);
        font-weight: 700;
      }
      dd {
        margin: 0;
        word-break: break-word;
      }
      code {
        font: 0.92rem/1.35 "Courier New", monospace;
        color: var(--accent);
      }
      ul {
        margin: 0;
        padding-left: 1.2rem;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Linear Agent</h1>
      <p>
        This Smallweb app is the Linear webhook ingress. Public webhook delivery is accepted on
        <code>/webhooks/linear</code>; operator pages stay behind Smallweb auth.
      </p>
      <section>
        <dl>
          <dt>Remote Email</dt>
          <dd><code>${escapeHtml(email)}</code></dd>
          <dt>Host</dt>
          <dd>${escapeHtml(host)}</dd>
          <dt>Path</dt>
          <dd>${escapeHtml(url.pathname)}</dd>
          <dt>Dry Run</dt>
          <dd>${config.dryRun ? "true" : "false"}</dd>
          <dt>Runtime Dir</dt>
          <dd><code>${escapeHtml(config.runtimeDir)}</code></dd>
        </dl>
      </section>
      <section>
        <ul>
          <li><code>/healthz</code> is public for load balancers and smoke checks.</li>
          <li><code>/webhooks/linear</code> is public and verifies the Linear HMAC signature.</li>
          <li><code>/matrix</code> summarizes recorded notification traffic.</li>
        </ul>
      </section>
    </main>
  </body>
</html>`

  return new Response(html, {
    headers: {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
    },
  })
}

export function loadConfig(env = Deno.env.toObject()): Config {
  const runtimeDir = env.LINEAR_RUNTIME_DIR?.trim() || `${Deno.cwd()}/data`
  const allowedClockSkewMs = Number.parseInt(env.LINEAR_ALLOWED_CLOCK_SKEW_MS ?? "60000", 10)
  const dryRun = parseBoolean(
    env.LINEAR_DRY_RUN,
    env.LINEAR_OAUTH_ACCESS_TOKEN ? false : true,
  )

  return {
    agentName: env.LINEAR_AGENT_NAME ?? "Smallweb Linear Agent",
    allowedClockSkewMs: Number.isFinite(allowedClockSkewMs) ? allowedClockSkewMs : 60000,
    dryRun,
    graphqlEndpoint: env.LINEAR_GRAPHQL_ENDPOINT ?? "https://api.linear.app/graphql",
    julesProxyHost: env.JULES_PROXY_HOST ?? "",
    julesProxyToken: env.JULES_PROXY_TOKEN ?? "",
    julesProxyUrl: env.JULES_PROXY_URL ?? "",
    oauthAccessToken: env.LINEAR_OAUTH_ACCESS_TOKEN ?? "",
    runtimeDir,
    webhookSecret: env.LINEAR_WEBHOOK_SECRET ?? "",
  }
}

async function ensureParentDir(filePath: string): Promise<void> {
  const lastSlash = filePath.lastIndexOf("/")
  if (lastSlash <= 0) {
    return
  }

  await Deno.mkdir(filePath.slice(0, lastSlash), { recursive: true })
}

async function appendJsonl(filePath: string, record: unknown): Promise<void> {
  await ensureParentDir(filePath)
  await Deno.writeTextFile(filePath, `${JSON.stringify(record)}\n`, {
    append: true,
    create: true,
  })
}

async function readJsonl(filePath: string): Promise<unknown[]> {
  try {
    const contents = await Deno.readTextFile(filePath)
    return contents
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return []
    }

    throw error
  }
}

function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes).map((value) => value.toString(16).padStart(2, "0")).join("")
}

function hexDecode(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    return null
  }

  const bytes = new Uint8Array(hex.length / 2)

  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16)
  }

  return bytes
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false
  }

  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index]
  }

  return diff === 0
}

async function hmacSha256(secret: string, rawBody: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )

  const body = rawBody.slice().buffer
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, body))
}

export async function createSignature(secret: string, rawBody: Uint8Array): Promise<string> {
  return hexEncode(await hmacSha256(secret, rawBody))
}

export async function verifySignature(
  secret: string,
  headerSignature: string | null,
  rawBody: Uint8Array,
): Promise<boolean> {
  if (!secret || !headerSignature) {
    return false
  }

  const received = hexDecode(headerSignature)
  if (!received) {
    return false
  }

  const expected = await hmacSha256(secret, rawBody)
  return timingSafeEqual(received, expected)
}

export function isFreshTimestamp(
  webhookTimestamp: number,
  now = Date.now(),
  allowedClockSkewMs = 60000,
): boolean {
  if (!Number.isFinite(webhookTimestamp)) {
    return false
  }

  return Math.abs(now - webhookTimestamp) <= allowedClockSkewMs
}

function summarizePrompt(payload: Record<string, any>): string {
  const issueIdentifier = payload.agentSession?.issue?.identifier
  const issueTitle = payload.agentSession?.issue?.title
  const promptBody = payload.agentActivity?.body
  const parts: string[] = []

  if (issueIdentifier) {
    parts.push(issueIdentifier)
  }

  if (issueTitle) {
    parts.push(issueTitle)
  }

  if (promptBody) {
    parts.push(`prompt: ${promptBody}`)
  }

  if (parts.length === 0 && typeof payload.promptContext === "string") {
    parts.push(`promptContext chars=${payload.promptContext.length}`)
  }

  return parts.join(" | ") || "session context received"
}

function buildAgentActivities(payload: Record<string, any>, config: Config): Array<Record<string, string>> {
  const isStop = payload.action === "prompted" && payload.agentActivity?.signal === "stop"

  if (isStop) {
    return [
      {
        type: "response",
        body: `${config.agentName} received a stop signal and halted further work.`,
      },
    ]
  }

  const contextSummary = summarizePrompt(payload)

  return [
    {
      type: "thought",
      body: `${config.agentName} acknowledged the session and is reviewing ${contextSummary}.`,
    },
    {
      type: "response",
      body: `${config.agentName} is wired correctly on the Smallweb webhook path. This confirms the session webhook was received and the delegation pipeline is ready for live work.`,
    },
  ]
}

function summarizeNotification(payload: Record<string, any>): Record<string, unknown> {
  const notification = payload.notification ?? {}
  const issue = notification.issue ?? notification.comment?.issue ?? payload.issue ?? null
  const project = notification.project ?? issue?.project ?? null

  return {
    type: payload.type,
    action: payload.action,
    createdAt: payload.createdAt ?? new Date(payload.webhookTimestamp ?? Date.now()).toISOString(),
    issueId: issue?.id ?? null,
    issueIdentifier: issue?.identifier ?? null,
    issueTitle: issue?.title ?? null,
    projectId: project?.id ?? null,
    projectName: project?.name ?? null,
  }
}

function summarizeNotifications(entries: Array<Record<string, any>>): NotificationSummary {
  const actions: NotificationSummary["actions"] = {}

  for (const entry of entries) {
    const current = actions[entry.action] ?? { count: 0, lastSeenAt: null, samples: [] }
    current.count += 1
    current.lastSeenAt = entry.createdAt ?? null

    if (current.samples.length < 5) {
      current.samples.push({
        issueIdentifier: entry.issueIdentifier ?? null,
        issueTitle: entry.issueTitle ?? null,
        projectName: entry.projectName ?? null,
      })
    }

    actions[entry.action] = current
  }

  return {
    actions,
    totalNotifications: entries.length,
  }
}

async function postGraphql(config: Config, body: unknown, services: Services): Promise<any> {
  const response = await (services.fetchImpl ?? fetch)(config.graphqlEndpoint, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${config.oauthAccessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json()

  if (!response.ok || payload.errors?.length) {
    const details = JSON.stringify(payload.errors ?? payload, null, 2)
    throw new Error(`Linear GraphQL request failed: ${response.status} ${details}`)
  }

  return payload.data
}

async function emitActivity(
  config: Config,
  sessionId: string,
  content: Record<string, string>,
  services: Services,
): Promise<void> {
  const activityPath = joinPath(config.runtimeDir, "activities.jsonl")
  const record: Record<string, unknown> = {
    agentSessionId: sessionId,
    content,
    mode: config.dryRun ? "dry-run" : "live",
    recordedAt: new Date().toISOString(),
  }

  if (config.dryRun || !config.oauthAccessToken) {
    await appendJsonl(activityPath, record)
    return
  }

  const data = await postGraphql(
    config,
    {
      query: AGENT_ACTIVITY_CREATE_MUTATION,
      variables: {
        input: {
          agentSessionId: sessionId,
          content,
        },
      },
    },
    services,
  )

  record.agentActivityId = data.agentActivityCreate?.agentActivity?.id ?? null
  await appendJsonl(activityPath, record)
}

async function readResponseBody(response: Response): Promise<unknown> {
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

function toBodyBytes(body: BodyInit | null | undefined): Uint8Array {
  if (body === undefined || body === null) {
    return new Uint8Array()
  }

  if (typeof body === "string") {
    return encoder.encode(body)
  }

  if (body instanceof Uint8Array) {
    return body
  }

  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body)
  }

  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength))
  }

  throw new Error("Unsupported proxy request body type")
}

function findSequence(buffer: Uint8Array, sequence: number[], start = 0): number {
  for (let index = start; index <= buffer.length - sequence.length; index += 1) {
    let matches = true

    for (let offset = 0; offset < sequence.length; offset += 1) {
      if (buffer[index + offset] !== sequence[offset]) {
        matches = false
        break
      }
    }

    if (matches) {
      return index
    }
  }

  return -1
}

function decodeChunkedBody(body: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = []
  let totalLength = 0
  let offset = 0

  while (offset < body.length) {
    const lineEnd = findSequence(body, [13, 10], offset)
    if (lineEnd < 0) {
      throw new Error("Invalid chunked response from Jules proxy")
    }

    const size = Number.parseInt(decoder.decode(body.slice(offset, lineEnd)).split(";")[0].trim(), 16)
    if (!Number.isFinite(size)) {
      throw new Error("Invalid chunk size from Jules proxy")
    }

    offset = lineEnd + 2

    if (size === 0) {
      break
    }

    const chunk = body.slice(offset, offset + size)
    chunks.push(chunk)
    totalLength += chunk.length
    offset += size + 2
  }

  const decoded = new Uint8Array(totalLength)
  let writeOffset = 0

  for (const chunk of chunks) {
    decoded.set(chunk, writeOffset)
    writeOffset += chunk.length
  }

  return decoded
}

function parseHttpResponse(raw: Uint8Array): Response {
  const separatorIndex = findSequence(raw, [13, 10, 13, 10])
  if (separatorIndex < 0) {
    throw new Error("Invalid proxy response")
  }

  const headerText = decoder.decode(raw.slice(0, separatorIndex))
  const headerLines = headerText.split("\r\n")
  const statusLine = headerLines.shift() ?? ""
  const statusMatch = statusLine.match(/^HTTP\/\d+\.\d+\s+(\d+)/)

  if (!statusMatch) {
    throw new Error("Invalid proxy status line")
  }

  const headers = new Headers()

  for (const line of headerLines) {
    const separator = line.indexOf(":")
    if (separator <= 0) {
      continue
    }

    headers.append(line.slice(0, separator).trim(), line.slice(separator + 1).trim())
  }

  let body = raw.slice(separatorIndex + 4)
  const transferEncoding = headers.get("transfer-encoding") ?? ""
  const contentLength = headers.get("content-length")

  if (transferEncoding.toLowerCase().includes("chunked")) {
    body = new Uint8Array(decodeChunkedBody(body))
  } else if (contentLength) {
    const length = Number.parseInt(contentLength, 10)
    if (Number.isFinite(length)) {
      body = body.slice(0, length)
    }
  }

  return new Response(body, {
    headers,
    status: Number.parseInt(statusMatch[1], 10),
  })
}

async function readAll(connection: Deno.Conn): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  let totalLength = 0
  const buffer = new Uint8Array(16 * 1024)

  while (true) {
    const readLength = await connection.read(buffer)
    if (readLength === null) {
      break
    }

    const chunk = buffer.slice(0, readLength)
    chunks.push(chunk)
    totalLength += chunk.length
  }

  const all = new Uint8Array(totalLength)
  let offset = 0

  for (const chunk of chunks) {
    all.set(chunk, offset)
    offset += chunk.length
  }

  return all
}

async function requestProxyOverSocket(url: string, init: RequestInit, hostHeader: string): Promise<Response> {
  const targetUrl = new URL(url)
  const port = Number.parseInt(targetUrl.port || (targetUrl.protocol === "https:" ? "443" : "80"), 10)
  const connection = targetUrl.protocol === "https:"
    ? await Deno.connectTls({ hostname: targetUrl.hostname, port })
    : await Deno.connect({ hostname: targetUrl.hostname, port })

  try {
    const headers = new Headers(init.headers)
    const bodyBytes = toBodyBytes(init.body)

    headers.set("host", hostHeader)
    headers.set("connection", "close")

    if (bodyBytes.length > 0 && !headers.has("content-length")) {
      headers.set("content-length", String(bodyBytes.length))
    }

    const requestLines = [
      `${init.method ?? "GET"} ${targetUrl.pathname}${targetUrl.search} HTTP/1.1`,
      ...Array.from(headers.entries()).map(([name, value]) => `${name}: ${value}`),
      "",
      "",
    ]

    await connection.write(encoder.encode(requestLines.join("\r\n")))
    if (bodyBytes.length > 0) {
      await connection.write(bodyBytes)
    }

    return parseHttpResponse(await readAll(connection))
  } finally {
    connection.close()
  }
}

async function requestProxy(url: string, init: RequestInit, services: Services, hostHeader: string): Promise<Response> {
  if (services.fetchImpl) {
    return await services.fetchImpl(url, init)
  }

  if (hostHeader) {
    return await requestProxyOverSocket(url, init, hostHeader)
  }

  return await fetch(url, init)
}

async function dispatchToJules(
  config: Config,
  payload: Record<string, any>,
  services: Services,
): Promise<unknown> {
  if (!config.julesProxyUrl) {
    return null
  }

  const issue = payload.agentSession?.issue
  const promptContext = payload.promptContext ?? issue?.description ?? ""

  if (!issue?.id || !issue?.identifier || !promptContext) {
    throw new Error("AgentSessionEvent payload is missing Jules dispatch context")
  }

  const headers = new Headers({
    "content-type": "application/json",
  })

  if (config.julesProxyHost) {
    headers.set("host", config.julesProxyHost)
  }

  if (config.julesProxyToken) {
    headers.set("authorization", `Bearer ${config.julesProxyToken}`)
  }

  const response = await requestProxy(
    `${config.julesProxyUrl.replace(/\/$/, "")}/api/dispatch`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        issueId: issue.id,
        issueIdentifier: issue.identifier,
        promptContext,
      }),
    },
    services,
    config.julesProxyHost,
  )

  const body = await readResponseBody(response)

  if (!response.ok) {
    throw new Error(`Jules dispatch failed: ${response.status} ${JSON.stringify(body)}`)
  }

  return body
}

async function logProcessingError(
  config: Config,
  logger: { error: (...args: unknown[]) => void },
  payload: Record<string, any>,
  error: unknown,
  stage: string,
): Promise<void> {
  await appendJsonl(joinPath(config.runtimeDir, "errors.jsonl"), {
    error: error instanceof Error ? error.message : String(error),
    payloadType: payload.type ?? null,
    recordedAt: new Date().toISOString(),
    stage,
    webhookId: payload.webhookId ?? null,
  })

  logger.error(error)
}

async function handleAgentSessionEvent(
  payload: Record<string, any>,
  config: Config,
  services: Services,
): Promise<void> {
  const sessionId = payload.agentSession?.id

  if (!sessionId) {
    throw new Error("AgentSessionEvent payload is missing agentSession.id")
  }

  await appendJsonl(joinPath(config.runtimeDir, "raw-payloads.jsonl"), {
    payload,
    receivedAt: new Date().toISOString(),
  })

  const logger = services.logger ?? console

  for (const content of buildAgentActivities(payload, config)) {
    try {
      await emitActivity(config, sessionId, content, services)
    } catch (error) {
      await logProcessingError(config, logger, payload, error, "emitActivity")
    }
  }

  if (payload.action === "created") {
    try {
      await dispatchToJules(config, payload, services)
    } catch (error) {
      await logProcessingError(config, logger, payload, error, "dispatchToJules")
    }
  }
}

async function handleNotification(payload: Record<string, any>, config: Config): Promise<void> {
  await appendJsonl(joinPath(config.runtimeDir, "notifications.jsonl"), summarizeNotification(payload))
}

async function dispatchWebhook(
  payload: Record<string, any>,
  config: Config,
  services: Services,
): Promise<void> {
  switch (payload.type) {
    case "AgentSessionEvent":
      await handleAgentSessionEvent(payload, config, services)
      break
    case "AppUserNotification":
      await handleNotification(payload, config)
      break
    case "PermissionChange":
    case "OAuthApp":
      await appendJsonl(joinPath(config.runtimeDir, "deliveries.jsonl"), {
        action: payload.action ?? null,
        receivedAt: new Date().toISOString(),
        type: payload.type,
        webhookId: payload.webhookId ?? null,
      })
      break
    default:
      await appendJsonl(joinPath(config.runtimeDir, "errors.jsonl"), {
        error: `Unhandled webhook type: ${payload.type ?? "unknown"}`,
        payload,
        recordedAt: new Date().toISOString(),
      })
  }
}

export function createApp(config = loadConfig(), services: Services = {}) {
  const logger = services.logger ?? console

  return {
    fetch: async (req: Request): Promise<Response> => {
      const url = new URL(req.url)

      if (req.method === "GET" && url.pathname === "/healthz") {
        return json({
          app: "linear-agent",
          dryRun: config.dryRun,
          julesDispatchConfigured: Boolean(config.julesProxyUrl),
          oauthAccessTokenConfigured: Boolean(config.oauthAccessToken),
          ok: true,
          runtimeDir: config.runtimeDir,
          webhookSecretConfigured: Boolean(config.webhookSecret),
        })
      }

      if (req.method === "GET" && url.pathname === "/matrix") {
        const entries = await readJsonl(joinPath(config.runtimeDir, "notifications.jsonl")) as Array<Record<string, any>>
        return json(summarizeNotifications(entries))
      }

      if (req.method === "GET" && url.pathname === "/") {
        return renderDashboard(req, config)
      }

      if (req.method !== "POST" || url.pathname !== "/webhooks/linear") {
        return json({ error: "Not found", ok: false }, 404)
      }

      if (!config.webhookSecret) {
        return json({
          error: "LINEAR_WEBHOOK_SECRET is not configured",
          ok: false,
        }, 500)
      }

      const rawBody = new Uint8Array(await req.arrayBuffer())
      const signature = req.headers.get("Linear-Signature")

      if (!await verifySignature(config.webhookSecret, signature, rawBody)) {
        return json({ error: "Invalid Linear-Signature header", ok: false }, 401)
      }

      let payload: Record<string, any>

      try {
        payload = JSON.parse(decoder.decode(rawBody))
      } catch {
        return json({ error: "Invalid JSON payload", ok: false }, 400)
      }

      if (
        !isFreshTimestamp(
          Number(payload.webhookTimestamp),
          services.now?.() ?? Date.now(),
          config.allowedClockSkewMs,
        )
      ) {
        return json({ error: "Stale webhookTimestamp", ok: false }, 401)
      }

      await appendJsonl(joinPath(config.runtimeDir, "deliveries.jsonl"), {
        action: payload.action ?? null,
        linearDeliveryHeader: req.headers.get("Linear-Delivery"),
        linearEventHeader: req.headers.get("Linear-Event"),
        receivedAt: new Date().toISOString(),
        type: payload.type ?? null,
        webhookId: payload.webhookId ?? null,
      })

      try {
        await dispatchWebhook(payload, config, services)
      } catch (error) {
        await logProcessingError(config, logger, payload, error, "dispatchWebhook")
      }

      return json({
        action: payload.action ?? null,
        dryRun: config.dryRun,
        ok: true,
        type: payload.type ?? null,
      })
    },
  }
}

export default createApp()
