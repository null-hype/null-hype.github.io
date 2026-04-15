type JsonRpcId = number | string | null

type JsonRpcError = {
  code: number
  data?: unknown
  message: string
}

type JsonRpcRequest = {
  id?: JsonRpcId
  jsonrpc?: string
  method?: string
  params?: unknown
}

type JsonRpcResponse = {
  error?: JsonRpcError
  id: JsonRpcId
  jsonrpc: "2.0"
  result?: unknown
}

type JsonRpcNotification = {
  jsonrpc: "2.0"
  method: string
  params?: unknown
}

type AcpMessage = JsonRpcNotification | JsonRpcResponse

type TextContentBlock = {
  text: string
  type: "text"
}

type SessionPromptParams = {
  prompt: TextContentBlock[]
  sessionId: string
}

type SessionNewParams = {
  cwd: string
  mcpServers: unknown[]
}

export type LinearIssue = {
  description: string
  id: string
  identifier: string
  labels: string[]
  priority: number | null
  stateName: string
  stateType: string
  title: string
  updatedAt: string
}

type TaskSpec = {
  blockedBy: string[]
  instructions: string
  oracle?: {
    expectedSubstrings: string[]
  }
  personas: string[]
  target: {
    expectedTitle?: string
    headers?: Record<string, string>
    kind?: "url"
    method?: string
    url: string
  }
  taskType: "aging" | "exploit" | "recon"
}

type PersonaSlot = {
  acpUrl: string
  envPath: string
  id: string
  mode: "prod" | "test"
  networkConfigPath: string
  profileDir: string
  proxyUrl: string
  slotDir: string
  timezone: string
}

type ConnectionPlan = {
  issue: LinearIssue
  personas: PersonaSlot[]
  promptText: string
  task: TaskSpec
}

type DownstreamSessionResult = {
  sessionId: string
  stopReason: "cancelled" | "end_turn"
  summary: string
}

type PromptTurnResult = {
  messages: AcpMessage[]
  stopReason: "cancelled" | "end_turn"
  writebackBody?: string
}

type SessionRecord = {
  cancelRequested: boolean
  createdAt: string
  cwd: string
  mcpServers: unknown[]
  prompts: string[]
  sessionId: string
}

type QueueSelection = {
  issue: LinearIssue
  promptText: string
  task: TaskSpec
}

export type AdminConfig = {
  graphqlEndpoint: string
  linearApiKey: string
  protocolVersion: number
  queueLabel: string
  runtimeDir: string
  slotRoot: string
  teamName: string
  writebackMode: "dry-run" | "live"
}

type LinearService = {
  createComment?: (issueId: string, body: string) => Promise<{ commentId: string | null }>
  listIssues: () => Promise<LinearIssue[]>
}

export type AdminServices = {
  fetchImpl?: typeof fetch
  linear?: LinearService
  logger?: {
    error: (...args: unknown[]) => void
    info?: (...args: unknown[]) => void
  }
  now?: () => number
}

const ACP_PROTOCOL_VERSION = 1
const ISSUE_QUERY = `
  query QueueIssues($teamName: String!) {
    issues(filter: { team: { name: { eq: $teamName } } }, first: 100) {
      nodes {
        id
        identifier
        title
        description
        priority
        updatedAt
        state {
          name
          type
        }
        labels(first: 20) {
          nodes {
            name
          }
        }
      }
    }
  }
`

const COMMENT_CREATE_MUTATION = `
  mutation CommentCreate($input: CommentCreateInput!) {
    commentCreate(input: $input) {
      success
      comment {
        id
      }
    }
  }
`

const TASK_SPEC_PATTERN =
  /##\s*ACP Task Spec\s*```json\s*([\s\S]*?)```/i

function joinPath(dir: string, fileName: string) {
  return `${dir.replace(/\/$/, "")}/${fileName}`
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  })
}

function ndjson(messages: readonly AcpMessage[]) {
  const body = messages.map((message) => JSON.stringify(message)).join("\n")

  return new Response(body.length > 0 ? `${body}\n` : "", {
    headers: {
      "cache-control": "no-store",
      "content-type": "application/x-ndjson; charset=utf-8",
    },
  })
}

async function readNdjson(response: Response) {
  const body = await response.text()

  if (!body.trim()) {
    return []
  }

  return body
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AcpMessage)
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function makeError(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
  return {
    id,
    jsonrpc: "2.0",
    error: {
      code,
      data,
      message,
    },
  }
}

function makeResult(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return {
    id,
    jsonrpc: "2.0",
    result,
  }
}

function makeAgentChunk(sessionId: string, text: string): JsonRpcNotification {
  return {
    jsonrpc: "2.0",
    method: "session/update",
    params: {
      sessionId,
      update: {
        content: {
          text,
          type: "text",
        },
        sessionUpdate: "agent_message_chunk",
      },
    },
  }
}

