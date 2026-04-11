const encoder = new TextEncoder()
const decoder = new TextDecoder()

const DEFAULT_ALLOWED_TOOLS = [
  "scope.get_current_target",
  "findings.record_note",
] as const

const SUPPORTED_MCP_PROTOCOL_VERSIONS = [
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
] as const

type Config = {
  allowedClockSkewMs: number
  allowedTools: string[]
  appName: string
  bountybenchGitRef: string
  daggerBin: string
  gitBin: string
  mcpBearerToken: string
  publicBaseUrl: string
  repoRoot: string
  runtimeDir: string
  targetLabel: string
  webhookSecret: string
  workerToken: string
  workerUrl: string
}

type Services = {
  fetchImpl?: typeof fetch
  logger?: {
    error: (...args: unknown[]) => void
    log?: (...args: unknown[]) => void
  }
  now?: () => number
  runBountyBenchTool?: (input: BountyBenchToolInput, config: Config) => Promise<BountyBenchToolResult>
}

type ExecuteJobInput = {
  issueId: string
  issueIdentifier: string
  requestOrigin?: string
  sessionId?: string
  source: "run" | "webhook"
}

type SessionContext = {
  createdAt: string
  issueId: string
  issueIdentifier: string
  sessionId: string
  source: "run" | "webhook"
  targetLabel: string
}

type WorkerStartPayload = {
  allowedTools: string[]
  callbackToken: string
  callbackUrl: string
  issueId: string
  issueIdentifier: string
  mcpBearerToken: string
  mcpServerUrl: string
  sessionId: string
}

type WorkerResult = {
  sessionId: string
  status: "completed" | "failed"
  summary: string
  toolCalls: Array<{
    ok: boolean
    tool: string
  }>
}

type WorkerDispatchResult = {
  sessionId: string
  status: "accepted" | "failed"
  summary: string
}

type JsonRpcRequest = {
  id?: number | string | null
  jsonrpc?: string
  method?: string
  params?: Record<string, unknown>
}

type BountyBenchToolName = "target.start_service" | "target.reset"
type BountyBenchRunMode = "baseline" | "agent"

type BountyBenchToolInput = {
  arguments: Record<string, unknown>
  tool: BountyBenchToolName
}

type BountyBenchToolResult = {
  endpoint: string
  gitRef: string
  mode: BountyBenchRunMode
  operation: "reset" | "start_service"
}

function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === null || value.trim() === "") {
    return fallback
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase())
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

function repoRootFromModule(): string {
  return trimTrailingSlash(decodeURIComponent(new URL("../../", import.meta.url).pathname))
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

function empty(status = 204): Response {
  return new Response(null, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  })
}

function noStoreHeaders(contentType = "application/json; charset=utf-8"): HeadersInit {
  return {
    "cache-control": "no-store",
    "content-type": contentType,
  }
}

function jsonRpcResult(id: number | string | null | undefined, result: unknown, status = 200): Response {
  return json({
    id: id ?? null,
    jsonrpc: "2.0",
    result,
  }, status)
}

function jsonRpcError(
  id: number | string | null | undefined,
  code: number,
  message: string,
  status = 400,
): Response {
  return json({
    error: {
      code,
      message,
    },
    id: id ?? null,
    jsonrpc: "2.0",
  }, status)
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function loadAllowedTools(rawValue: string | undefined): string[] {
  const configured = rawValue
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  if (configured && configured.length > 0) {
    return configured
  }

  return [...DEFAULT_ALLOWED_TOOLS]
}

export function loadConfig(env = Deno.env.toObject()): Config {
  const runtimeDir = env.RESEARCH_NODE_RUNTIME_DIR?.trim() || `${Deno.cwd()}/data`
  const allowedClockSkewMs = Number.parseInt(env.RESEARCH_NODE_ALLOWED_CLOCK_SKEW_MS ?? "60000", 10)
  const repoRoot = trimTrailingSlash(env.RESEARCH_NODE_REPO_ROOT?.trim() || repoRootFromModule())

  return {
    allowedClockSkewMs: Number.isFinite(allowedClockSkewMs) ? allowedClockSkewMs : 60000,
    allowedTools: loadAllowedTools(env.RESEARCH_NODE_ALLOWED_TOOLS),
    appName: env.RESEARCH_NODE_APP_NAME?.trim() || "research-node",
    bountybenchGitRef: env.RESEARCH_NODE_BOUNTYBENCH_GIT_REF?.trim() || "plan-329-bountybench-v0",
    daggerBin: env.RESEARCH_NODE_DAGGER_BIN?.trim() || `${repoRoot}/.tools/bin/dagger`,
    gitBin: env.RESEARCH_NODE_GIT_BIN?.trim() || "git",
    mcpBearerToken: env.RESEARCH_NODE_MCP_BEARER_TOKEN?.trim() || "",
    publicBaseUrl: trimTrailingSlash(env.RESEARCH_NODE_BASE_URL?.trim() || "http://research-node.tidelands.dev"),
    repoRoot,
    runtimeDir,
    targetLabel: env.RESEARCH_NODE_TARGET_LABEL?.trim() || "lunary-calibration",
    webhookSecret:
      env.RESEARCH_NODE_WEBHOOK_SECRET?.trim() ||
      env.LINEAR_WEBHOOK_SECRET?.trim() ||
      "",
    workerToken: env.RESEARCH_NODE_WORKER_TOKEN?.trim() || "",
    workerUrl: trimTrailingSlash(env.RESEARCH_NODE_WORKER_URL?.trim() || ""),
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

  return new Uint8Array(await crypto.subtle.sign("HMAC", key, rawBody.slice().buffer))
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

function readRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Expected "${fieldName}" to be a non-empty string.`)
  }

  return value.trim()
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

function toolDefinitions(config: Config): Array<Record<string, unknown>> {
  const availableTools = new Map<string, Record<string, unknown>>([
    [
      "scope.get_current_target",
      {
        description: "Return the current issue identifier and target label for the active session.",
        inputSchema: {
          additionalProperties: false,
          properties: {},
          type: "object",
        },
        name: "scope.get_current_target",
      },
    ],
    [
      "findings.record_note",
      {
        description: "Append an operator-visible finding note to the session log.",
        inputSchema: {
          additionalProperties: false,
          properties: {
            note: {
              minLength: 1,
              type: "string",
            },
          },
          required: ["note"],
          type: "object",
        },
        name: "findings.record_note",
      },
    ],
    [
      "target.start_service",
      {
        description: "Start the real BountyBench Lunary target through the PR-26 Dagger harness and return its endpoint.",
        inputSchema: {
          additionalProperties: false,
          properties: {
            mode: {
              enum: ["baseline", "agent"],
              type: "string",
            },
          },
          type: "object",
        },
        name: "target.start_service",
      },
    ],
    [
      "target.reset",
      {
        description: "Reset the BountyBench Lunary target by recreating it through the PR-26 Dagger harness.",
        inputSchema: {
          additionalProperties: false,
          properties: {
            mode: {
              enum: ["baseline", "agent"],
              type: "string",
            },
          },
          type: "object",
        },
        name: "target.reset",
      },
    ],
  ])

  return config.allowedTools
    .map((name) => availableTools.get(name))
    .filter((tool): tool is Record<string, unknown> => tool !== undefined)
}

function negotiateProtocolVersion(requestedVersion: unknown): string {
  if (
    typeof requestedVersion === "string" &&
    SUPPORTED_MCP_PROTOCOL_VERSIONS.includes(
      requestedVersion as (typeof SUPPORTED_MCP_PROTOCOL_VERSIONS)[number],
    )
  ) {
    return requestedVersion
  }

  return SUPPORTED_MCP_PROTOCOL_VERSIONS[0]
}

async function resolveSessionContext(
  sessionId: string,
  runtimeDir: string,
  sessionContexts: Map<string, SessionContext>,
): Promise<SessionContext | null> {
  const cached = sessionContexts.get(sessionId)
  if (cached) {
    return cached
  }

  const sessionEntries = await readJsonl(joinPath(runtimeDir, "sessions.jsonl")) as Array<Record<string, unknown>>

  for (let index = sessionEntries.length - 1; index >= 0; index -= 1) {
    const entry = sessionEntries[index]
    if (
      entry.event === "session-created" &&
      entry.sessionId === sessionId &&
      typeof entry.issueId === "string" &&
      typeof entry.issueIdentifier === "string" &&
      typeof entry.source === "string" &&
      typeof entry.targetLabel === "string"
    ) {
      const restored: SessionContext = {
        createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
        issueId: entry.issueId,
        issueIdentifier: entry.issueIdentifier,
        sessionId,
        source: entry.source === "run" ? "run" : "webhook",
        targetLabel: entry.targetLabel,
      }

      sessionContexts.set(sessionId, restored)
      return restored
    }
  }

  return null
}

function parseBountyBenchMode(value: unknown): BountyBenchRunMode {
  if (value === "agent") {
    return "agent"
  }

  return "baseline"
}

function extractDaggerLines(output: string): string[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) =>
      line !== "" &&
      !line.startsWith("A new release of dagger is available") &&
      !line.startsWith("To upgrade, see ") &&
      !line.startsWith("https://github.com/dagger/dagger/releases/tag/")
    )
}

async function runCommand(
  cwd: string,
  command: string,
  args: string[],
  env: Record<string, string> = {},
): Promise<{ code: number; stderr: string; stdout: string }> {
  try {
    const output = await new Deno.Command(command, {
      args,
      cwd,
      env,
      stderr: "piped",
      stdout: "piped",
    }).output()

    return {
      code: output.code,
      stderr: decoder.decode(output.stderr),
      stdout: decoder.decode(output.stdout),
    }
  } catch (error) {
    if (error instanceof Error && error.name === "NotCapable") {
      throw new Error(
        "This runtime cannot execute the Dagger bridge. Run research-node outside the Smallweb sandbox or provide a sidecar bridge.",
      )
    }

    throw error
  }
}

async function withBountyBenchWorktree<T>(config: Config, run: (worktreeDir: string) => Promise<T>): Promise<T> {
  await Deno.mkdir(config.runtimeDir, { recursive: true })
  const worktreeDir = await Deno.makeTempDir({
    dir: config.runtimeDir,
    prefix: "bountybench-worktree-",
  })

  const addResult = await runCommand(config.repoRoot, config.gitBin, [
    "worktree",
    "add",
    "--detach",
    worktreeDir,
    config.bountybenchGitRef,
  ])

  if (addResult.code !== 0) {
    throw new Error(
      `Failed to create BountyBench worktree for ${config.bountybenchGitRef}: ${
        addResult.stderr.trim() || addResult.stdout.trim() || `exit code ${addResult.code}`
      }`,
    )
  }

  try {
    return await run(worktreeDir)
  } finally {
    await runCommand(config.repoRoot, config.gitBin, ["worktree", "remove", "--force", worktreeDir])
    await Deno.remove(worktreeDir, { recursive: true }).catch(() => {})
  }
}

async function runBountyBenchToolViaDagger(
  input: BountyBenchToolInput,
  config: Config,
): Promise<BountyBenchToolResult> {
  const mode = parseBountyBenchMode(input.arguments.mode)

  return await withBountyBenchWorktree(config, async (worktreeDir) => {
    const result = await runCommand(
      worktreeDir,
      config.daggerBin,
      [
        "call",
        "--silent",
        "-m",
        "./dagger/bountybench/system",
        "start-target-service",
        "--mode",
        mode,
        "endpoint",
        "--port",
        "3333",
      ],
      {
        DAGGER_NO_NAG: "1",
      },
    )

    if (result.code !== 0) {
      throw new Error(
        `BountyBench ${input.tool} failed: ${
          result.stderr.trim() || result.stdout.trim() || `exit code ${result.code}`
        }`,
      )
    }

    const endpoint = extractDaggerLines(result.stdout)[0]
    if (!endpoint) {
      throw new Error(`BountyBench ${input.tool} did not return an endpoint.`)
    }

    return {
      endpoint,
      gitRef: config.bountybenchGitRef,
      mode,
      operation: input.tool === "target.reset" ? "reset" : "start_service",
    }
  })
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
    <title>Research Node</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f3f4ef;
        --panel: rgba(255, 255, 255, 0.94);
        --ink: #182018;
        --muted: #5a6558;
        --line: #c8d1c3;
        --accent: #1f6a46;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top left, rgba(31, 106, 70, 0.18), transparent 28%),
          linear-gradient(180deg, #f9faf7 0%, var(--bg) 100%);
        color: var(--ink);
        font: 16px/1.5 Georgia, "Times New Roman", serif;
      }
      main {
        max-width: 920px;
        margin: 0 auto;
        padding: 48px 20px 72px;
      }
      h1 {
        margin: 0 0 14px;
        font-size: clamp(2.6rem, 7vw, 5rem);
        line-height: 0.95;
        letter-spacing: -0.045em;
      }
      p { color: var(--muted); max-width: 42rem; }
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
        color: var(--accent);
        font: 0.92rem/1.35 "Courier New", monospace;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Research Node</h1>
      <p>
        This Smallweb app is the PLAN-358 control node. It accepts Linear work,
        exposes a bearer-protected <code>/mcp</code> surface, and delegates
        sessions to a separate research worker.
      </p>
      <section>
        <dl>
          <dt>Remote Email</dt>
          <dd><code>${escapeHtml(email)}</code></dd>
          <dt>Host</dt>
          <dd>${escapeHtml(host)}</dd>
          <dt>Path</dt>
          <dd>${escapeHtml(url.pathname)}</dd>
          <dt>Worker URL</dt>
          <dd><code>${escapeHtml(config.workerUrl || "not configured")}</code></dd>
          <dt>Runtime Dir</dt>
          <dd><code>${escapeHtml(config.runtimeDir)}</code></dd>
        </dl>
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

async function parseJsonBody<T>(req: Request): Promise<T> {
  try {
    return await req.json() as T
  } catch {
    throw new Error("Request body must be valid JSON.")
  }
}

function normalizeWorkerResult(payload: unknown, sessionId: string): WorkerResult {
  if (!isRecord(payload)) {
    throw new Error("Worker response must be an object.")
  }

  const toolCalls = Array.isArray(payload.toolCalls)
    ? payload.toolCalls
      .filter((entry) => isRecord(entry))
      .map((entry) => ({
        ok: Boolean(entry.ok),
        tool: typeof entry.tool === "string" ? entry.tool : "unknown",
      }))
    : []

  return {
    sessionId: typeof payload.sessionId === "string" ? payload.sessionId : sessionId,
    status: payload.status === "failed" ? "failed" : "completed",
    summary: typeof payload.summary === "string" ? payload.summary : "Worker completed without a summary.",
    toolCalls,
  }
}

async function logError(config: Config, stage: string, error: unknown, context: Record<string, unknown> = {}): Promise<void> {
  await appendJsonl(joinPath(config.runtimeDir, "errors.jsonl"), {
    ...context,
    error: error instanceof Error ? error.message : String(error),
    recordedAt: new Date().toISOString(),
    stage,
  })
}

async function startWorkerSession(
  config: Config,
  services: Services,
  session: SessionContext,
  mcpServerUrl: string,
  callbackUrl: string,
): Promise<WorkerDispatchResult> {
  if (!config.workerUrl) {
    throw new Error("RESEARCH_NODE_WORKER_URL is not configured.")
  }

  if (!config.workerToken) {
    throw new Error("RESEARCH_NODE_WORKER_TOKEN is not configured.")
  }

  if (!config.mcpBearerToken) {
    throw new Error("RESEARCH_NODE_MCP_BEARER_TOKEN is not configured.")
  }

  const payload: WorkerStartPayload = {
    allowedTools: [...config.allowedTools],
    callbackToken: config.workerToken,
    callbackUrl,
    issueId: session.issueId,
    issueIdentifier: session.issueIdentifier,
    mcpBearerToken: config.mcpBearerToken,
    mcpServerUrl,
    sessionId: session.sessionId,
  }

  const response = await (services.fetchImpl ?? fetch)(`${config.workerUrl}/sessions`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${config.workerToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const body = await readResponseBody(response)

  if (!response.ok) {
    throw new Error(`Worker start failed: ${response.status} ${JSON.stringify(body)}`)
  }

  if (!isRecord(body)) {
    throw new Error("Worker start response must be an object.")
  }

  return {
    sessionId: typeof body.sessionId === "string" ? body.sessionId : session.sessionId,
    status: body.status === "failed" ? "failed" : "accepted",
    summary: typeof body.summary === "string" ? body.summary : "Worker accepted the session.",
  }
}

async function recordWorkerResult(config: Config, result: WorkerResult): Promise<void> {
  await appendJsonl(joinPath(config.runtimeDir, "worker-events.jsonl"), {
    recordedAt: new Date().toISOString(),
    sessionId: result.sessionId,
    type: "worker-result",
    workerResult: result,
  })

  await appendJsonl(joinPath(config.runtimeDir, "sessions.jsonl"), {
    event: "worker-finished",
    recordedAt: new Date().toISOString(),
    sessionId: result.sessionId,
    status: result.status,
    summary: result.summary,
  })
}

async function executeJob(
  input: ExecuteJobInput,
  config: Config,
  services: Services,
  sessionContexts: Map<string, SessionContext>,
): Promise<WorkerDispatchResult> {
  const createdAt = new Date().toISOString()
  const sessionId = input.sessionId?.trim() || crypto.randomUUID()
  const session: SessionContext = {
    createdAt,
    issueId: input.issueId,
    issueIdentifier: input.issueIdentifier,
    sessionId,
    source: input.source,
    targetLabel: config.targetLabel,
  }

  sessionContexts.set(sessionId, session)

  await appendJsonl(joinPath(config.runtimeDir, "sessions.jsonl"), {
    ...session,
    event: "session-created",
    status: "pending",
  })

  const requestBaseUrl = trimTrailingSlash(input.requestOrigin || config.publicBaseUrl)
  const mcpServerUrl = `${requestBaseUrl}/mcp`
  const callbackUrl = `${requestBaseUrl}/worker-results`

  try {
    const workerDispatch = await startWorkerSession(config, services, session, mcpServerUrl, callbackUrl)

    await appendJsonl(joinPath(config.runtimeDir, "worker-events.jsonl"), {
      recordedAt: new Date().toISOString(),
      sessionId,
      type: "worker-dispatched",
      workerDispatch,
    })

    return workerDispatch
  } catch (error) {
    await logError(config, "executeJob", error, {
      issueIdentifier: session.issueIdentifier,
      sessionId,
    })

    const failedResult: WorkerDispatchResult = {
      sessionId,
      status: "failed",
      summary: error instanceof Error ? error.message : String(error),
    }

    await appendJsonl(joinPath(config.runtimeDir, "worker-events.jsonl"), {
      recordedAt: new Date().toISOString(),
      sessionId,
      type: "worker-dispatch-failed",
      workerDispatch: failedResult,
    })

    await appendJsonl(joinPath(config.runtimeDir, "sessions.jsonl"), {
      recordedAt: new Date().toISOString(),
      sessionId,
      status: "failed",
      summary: failedResult.summary,
      event: "worker-dispatch-failed",
    })

    return failedResult
  }
}

async function handleMcpRequest(
  req: Request,
  config: Config,
  sessionContexts: Map<string, SessionContext>,
  services: Services,
): Promise<Response> {
  if (!config.mcpBearerToken) {
    return json({ error: "RESEARCH_NODE_MCP_BEARER_TOKEN is not configured.", ok: false }, 500)
  }

  if (!hasValidBearer(req, config.mcpBearerToken)) {
    return json({ error: "Bearer token required for /mcp.", ok: false }, 401)
  }

  let payload: JsonRpcRequest

  try {
    payload = await parseJsonBody<JsonRpcRequest>(req)
  } catch (error) {
    return jsonRpcError(null, -32700, error instanceof Error ? error.message : "Invalid JSON.", 400)
  }

  const sessionId = req.headers.get("x-research-session-id")?.trim() || ""
  const toolName = typeof payload.params?.name === "string" ? payload.params.name : null

  await appendJsonl(joinPath(config.runtimeDir, "mcp-requests.jsonl"), {
    id: payload.id ?? null,
    method: payload.method ?? null,
    recordedAt: new Date().toISOString(),
    sessionId: sessionId || null,
    toolName,
  })

  if (payload.method === "initialize") {
    return jsonRpcResult(payload.id, {
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
      protocolVersion: negotiateProtocolVersion(payload.params?.protocolVersion),
      serverInfo: {
        name: config.appName,
        version: "0.1.0",
      },
    })
  }

  if (payload.method === "notifications/initialized") {
    return empty(202)
  }

  if (payload.method === "ping") {
    return jsonRpcResult(payload.id, {})
  }

  if (payload.method === "tools/list") {
    return jsonRpcResult(payload.id, {
      tools: toolDefinitions(config),
    })
  }

  if (payload.method !== "tools/call") {
    return jsonRpcError(payload.id, -32601, "Unsupported MCP method.", 404)
  }

  const requestedTool = typeof payload.params?.name === "string" ? payload.params.name : ""
  if (!config.allowedTools.includes(requestedTool)) {
    return jsonRpcError(payload.id, -32003, `Tool "${requestedTool}" is not allowed.`, 403)
  }

  const session = sessionId
    ? await resolveSessionContext(sessionId, config.runtimeDir, sessionContexts)
    : null

  if (requestedTool === "scope.get_current_target") {
    return jsonRpcResult(payload.id, {
      content: [
        {
          text: session
            ? `${session.issueIdentifier} -> ${session.targetLabel}`
            : "unknown session",
          type: "text",
        },
      ],
      structuredContent: {
        issueIdentifier: session?.issueIdentifier ?? null,
        sessionId: sessionId || null,
        targetLabel: session?.targetLabel ?? config.targetLabel,
      },
    })
  }

  if (requestedTool === "findings.record_note") {
    const args = isRecord(payload.params?.arguments) ? payload.params?.arguments : {}
    const note = readRequiredString(args?.note, "note")

    await appendJsonl(joinPath(config.runtimeDir, "worker-events.jsonl"), {
      issueIdentifier: session?.issueIdentifier ?? null,
      note,
      recordedAt: new Date().toISOString(),
      sessionId: sessionId || null,
      type: "finding-note",
    })

    return jsonRpcResult(payload.id, {
      content: [
        {
          text: "note recorded",
          type: "text",
        },
      ],
      structuredContent: {
        note,
        ok: true,
        sessionId: sessionId || null,
      },
    })
  }

  if (requestedTool === "target.start_service" || requestedTool === "target.reset") {
    const args = isRecord(payload.params?.arguments) ? payload.params?.arguments : {}
    const toolResult = await (services.runBountyBenchTool ?? runBountyBenchToolViaDagger)({
      arguments: args,
      tool: requestedTool,
    }, config)

    return jsonRpcResult(payload.id, {
      content: [
        {
          text: `${requestedTool} -> ${toolResult.endpoint}`,
          type: "text",
        },
      ],
      structuredContent: {
        endpoint: toolResult.endpoint,
        gitRef: toolResult.gitRef,
        issueIdentifier: session?.issueIdentifier ?? null,
        mode: toolResult.mode,
        operation: toolResult.operation,
        sessionId: sessionId || null,
        targetLabel: session?.targetLabel ?? config.targetLabel,
      },
    })
  }

  return jsonRpcError(payload.id, -32601, `Unknown tool "${requestedTool}".`, 404)
}

async function handleWorkerResult(
  req: Request,
  config: Config,
  sessionContexts: Map<string, SessionContext>,
): Promise<Response> {
  if (!config.workerToken) {
    return json({ error: "RESEARCH_NODE_WORKER_TOKEN is not configured.", ok: false }, 500)
  }

  if (!hasValidBearer(req, config.workerToken)) {
    return json({ error: "Bearer token required for /worker-results.", ok: false }, 401)
  }

  let payload: WorkerResult

  try {
    payload = await parseJsonBody<WorkerResult>(req)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid JSON.", ok: false }, 400)
  }

  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId.trim() : ""
  if (!sessionId) {
    return json({ error: 'Expected "sessionId" to be a non-empty string.', ok: false }, 400)
  }

  const normalizedResult = normalizeWorkerResult(payload, sessionId)
  await resolveSessionContext(sessionId, config.runtimeDir, sessionContexts)
  await recordWorkerResult(config, normalizedResult)

  return new Response(JSON.stringify({
    ok: true,
    sessionId,
    status: normalizedResult.status,
  }, null, 2), {
    status: 202,
    headers: noStoreHeaders(),
  })
}

async function summarizeStatus(runtimeDir: string): Promise<Record<string, unknown>> {
  const sessions = await readJsonl(joinPath(runtimeDir, "sessions.jsonl")) as Array<Record<string, unknown>>
  const workerEvents = await readJsonl(joinPath(runtimeDir, "worker-events.jsonl")) as Array<Record<string, unknown>>

  return {
    lastSessionEvents: sessions.slice(-5),
    lastWorkerEvents: workerEvents.slice(-5),
    sessionCount: sessions.length,
    workerEventCount: workerEvents.length,
  }
}

function extractWebhookIssue(payload: Record<string, unknown>): { issueId: string; issueIdentifier: string } | null {
  const session = isRecord(payload.agentSession) ? payload.agentSession : null
  const issue = session && isRecord(session.issue) ? session.issue : null

  if (!issue) {
    return null
  }

  const issueId = typeof issue.id === "string" ? issue.id.trim() : ""
  const issueIdentifier = typeof issue.identifier === "string" ? issue.identifier.trim() : ""

  if (!issueId || !issueIdentifier) {
    return null
  }

  return { issueId, issueIdentifier }
}

export function createApp(config = loadConfig(), services: Services = {}) {
  const logger = services.logger ?? console
  const sessionContexts = new Map<string, SessionContext>()

  return {
    fetch: async (req: Request): Promise<Response> => {
      const url = new URL(req.url)

      if (req.method === "GET" && url.pathname === "/healthz") {
        return json({
          allowedTools: config.allowedTools,
          app: config.appName,
          mcpBearerConfigured: Boolean(config.mcpBearerToken),
          ok: true,
          runtimeDir: config.runtimeDir,
          webhookSecretConfigured: Boolean(config.webhookSecret),
          workerConfigured: Boolean(config.workerUrl && config.workerToken),
        })
      }

      if (req.method === "GET" && url.pathname === "/status") {
        return json(await summarizeStatus(config.runtimeDir))
      }

      if (req.method === "GET" && url.pathname === "/") {
        return renderDashboard(req, config)
      }

      if (req.method === "POST" && url.pathname === "/mcp") {
        try {
          return await handleMcpRequest(req, config, sessionContexts, services)
        } catch (error) {
          await logError(config, "handleMcpRequest", error)
          return json({ error: "MCP request failed.", ok: false }, 500)
        }
      }

      if (req.method === "POST" && url.pathname === "/worker-results") {
        try {
          return await handleWorkerResult(req, config, sessionContexts)
        } catch (error) {
          await logError(config, "handleWorkerResult", error)
          return json({ error: "Worker result handling failed.", ok: false }, 500)
        }
      }

      if (req.method !== "POST" || url.pathname !== "/webhooks/linear") {
        return json({ error: "Not found", ok: false }, 404)
      }

      if (!config.webhookSecret) {
        return json({ error: "RESEARCH_NODE_WEBHOOK_SECRET is not configured.", ok: false }, 500)
      }

      const rawBody = new Uint8Array(await req.arrayBuffer())
      if (!await verifySignature(config.webhookSecret, req.headers.get("linear-signature"), rawBody)) {
        return json({ error: "Invalid Linear-Signature header", ok: false }, 401)
      }

      let payload: Record<string, unknown>

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

      await appendJsonl(joinPath(config.runtimeDir, "sessions.jsonl"), {
        action: payload.action ?? null,
        event: "webhook-received",
        recordedAt: new Date().toISOString(),
        type: payload.type ?? null,
        webhookId: payload.webhookId ?? null,
      })

      if (payload.type !== "AgentSessionEvent" || payload.action !== "created") {
        return json({
          action: payload.action ?? null,
          ok: true,
          skipped: true,
          type: payload.type ?? null,
        })
      }

      const issue = extractWebhookIssue(payload)
      const session = isRecord(payload.agentSession) ? payload.agentSession : null
      const sessionId = typeof session?.id === "string" ? session.id.trim() : ""

      if (!issue || !sessionId) {
        return json({ error: "Webhook payload is missing session or issue context.", ok: false }, 400)
      }

      const result = await executeJob(
        {
          issueId: issue.issueId,
          issueIdentifier: issue.issueIdentifier,
          requestOrigin: url.origin,
          sessionId,
          source: "webhook",
        },
        config,
        services,
        sessionContexts,
      )

      if (result.status === "failed") {
        logger.error(result.summary)
      }

      return json({
        ok: result.status === "accepted",
        sessionId: result.sessionId,
        status: result.status,
        summary: result.summary,
      }, 202)
    },
    run: async (args: string[]): Promise<void> => {
      const command = args[0]

      if (command === "start-session") {
        const issueId = args[1]?.trim()

        if (!issueId) {
          console.error('usage: start-session <issue-id>')
          return
        }

        const result = await executeJob(
          {
            issueId,
            issueIdentifier: issueId,
            source: "run",
          },
          config,
          services,
          sessionContexts,
        )

        console.log(JSON.stringify(result, null, 2))
        return
      }

      if (command === "replay-session") {
        const sessionId = args[1]?.trim()

        if (!sessionId) {
          console.error('usage: replay-session <session-id>')
          return
        }

        const sessions = await readJsonl(joinPath(config.runtimeDir, "sessions.jsonl")) as Array<Record<string, unknown>>
        const workerEvents = await readJsonl(joinPath(config.runtimeDir, "worker-events.jsonl")) as Array<Record<string, unknown>>

        console.log(JSON.stringify({
          sessionEvents: sessions.filter((entry) => entry.sessionId === sessionId),
          workerEvents: workerEvents.filter((entry) => entry.sessionId === sessionId),
        }, null, 2))
        return
      }

      console.log("research-node")
      console.log('commands: start-session <issue-id> | replay-session <session-id>')
    },
  }
}

export default createApp()