function makeToolCall(sessionId: string, toolCallId: string, title: string): JsonRpcNotification {
  return {
    jsonrpc: "2.0",
    method: "session/update",
    params: {
      sessionId,
      update: {
        kind: "other",
        sessionUpdate: "tool_call",
        status: "pending",
        title,
        toolCallId,
      },
    },
  }
}

function makeToolCallUpdate(
  sessionId: string,
  toolCallId: string,
  status: "cancelled" | "completed" | "in_progress",
) {
  return {
    jsonrpc: "2.0",
    method: "session/update",
    params: {
      sessionId,
      update: {
        sessionUpdate: "tool_call_update",
        status,
        toolCallId,
      },
    },
  } satisfies JsonRpcNotification
}

function ensureAbsolutePath(path: string) {
  return path.startsWith("/")
}

async function ensureParentDir(filePath: string) {
  const lastSlash = filePath.lastIndexOf("/")

  if (lastSlash <= 0) {
    return
  }

  await Deno.mkdir(filePath.slice(0, lastSlash), { recursive: true })
}

async function appendJsonl(filePath: string, record: unknown) {
  await ensureParentDir(filePath)
  await Deno.writeTextFile(filePath, `${JSON.stringify(record)}\n`, {
    append: true,
    create: true,
  })
}

async function readTextIfExists(filePath: string) {
  try {
    return await Deno.readTextFile(filePath)
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return ""
    }

    throw error
  }
}

function parseDotEnvFile(contents: string) {
  const values: Record<string, string> = {}

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith("#")) {
      continue
    }

    const normalized = line.startsWith("export ") ? line.slice("export ".length) : line
    const separator = normalized.indexOf("=")

    if (separator === -1) {
      continue
    }

    const key = normalized.slice(0, separator).trim()
    let value = normalized.slice(separator + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (key) {
      values[key] = value
    }
  }

  return values
}

function normalizePriority(priority: number | null) {
  if (priority === null || priority === 0) {
    return 5
  }

  return priority
}

function isTerminalIssue(issue: LinearIssue) {
  const stateType = issue.stateType.trim().toLowerCase()
  const stateName = issue.stateName.trim().toLowerCase()

  return stateType === "completed" || stateType === "canceled" ||
    stateName === "done" || stateName === "cancelled" || stateName === "canceled"
}

function findTaskSpecBlock(description: string) {
  const match = TASK_SPEC_PATTERN.exec(description)

  if (!match) {
    throw new Error("Issue body is missing an `ACP Task Spec` JSON code block")
  }

  return match[1]
}

function parseTaskSpec(issue: LinearIssue): TaskSpec {
  const raw = JSON.parse(findTaskSpecBlock(issue.description || ""))

  const taskType = String(raw.taskType ?? "").trim().toLowerCase()
  const personas = Array.isArray(raw.personas)
    ? raw.personas.map((value: unknown) => String(value).trim()).filter(Boolean)
    : []
  const blockedBy = Array.isArray(raw.blockedBy)
    ? raw.blockedBy.map((value: unknown) => String(value).trim()).filter(Boolean)
    : []
  const target = raw.target ?? {}
  const oracle = raw.oracle ?? {}
  const url = String(target.url ?? "").trim()
  const method = String(target.method ?? "GET").trim().toUpperCase()
  const instructions = String(raw.instructions ?? "").trim()

  if (!["aging", "exploit", "recon"].includes(taskType)) {
    throw new Error(`Unsupported taskType "${taskType || "<empty>"}"`)
  }

  if (personas.length === 0) {
    throw new Error("Task spec must declare at least one persona")
  }

  if (personas.length > 3) {
    throw new Error("Task spec supports at most 3 personas in this spike")
  }

  if (!url) {
    throw new Error("Task spec target.url is required")
  }

  if (!["GET", "POST"].includes(method)) {
    throw new Error(`Unsupported target method "${method}"`)
  }

  const headers: Record<string, string> = {}
  const rawHeaders = target.headers

  if (rawHeaders && typeof rawHeaders === "object" && !Array.isArray(rawHeaders)) {
    for (const [key, value] of Object.entries(rawHeaders)) {
      headers[key] = String(value)
    }
  }

  return {
    blockedBy,
    instructions,
    oracle: Array.isArray(oracle.expectedSubstrings)
      ? {
        expectedSubstrings: oracle.expectedSubstrings
          .map((value: unknown) => String(value).trim())
          .filter(Boolean),
      }
      : undefined,
    personas,
    target: {
      expectedTitle: target.expectedTitle ? String(target.expectedTitle) : undefined,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      kind: "url",
      method,
      url,
    },
    taskType: taskType as TaskSpec["taskType"],
  }
}

async function readNetworkConfig(filePath: string) {
  const contents = await readTextIfExists(filePath)

  if (!contents.trim()) {
    return {}
  }

  return JSON.parse(contents) as Record<string, unknown>
}

function pickString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return ""
}

async function discoverPersonaSlots(slotRoot: string) {
  const slots: PersonaSlot[] = []

  try {
    for await (const entry of Deno.readDir(slotRoot)) {
      if (!entry.isDirectory) {
        continue
      }

      const slotDir = joinPath(slotRoot, entry.name)
      const envPath = joinPath(slotDir, ".env")
      const networkConfigPath = joinPath(slotDir, "network.json")
      const profileDir = joinPath(slotDir, ".playwright-profile")
      const envValues = parseDotEnvFile(await readTextIfExists(envPath))
      const network = await readNetworkConfig(networkConfigPath)

      slots.push({
        acpUrl: pickString(envValues.ACP_URL, network.acpUrl, network.acp_url),
        envPath,
        id: entry.name,
        mode: pickString(envValues.SLOT_MODE, envValues.MODE, network.slotMode, network.mode).toLowerCase() === "test"
          ? "test"
          : "prod",
        networkConfigPath,
        profileDir,
        proxyUrl: pickString(
          envValues.PROXY_URL,
          network.PROXY_URL,
          network.proxyUrl,
          network.proxy_url,
        ),
        slotDir,
        timezone: pickString(
          envValues.TZ,
          network.TZ,
          network.timeZone,
          network.timezone,
          network.tz,
        ),
      })
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return []
    }

    throw error
  }

  return slots.sort((left, right) => left.id.localeCompare(right.id))
}

async function validatePersonaSlot(slot: PersonaSlot) {
  const errors: string[] = []

  if (!slot.acpUrl) {
    errors.push("Missing ACP_URL")
  }

  if (slot.mode === "prod" && !slot.timezone) {
    errors.push("Missing TZ")
  }

  if (slot.mode === "prod" && !slot.proxyUrl) {
    errors.push("Missing PROXY_URL")
  }

  try {
    const profileStat = await Deno.stat(slot.profileDir)

    if (!profileStat.isDirectory) {
      errors.push("Profile path is not a directory")
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      errors.push("Missing .playwright-profile directory")
    } else {
      throw error
    }
  }

  try {
    await Deno.stat(slot.envPath)
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      errors.push("Missing .env file")
    } else {
      throw error
    }
  }

  try {
    await Deno.stat(slot.networkConfigPath)
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      errors.push("Missing network.json file")
    } else {
      throw error
    }
  }

  return errors
}

function selectQueueTask(issues: readonly LinearIssue[]) {
  const sorted = [...issues]
    .filter((issue) => !isTerminalIssue(issue))
    .sort((left, right) => {
      const priorityDelta = normalizePriority(left.priority) - normalizePriority(right.priority)

      if (priorityDelta !== 0) {
        return priorityDelta
      }

      return left.identifier.localeCompare(right.identifier)
    })

  for (const issue of sorted) {
    const task = parseTaskSpec(issue)
    const blockingIssues = task.blockedBy
      .map((identifier) => sorted.find((candidate) => candidate.identifier === identifier))
      .filter((candidate): candidate is LinearIssue => Boolean(candidate))
      .filter((candidate) => !isTerminalIssue(candidate))

    if (blockingIssues.length > 0) {
      continue
    }

    return {
      issue,
      promptText: `Run ${issue.identifier} as a ${task.taskType} task.`,
      task,
    } satisfies QueueSelection
  }

  return null
}

async function postGraphql<TData>(
  config: AdminConfig,
  services: AdminServices,
  query: string,
  variables: Record<string, unknown>,
) {
  if (!config.linearApiKey) {
    throw new Error("LINEAR_API_KEY is required for live Linear queue access")
  }

  const fetchImpl = services.fetchImpl ?? fetch
  const response = await fetchImpl(config.graphqlEndpoint, {
    method: "POST",
    headers: {
      authorization: config.linearApiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  })
  const json = await response.json()

  if (!response.ok || json.errors?.length) {
    const details = JSON.stringify(json.errors ?? json, null, 2)
    throw new Error(`Linear GraphQL request failed: ${response.status} ${details}`)
  }

  return json.data as TData
}

async function listQueueIssues(config: AdminConfig, services: AdminServices) {
  if (services.linear) {
    const issues = await services.linear.listIssues()

    return issues.filter((issue) => issue.labels.includes(config.queueLabel))
  }

  const data = await postGraphql<{
    issues: {
      nodes: Array<{
        description: string | null
        id: string
        identifier: string
        labels: {
          nodes: Array<{ name: string }>
        }
        priority: number | null
        state: {
          name: string
          type: string
        } | null
        title: string
        updatedAt: string
      }>
    }
  }>(config, services, ISSUE_QUERY, { teamName: config.teamName })

  return data.issues.nodes
    .map((issue) => ({
      description: issue.description ?? "",
      id: issue.id,
      identifier: issue.identifier,
      labels: issue.labels.nodes.map((label) => label.name),
      priority: issue.priority,
      stateName: issue.state?.name ?? "",
      stateType: issue.state?.type ?? "",
      title: issue.title,
      updatedAt: issue.updatedAt,
    }))
    .filter((issue) => issue.labels.includes(config.queueLabel))
}

async function transpileSelection(selection: QueueSelection, config: AdminConfig) {
  const slots = await discoverPersonaSlots(config.slotRoot)
  const personas: PersonaSlot[] = []

  for (const personaId of selection.task.personas) {
    const slot = slots.find((candidate) => candidate.id === personaId)

    if (!slot) {
      throw new Error(`Persona slot "${personaId}" was not found under ${config.slotRoot}`)
    }

    const validationErrors = await validatePersonaSlot(slot)

    if (validationErrors.length > 0) {
      throw new Error(`${personaId}: ${validationErrors.join(", ")}`)
    }

    personas.push(slot)
  }

  return {
    issue: selection.issue,
    personas,
    promptText: selection.promptText,
    task: selection.task,
  } satisfies ConnectionPlan
}

function extractTitle(html: string) {
  const match = /<title>([^<]+)<\/title>/i.exec(html)

  return match?.[1]?.trim() ?? ""
}

function renderWriteback(plan: ConnectionPlan, resultLines: readonly string[]) {
  const joinedPersonas = plan.personas.map((persona) => persona.id).join(", ")
  const joinedModes = Array.from(new Set(plan.personas.map((persona) => persona.mode))).join(", ")
  const targetUrl = plan.task.target.url

  return [
    `ACP spike run for ${plan.issue.identifier}`,
    "",
    `- Task type: ${plan.task.taskType}`,
    `- Slot mode: ${joinedModes}`,
    `- Personas: ${joinedPersonas}`,
    `- Target: ${targetUrl}`,
    ...resultLines.map((line) => `- ${line}`),
  ].join("\n")
}

function extractAcpResult(messages: readonly AcpMessage[]) {
  return messages.find((message) => "result" in message && message.result !== undefined) as JsonRpcResponse | undefined
}

function collectAgentChunks(messages: readonly AcpMessage[]) {
  return messages
    .filter((message) => "method" in message && message.method === "session/update")
    .map((message) => (message as JsonRpcNotification).params as { update?: Record<string, unknown> } | undefined)
    .map((params) => params?.update)
    .filter((update): update is Record<string, unknown> => Boolean(update))
    .filter((update) => update.sessionUpdate === "agent_message_chunk")
    .map((update) => {
      const content = update.content as { text?: string } | undefined

      return content?.text?.trim() ?? ""
    })
    .filter(Boolean)
}

function buildDownstreamPrompt(plan: ConnectionPlan, persona: PersonaSlot) {
  const lines = [
    `Issue: ${plan.issue.identifier} — ${plan.issue.title}`,
    `Task type: ${plan.task.taskType}`,
    `Persona: ${persona.id}`,
    `Slot mode: ${persona.mode}`,
    `Timezone: ${persona.timezone}`,
    `Proxy URL: ${persona.proxyUrl}`,
    `Target URL: ${plan.task.target.url}`,
    `Target method: ${plan.task.target.method ?? "GET"}`,
  ]

  if (plan.task.target.expectedTitle) {
    lines.push(`Expected title: ${plan.task.target.expectedTitle}`)
  }

  if (plan.task.instructions) {
    lines.push(`Instructions: ${plan.task.instructions}`)
  }

  const headers = plan.task.target.headers
  if (headers && Object.keys(headers).length > 0) {
    lines.push(`Target headers: ${JSON.stringify(headers)}`)
  }

  return lines.join("\n")
}

function scoreOracle(task: TaskSpec, summary: string) {
  const expectedSubstrings = task.oracle?.expectedSubstrings ?? []

  if (expectedSubstrings.length === 0) {
    return null
  }

  const missing = expectedSubstrings.filter((value) => !summary.includes(value))

  return {
    expected: expectedSubstrings.length,
    missing,
    passed: missing.length === 0,
  }
}

async function postAcp(
  url: string,
  payload: JsonRpcRequest,
  fetchImpl: typeof fetch,
) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`ACP request failed: ${response.status}`)
  }

  return readNdjson(response)
}

async function runDownstreamPersonaSession(
  plan: ConnectionPlan,
  persona: PersonaSlot,
  fetchImpl: typeof fetch,
  config: AdminConfig,
) {
  const initializeMessages = await postAcp(
    persona.acpUrl,
    {
      id: 0,
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        clientCapabilities: {
          fs: {
            readTextFile: false,
            writeTextFile: false,
          },
          terminal: false,
        },
        clientInfo: {
          name: "tidelands-admin",
          title: "Tidelands Admin ACP",
          version: "0.2.0",
        },
        protocolVersion: config.protocolVersion,
      },
    },
    fetchImpl,
  )
  const initializeResult = extractAcpResult(initializeMessages)

  if (!initializeResult?.result) {
    throw new Error(`ACP initialize failed for ${persona.id}`)
  }

  const sessionMessages = await postAcp(
    persona.acpUrl,
    {
      id: 1,
      jsonrpc: "2.0",
      method: "session/new",
      params: {
        cwd: persona.slotDir,
        mcpServers: [],
      },
    },
    fetchImpl,
  )
  const sessionResult = extractAcpResult(sessionMessages)
  const downstreamSessionId = String((sessionResult?.result as { sessionId?: string } | undefined)?.sessionId ?? "")

  if (!downstreamSessionId) {
    throw new Error(`ACP session/new failed for ${persona.id}`)
  }

  const promptMessages = await postAcp(
    persona.acpUrl,
    {
      id: 2,
      jsonrpc: "2.0",
      method: "session/prompt",
      params: {
        prompt: [
          {
            text: buildDownstreamPrompt(plan, persona),
            type: "text",
          },
        ],
        sessionId: downstreamSessionId,
      },
    },
    fetchImpl,
  )
  const promptResult = extractAcpResult(promptMessages)
  const stopReason = String((promptResult?.result as { stopReason?: string } | undefined)?.stopReason ?? "")

  if (stopReason !== "end_turn" && stopReason !== "cancelled") {
    throw new Error(`ACP session/prompt returned invalid stopReason for ${persona.id}`)
  }

  const summary = collectAgentChunks(promptMessages).join("\n").trim()

  if (!summary) {
    throw new Error(`ACP session/prompt returned no agent summary for ${persona.id}`)
  }

  const record = {
    acpUrl: persona.acpUrl,
    issueIdentifier: plan.issue.identifier,
    personaId: persona.id,
    sessionId: downstreamSessionId,
    stopReason,
    summary,
  }
  await appendJsonl(joinPath(config.runtimeDir, "persona-sessions.jsonl"), record)

  return {
    sessionId: downstreamSessionId,
    stopReason,
    summary,
  } satisfies DownstreamSessionResult
}

async function recordWriteback(
  plan: ConnectionPlan,
  body: string,
  config: AdminConfig,
  services: AdminServices,
) {
  const record = {
    body,
    issueId: plan.issue.id,
    issueIdentifier: plan.issue.identifier,
    mode: config.writebackMode,
    recordedAt: new Date((services.now ?? Date.now)()).toISOString(),
  }

  if (config.writebackMode === "live") {
    if (services.linear?.createComment) {
      const created = await services.linear.createComment(plan.issue.id, body)

      await appendJsonl(joinPath(config.runtimeDir, "writebacks.jsonl"), {
        ...record,
        commentId: created.commentId,
      })

      return
    }

    const data = await postGraphql<{
      commentCreate: {
        comment: { id: string | null } | null
      } | null
    }>(
      config,
      services,
      COMMENT_CREATE_MUTATION,
      {
        input: {
          body,
          issueId: plan.issue.id,
        },
      },
    )

    await appendJsonl(joinPath(config.runtimeDir, "writebacks.jsonl"), {
      ...record,
      commentId: data.commentCreate?.comment?.id ?? null,
    })

    return
  }

  await appendJsonl(joinPath(config.runtimeDir, "writebacks.jsonl"), record)
}

async function runQueueTask(
  session: SessionRecord,
  config: AdminConfig,
  services: AdminServices,
): Promise<PromptTurnResult> {
  const queueIssues = await listQueueIssues(config, services)
  const selected = selectQueueTask(queueIssues)

  if (!selected) {
    return {
      messages: [
        makeAgentChunk(
          session.sessionId,
          `No eligible ${config.teamName} issues labeled \`${config.queueLabel}\` are available.`,
        ),
      ],
      stopReason: "end_turn",
    }
  }

  let plan: ConnectionPlan

  try {
    plan = await transpileSelection(selected, config)
  } catch (error) {
    return {
      messages: [
        makeAgentChunk(
          session.sessionId,
          `Fail-fast aborted ${selected.issue.identifier}: ${error instanceof Error ? error.message : String(error)}`,
        ),
      ],
      stopReason: "end_turn",
    }
  }

  const notifications: AcpMessage[] = [
    makeAgentChunk(
      session.sessionId,
      `Selected ${plan.issue.identifier} (${plan.task.taskType}) for ${plan.personas.map((persona) => persona.id).join(", ")}.`,
    ),
  ]

  const fetchImpl = services.fetchImpl ?? fetch
  const resultLines: string[] = []
  const executeForPersona = async (persona: PersonaSlot) => {
    const toolCallId = `acp_${persona.id}`

    notifications.push(makeToolCall(session.sessionId, toolCallId, `Run downstream ACP task as ${persona.id}`))
    notifications.push(makeToolCallUpdate(session.sessionId, toolCallId, "in_progress"))

    const downstream = await runDownstreamPersonaSession(plan, persona, fetchImpl, config)
    const oracle = scoreOracle(plan.task, downstream.summary)

    notifications.push(makeToolCallUpdate(session.sessionId, toolCallId, "completed"))

    const pieces = [`${persona.id}: ${persona.mode}, ${downstream.stopReason}, ${downstream.summary}`]

    if (oracle) {
      pieces.push(
        oracle.passed
          ? `oracle PASS ${oracle.expected}/${oracle.expected}`
          : `oracle FAIL missing ${oracle.missing.join(", ")}`,
      )
    }

    return pieces.join(" | ")
  }

  try {
    if (plan.task.taskType === "exploit" && plan.personas.length > 1) {
      resultLines.push(...await Promise.all(plan.personas.map((persona) => executeForPersona(persona))))
    } else {
      for (const persona of plan.personas) {
        if (session.cancelRequested) {
          notifications.push(makeAgentChunk(session.sessionId, "Prompt turn cancelled by client."))

          return {
            messages: notifications,
            stopReason: "cancelled",
          }
        }

        resultLines.push(await executeForPersona(persona))
      }
    }
  } catch (error) {
    notifications.push(
      makeAgentChunk(
        session.sessionId,
        `Execution failed for ${plan.issue.identifier}: ${error instanceof Error ? error.message : String(error)}`,
      ),
    )

    return {
      messages: notifications,
      stopReason: "end_turn",
    }
  }

  const writebackBody = renderWriteback(plan, resultLines)
  await recordWriteback(plan, writebackBody, config, services)

  notifications.push(makeAgentChunk(session.sessionId, writebackBody))

  return {
    messages: notifications,
    stopReason: "end_turn",
    writebackBody,
  }
}

function renderDashboard(req: Request, config: AdminConfig) {
  const url = new URL(req.url)
  const email = req.headers.get("Remote-Email") ?? "unknown"
  const host = req.headers.get("Host") ?? "unknown"
  const requestId = req.headers.get("X-Request-Id") ?? "n/a"
  const forwardedFor = req.headers.get("X-Forwarded-For") ?? "n/a"

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Smallweb Admin ACP</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f3efe5;
        --panel: rgba(255, 250, 242, 0.92);
        --ink: #1f1a17;
        --muted: #6b5e53;
        --line: #d9c5ad;
        --accent: #b5542b;
        --accent-soft: rgba(181, 84, 43, 0.12);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top left, rgba(181, 84, 43, 0.18), transparent 28%),
          radial-gradient(circle at bottom right, rgba(51, 94, 115, 0.14), transparent 30%),
          linear-gradient(180deg, #f7f2ea 0%, var(--bg) 100%);
        color: var(--ink);
        font: 16px/1.5 Georgia, "Times New Roman", serif;
      }
      main {
        max-width: 960px;
        margin: 0 auto;
        padding: 48px 20px 72px;
      }
      .eyebrow {
        margin: 0 0 14px;
        color: var(--accent);
        font: 700 0.78rem/1.2 "Courier New", monospace;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        font-size: clamp(2.6rem, 7vw, 5rem);
        line-height: 0.94;
        letter-spacing: -0.045em;
      }
      .lede {
        max-width: 42rem;
        margin: 18px 0 0;
        color: var(--muted);
        font-size: 1.05rem;
      }
      .grid {
        display: grid;
        gap: 18px;
        margin-top: 28px;
      }
      .panel {
        padding: 22px;
        border: 1px solid var(--line);
        border-radius: 20px;
        background: var(--panel);
        box-shadow: 0 18px 40px rgba(64, 45, 28, 0.08);
      }
      .panel h2 {
        margin: 0 0 10px;
        font-size: 1rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
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
        padding: 0.15rem 0.35rem;
        border-radius: 999px;
        background: var(--accent-soft);
        font: 0.92rem/1.3 "Courier New", monospace;
      }
      ul {
        margin: 0;
        padding-left: 1.2rem;
      }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">Authenticated Admin Surface</p>
      <h1>Smallweb Admin ACP</h1>
      <p class="lede">
        This app now exposes a minimal ACP session surface at <code>/acp</code>. The same
        session machinery powers ACP-driven tests and <code>smallweb run admin</code>.
      </p>
      <section class="grid">
        <article class="panel">
          <h2>Session</h2>
          <dl>
            <dt>Remote Email</dt>
            <dd><code>${escapeHtml(email)}</code></dd>
            <dt>Host</dt>
            <dd>${escapeHtml(host)}</dd>
            <dt>Path</dt>
            <dd>${escapeHtml(url.pathname)}</dd>
            <dt>Request Id</dt>
            <dd>${escapeHtml(requestId)}</dd>
            <dt>Forwarded For</dt>
            <dd>${escapeHtml(forwardedFor)}</dd>
          </dl>
        </article>
        <article class="panel">
          <h2>Runtime</h2>
          <dl>
            <dt>Queue Label</dt>
            <dd><code>${escapeHtml(config.queueLabel)}</code></dd>
            <dt>Team</dt>
            <dd>${escapeHtml(config.teamName)}</dd>
            <dt>Slot Root</dt>
            <dd><code>${escapeHtml(config.slotRoot)}</code></dd>
            <dt>Writeback</dt>
            <dd>${escapeHtml(config.writebackMode)}</dd>
          </dl>
        </article>
        <article class="panel">
          <h2>Smoke Targets</h2>
          <ul>
            <li><code>/healthz</code> stays public for load balancer checks.</li>
            <li><code>/acp</code> accepts ACP-flavored JSON-RPC over NDJSON responses.</li>
            <li><code>smallweb run admin</code> boots the same session lifecycle without HTTP.</li>
          </ul>
        </article>
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

export function loadConfig(env = Deno.env.toObject()): AdminConfig {
  const runtimeDir = env.ADMIN_RUNTIME_DIR?.trim() || `${Deno.cwd()}/data`
  const slotRoot = env.TIDELANE_SLOT_ROOT?.trim() || `${Deno.cwd()}/slots`
  const writebackMode = (env.ADMIN_WRITEBACK_MODE?.trim().toLowerCase() || "dry-run") === "live"
    ? "live"
    : "dry-run"

  return {
    graphqlEndpoint: env.LINEAR_GRAPHQL_ENDPOINT ?? "https://api.linear.app/graphql",
    linearApiKey: env.LINEAR_API_KEY ?? "",
    protocolVersion: ACP_PROTOCOL_VERSION,
    queueLabel: env.LINEAR_TEST_LABEL?.trim() || "test",
    runtimeDir,
    slotRoot,
    teamName: env.ADMIN_LINEAR_TEAM?.trim() || "Planning",
    writebackMode,
  }
}

type CreateAdminAppOptions = {
  config?: AdminConfig
  services?: AdminServices
}

export function createAdminApp(options: CreateAdminAppOptions = {}) {
  const config = options.config ?? loadConfig()
  const services = options.services ?? {}
  const sessions = new Map<string, SessionRecord>()

  const handleAcpRequest = async (request: JsonRpcRequest): Promise<AcpMessage[]> => {
    const id = request.id ?? null

    if (request.jsonrpc !== "2.0") {
      return [makeError(id, -32600, "Invalid Request", "jsonrpc must be 2.0")]
    }

    if (!request.method) {
      return [makeError(id, -32600, "Invalid Request", "method is required")]
    }

    switch (request.method) {
      case "initialize": {
        const protocolVersion = Number((request.params as { protocolVersion?: unknown } | undefined)?.protocolVersion)

        return [
          makeResult(id, {
            agentCapabilities: {
              loadSession: false,
              mcpCapabilities: {
                http: false,
                sse: false,
              },
              promptCapabilities: {
                audio: false,
                embeddedContext: false,
                image: false,
              },
              sessionCapabilities: {},
            },
            agentInfo: {
              name: "tidelands-admin",
              title: "Tidelands Admin ACP",
              version: "0.1.0",
            },
            authMethods: [],
            protocolVersion: Number.isFinite(protocolVersion) ? Math.min(protocolVersion, config.protocolVersion) : config.protocolVersion,
          }),
        ]
      }

      case "session/new": {
        const params = request.params as SessionNewParams | undefined

        if (!params || typeof params.cwd !== "string" || !ensureAbsolutePath(params.cwd)) {
          return [makeError(id, -32602, "Invalid params", "session/new requires an absolute cwd")]
        }

        if (!Array.isArray(params.mcpServers)) {
          return [makeError(id, -32602, "Invalid params", "session/new requires mcpServers")]
        }

        const sessionId = `sess_${crypto.randomUUID()}`
        sessions.set(sessionId, {
          cancelRequested: false,
          createdAt: new Date((services.now ?? Date.now)()).toISOString(),
          cwd: params.cwd,
          mcpServers: params.mcpServers,
          prompts: [],
          sessionId,
        })

        await appendJsonl(joinPath(config.runtimeDir, "sessions.jsonl"), {
          createdAt: new Date((services.now ?? Date.now)()).toISOString(),
          cwd: params.cwd,
          mcpServers: params.mcpServers,
          sessionId,
        })

        return [
          makeResult(id, {
            sessionId,
          }),
        ]
      }

      case "session/prompt": {
        const params = request.params as SessionPromptParams | undefined

        if (!params || typeof params.sessionId !== "string" || !Array.isArray(params.prompt)) {
          return [makeError(id, -32602, "Invalid params", "session/prompt requires sessionId and prompt[]")]
        }

        const session = sessions.get(params.sessionId)

        if (!session) {
          return [makeError(id, -32001, "Unknown session", params.sessionId)]
        }

        const promptText = params.prompt
          .filter((content) => content?.type === "text")
          .map((content) => content.text)
          .join("\n")
          .trim()

        session.cancelRequested = false
        session.prompts.push(promptText)

        let promptTurn: PromptTurnResult

        try {
          promptTurn = await runQueueTask(session, config, services)
        } catch (error) {
          promptTurn = {
            messages: [
              makeAgentChunk(
                session.sessionId,
                `Prompt failed: ${error instanceof Error ? error.message : String(error)}`,
              ),
            ],
            stopReason: "end_turn",
          }
        }

        return [
          ...promptTurn.messages,
          makeResult(id, {
            stopReason: promptTurn.stopReason,
          }),
        ]
      }

      case "session/cancel": {
        const params = request.params as { sessionId?: string } | undefined

        if (!params?.sessionId || !sessions.has(params.sessionId)) {
          return []
        }

        const session = sessions.get(params.sessionId)

        if (session) {
          session.cancelRequested = true
        }

        return []
      }

      default:
        return [makeError(id, -32601, "Method not found", request.method)]
    }
  }

  const fetchHandler = async (req: Request) => {
    const url = new URL(req.url)

    if (url.pathname === "/healthz" || url.pathname === "/readyz") {
      return json({
        acpPath: "/acp",
        app: "admin",
        ok: true,
        path: url.pathname,
      })
    }

    if (url.pathname === "/api/session") {
      return json({
        acpPath: "/acp",
        host: req.headers.get("Host"),
        path: url.pathname,
        remoteEmail: req.headers.get("Remote-Email"),
      })
    }

    if (url.pathname === "/acp" && req.method === "GET") {
      return json({
        contentType: "application/x-ndjson",
        protocolVersion: config.protocolVersion,
        queueLabel: config.queueLabel,
      })
    }

    if (url.pathname === "/acp" && req.method === "POST") {
      let payload: JsonRpcRequest

      try {
        payload = await req.json()
      } catch (_error) {
        return ndjson([makeError(null, -32700, "Parse error")])
      }

      return ndjson(await handleAcpRequest(payload))
    }

    return renderDashboard(req, config)
  }

  const runCliSession = async (args: string[]) => {
    const initializeMessages = await handleAcpRequest({
      id: 0,
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        clientCapabilities: {
          fs: {
            readTextFile: false,
            writeTextFile: false,
          },
          terminal: false,
        },
        clientInfo: {
          name: "smallweb-runner",
          title: "Smallweb Runner",
          version: "0.1.0",
        },
        protocolVersion: ACP_PROTOCOL_VERSION,
      },
    })
    const newSessionMessages = await handleAcpRequest({
      id: 1,
      jsonrpc: "2.0",
      method: "session/new",
      params: {
        cwd: Deno.cwd(),
        mcpServers: [],
      },
    })
    const newSessionResponse = newSessionMessages.find((message) => "result" in message) as JsonRpcResponse | undefined
    const sessionId = String((newSessionResponse?.result as { sessionId?: string } | undefined)?.sessionId ?? "")

    if (!sessionId) {
      return [...initializeMessages, ...newSessionMessages]
    }

    const promptMessages = await handleAcpRequest({
      id: 2,
      jsonrpc: "2.0",
      method: "session/prompt",
      params: {
        prompt: [
          {
            text: args.join(" ").trim() || "Run the next Planning fixture task.",
            type: "text",
          },
        ],
        sessionId,
      },
    })

    return [...initializeMessages, ...newSessionMessages, ...promptMessages]
  }

  return {
    config,
    fetch: fetchHandler,
    handleAcpRequest,
    async run(args: string[]) {
      const messages = await runCliSession(args)

      for (const message of messages) {
        console.log(JSON.stringify(message))
      }
    },
    runCliSession,
  }
}
