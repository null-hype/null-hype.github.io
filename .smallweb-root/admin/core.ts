type JsonRpcId = number | string | null;

type JsonRpcError = {
  code: number;
  data?: unknown;
  message: string;
};

type JsonRpcRequest = {
  id?: JsonRpcId;
  jsonrpc?: string;
  method?: string;
  params?: unknown;
};

type JsonRpcResponse = {
  error?: JsonRpcError;
  id: JsonRpcId;
  jsonrpc: "2.0";
  result?: unknown;
};

type JsonRpcNotification = {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
};

type AcpMessage = JsonRpcNotification | JsonRpcResponse;

type TextContentBlock = {
  text: string;
  type: "text";
};

type SessionPromptParams = {
  prompt: TextContentBlock[];
  sessionId: string;
};

type SessionNewParams = {
  cwd: string;
  mcpServers: unknown[];
};

type AcpEnvVariable = {
  name: string;
  value: string;
};

type GooseCommandStatus = {
  code: number;
  signal: string | null;
  success: boolean;
};

type GooseChildProcess = {
  kill: (signal?: Deno.Signal) => void;
  stderr?: ReadableStream<Uint8Array>;
  stdin: WritableStream<Uint8Array>;
  stdout: ReadableStream<Uint8Array>;
  status: Promise<GooseCommandStatus>;
};

export type AcpStdioMcpServer = {
  args: string[];
  command: string;
  env: AcpEnvVariable[];
  name: string;
};

export type LinearIssue = {
  description: string;
  id: string;
  identifier: string;
  labels: string[];
  priority: number | null;
  stateName: string;
  stateType: string;
  title: string;
  updatedAt: string;
};

type TaskSpec = {
  blockedBy: string[];
  instructions: string;
  personas: string[];
  target: {
    expectedTitle?: string;
    headers?: Record<string, string>;
    kind?: "url";
    method?: string;
    url: string;
  };
  taskType: "aging" | "exploit" | "recon";
};

type PersonaSlot = {
  acpUrl: string;
  envPath: string;
  id: string;
  networkConfigPath: string;
  profileDir: string;
  proxyUrl: string;
  slotDir: string;
  timezone: string;
};

type ConnectionPlan = {
  issue: LinearIssue;
  personas: PersonaSlot[];
  promptText: string;
  task: TaskSpec;
};

type DownstreamSessionResult = {
  sessionId: string;
  stopReason: "cancelled" | "end_turn";
  summary: string;
};

type PromptTurnResult = {
  messages: AcpMessage[];
  stopReason: "cancelled" | "end_turn";
  writebackBody?: string;
};

type SessionRecord = {
  cancelRequested: boolean;
  createdAt: string;
  cwd: string;
  mcpServers: unknown[];
  prompts: string[];
  sessionId: string;
};

type GooseBridgeSession = {
  activeSocket?: WebSocket;
  createdAt: string;
  exit?: GooseCommandStatus;
  idleTimer?: ReturnType<typeof setTimeout>;
  lastConnectedAt?: string;
  process?: GooseChildProcess;
  sessionId: string;
  status: "created" | "exited" | "running";
  stdinWriter?: WritableStreamDefaultWriter<Uint8Array>;
  upstreamQueue?: WebSocketPayload[];
  upstreamSocket?: WebSocket;
};

type QueueSelection = {
  issue: LinearIssue;
  promptText: string;
  task: TaskSpec;
};

export type AdminConfig = {
  defaultMcpServers: AcpStdioMcpServer[];
  gooseArgs: string[];
  gooseCommand: string;
  gooseEnv: Record<string, string>;
  gooseIdleTimeoutMs: number;
  gooseSessionCwd: string;
  gooseWsUrl: string;
  graphqlEndpoint: string;
  linearApiKey: string;
  protocolVersion: number;
  queueLabel: string;
  runtimeDir: string;
  slotRoot: string;
  teamName: string;
  writebackMode: "dry-run" | "live";
};

type LinearService = {
  createComment?: (
    issueId: string,
    body: string,
  ) => Promise<{ commentId: string | null }>;
  listIssues: () => Promise<LinearIssue[]>;
};

export type AdminServices = {
  fetchImpl?: typeof fetch;
  gooseSpawner?: (config: AdminConfig) => GooseChildProcess;
  linear?: LinearService;
  logger?: {
    error: (...args: unknown[]) => void;
    info?: (...args: unknown[]) => void;
  };
  now?: () => number;
};

type WebSocketPayload = string | ArrayBuffer;

const ACP_PROTOCOL_VERSION = 1;
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
`;

const COMMENT_CREATE_MUTATION = `
  mutation CommentCreate($input: CommentCreateInput!) {
    commentCreate(input: $input) {
      success
      comment {
        id
      }
    }
  }
`;

const TASK_SPEC_PATTERN = /##\s*ACP Task Spec\s*```json\s*([\s\S]*?)```/i;

function joinPath(dir: string, fileName: string) {
  return `${dir.replace(/\/$/, "")}/${fileName}`;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function corsHeaders(req: Request) {
  return {
    "access-control-allow-headers": req.headers.get(
        "access-control-request-headers",
      ) ?? "content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-origin": req.headers.get("origin") ?? "*",
    "access-control-max-age": "600",
    "vary": "Origin, Access-Control-Request-Headers",
  };
}

function jsonWithHeaders(
  data: unknown,
  status: number,
  headers: Record<string, string>,
) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function ndjson(messages: readonly AcpMessage[]) {
  const body = messages.map((message) => JSON.stringify(message)).join("\n");

  return new Response(body.length > 0 ? `${body}\n` : "", {
    headers: {
      "cache-control": "no-store",
      "content-type": "application/x-ndjson; charset=utf-8",
    },
  });
}

async function readNdjson(response: Response) {
  const body = await response.text();

  if (!body.trim()) {
    return [];
  }

  return body
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AcpMessage);
}

async function websocketMessageBytes(message: MessageEvent["data"]) {
  if (typeof message === "string") {
    const text = message.endsWith("\n") ? message : `${message}\n`;
    return new TextEncoder().encode(text);
  }

  if (message instanceof ArrayBuffer) {
    return new Uint8Array(message);
  }

  if (message instanceof Blob) {
    return new Uint8Array(await message.arrayBuffer());
  }

  return null;
}

async function websocketMessagePayload(
  message: MessageEvent["data"],
): Promise<string | null> {
  if (typeof message === "string") {
    return message.endsWith("\n") ? message : `${message}\n`;
  }

  if (message instanceof ArrayBuffer) {
    const text = new TextDecoder().decode(message);
    return text.endsWith("\n") ? text : `${text}\n`;
  }

  if (message instanceof Blob) {
    const text = await message.text();
    return text.endsWith("\n") ? text : `${text}\n`;
  }

  return null;
}

function makeWebSocketUrl(req: Request, pathname: string) {
  const url = new URL(req.url);
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const isSecure = forwardedProto
    ? forwardedProto.split(",")[0].trim() === "https"
    : url.protocol === "https:";
  url.protocol = isSecure ? "wss:" : "ws:";
  url.pathname = pathname;
  url.search = "";
  url.hash = "";

  return url.toString();
}

function escapeHtml(value: string) {
 return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function makeError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return {
    id,
    jsonrpc: "2.0",
    error: {
      code,
      data,
      message,
    },
  };
}

function makeResult(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return {
    id,
    jsonrpc: "2.0",
    result,
  };
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
  };
}

function makeToolCall(
  sessionId: string,
  toolCallId: string,
  title: string,
): JsonRpcNotification {
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
  };
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
  } satisfies JsonRpcNotification;
}

function ensureAbsolutePath(path: string) {
  return path.startsWith("/");
}

function isTruthy(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "").trim().toLowerCase(),
  );
}

function parseArgs(value: string | undefined, fallback: string[]) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed.split(/\s+/).filter(Boolean);
}

function normalizeGooseServeUrl(value: string | undefined) {
  const raw = value?.trim();

  if (!raw) {
    return "";
  }

  const url = new URL(raw);

  if (url.protocol === "http:") {
    url.protocol = "ws:";
  } else if (url.protocol === "https:") {
    url.protocol = "wss:";
  } else if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error(
      "ADMIN_GOOSE_SERVE_URL must use http, https, ws, or wss",
    );
  }

  if (url.pathname === "/") {
    url.pathname = "/acp";
  }

  return url.toString();
}

function loadGooseWebSocketUrl(env: Record<string, string | undefined>) {
  const explicit = env.ADMIN_GOOSE_WS_URL?.trim();

  if (explicit) {
    return normalizeGooseServeUrl(explicit);
  }

  return normalizeGooseServeUrl(env.ADMIN_GOOSE_SERVE_URL);
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function getMcpServerName(server: unknown) {
  if (!server || typeof server !== "object") {
    return "";
  }

  const name = (server as { name?: unknown }).name;

  return typeof name === "string" ? name.trim() : "";
}

function mergeMcpServers(
  defaults: readonly AcpStdioMcpServer[],
  provided: readonly unknown[],
) {
  const named = new Map<string, unknown>();
  const unnamed: unknown[] = [];

  for (const server of [...defaults, ...provided]) {
    const name = getMcpServerName(server);

    if (!name) {
      unnamed.push(server);
      continue;
    }

    named.set(name, server);
  }

  return [...named.values(), ...unnamed];
}

function loadDefaultMcpServers(
  env: Record<string, string | undefined>,
): AcpStdioMcpServer[] {
  const daggerCommand = (env.ADMIN_DAGGER_COMMAND ?? env.DAGGER_COMMAND ??
    env.DAGGER_BIN ?? "").trim();
  const daggerModule = (env.ADMIN_DAGGER_MODULE ?? env.DAGGER_MODULE ?? "")
    .trim();
  const daggerEnabled = isTruthy(env.ADMIN_DAGGER_MCP) ||
    Boolean(daggerCommand || daggerModule);

  if (!daggerEnabled) {
    return [];
  }

  if (!daggerCommand) {
    throw new Error(
      "ADMIN_DAGGER_COMMAND is required when ADMIN_DAGGER_MCP is enabled",
    );
  }

  if (!daggerModule) {
    throw new Error(
      "ADMIN_DAGGER_MODULE is required when ADMIN_DAGGER_MCP is enabled",
    );
  }

  if (!ensureAbsolutePath(daggerCommand)) {
    throw new Error("ADMIN_DAGGER_COMMAND must be an absolute path");
  }

  if (!ensureAbsolutePath(daggerModule)) {
    throw new Error("ADMIN_DAGGER_MODULE must be an absolute path");
  }

  return [
    {
      args: ["--silent", "mcp", "--mod", daggerModule, "--stdio"],
      command: daggerCommand,
      env: [],
      name: "dagger",
    },
  ];
}

function loadGooseEnv(env: Record<string, string | undefined>) {
  const gooseEnv: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith("GOOSE_") && value !== undefined) {
      gooseEnv[key] = value;
    }
  }

  const home = env.ADMIN_GOOSE_HOME?.trim();
  const xdgConfigHome = env.ADMIN_GOOSE_XDG_CONFIG_HOME?.trim();
  const xdgStateHome = env.ADMIN_GOOSE_XDG_STATE_HOME?.trim();
  const xdgCacheHome = env.ADMIN_GOOSE_XDG_CACHE_HOME?.trim();

  if (home) {
    gooseEnv.HOME = home;
  }

  if (xdgConfigHome) {
    gooseEnv.XDG_CONFIG_HOME = xdgConfigHome;
  }

  if (xdgStateHome) {
    gooseEnv.XDG_STATE_HOME = xdgStateHome;
  }

  if (xdgCacheHome) {
    gooseEnv.XDG_CACHE_HOME = xdgCacheHome;
  }

  const openrouterApiKey = env.OPENROUTER_API_KEY?.trim();
  if (openrouterApiKey) {
    gooseEnv.OPENROUTER_API_KEY = openrouterApiKey;
  }

  return gooseEnv;
}

async function ensureParentDir(filePath: string) {
  const lastSlash = filePath.lastIndexOf("/");

  if (lastSlash <= 0) {
    return;
  }

  await Deno.mkdir(filePath.slice(0, lastSlash), { recursive: true });
}

async function appendJsonl(filePath: string, record: unknown) {
  await ensureParentDir(filePath);
  await Deno.writeTextFile(filePath, `${JSON.stringify(record)}\n`, {
    append: true,
    create: true,
  });
}

async function readTextIfExists(filePath: string) {
  try {
    return await Deno.readTextFile(filePath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return "";
    }

    throw error;
  }
}

function parseDotEnvFile(contents: string) {
  const values: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalized = line.startsWith("export ")
      ? line.slice("export ".length)
      : line;
    const separator = normalized.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = normalized.slice(0, separator).trim();
    let value = normalized.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      values[key] = value;
    }
  }

  return values;
}

function normalizePriority(priority: number | null) {
  if (priority === null || priority === 0) {
    return 5;
  }

  return priority;
}

function isTerminalIssue(issue: LinearIssue) {
  const stateType = issue.stateType.trim().toLowerCase();
  const stateName = issue.stateName.trim().toLowerCase();

  return stateType === "completed" || stateType === "canceled" ||
    stateName === "done" || stateName === "cancelled" ||
    stateName === "canceled";
}

function findTaskSpecBlock(description: string) {
  const match = TASK_SPEC_PATTERN.exec(description);

  if (!match) {
    throw new Error("Issue body is missing an `ACP Task Spec` JSON code block");
  }

  return match[1];
}

function parseTaskSpec(issue: LinearIssue): TaskSpec {
  const raw = JSON.parse(findTaskSpecBlock(issue.description || ""));

  const taskType = String(raw.taskType ?? "").trim().toLowerCase();
  const personas = Array.isArray(raw.personas)
    ? raw.personas.map((value: unknown) => String(value).trim()).filter(Boolean)
    : [];
  const blockedBy = Array.isArray(raw.blockedBy)
    ? raw.blockedBy.map((value: unknown) => String(value).trim()).filter(
      Boolean,
    )
    : [];
  const target = raw.target ?? {};
  const url = String(target.url ?? "").trim();
  const method = String(target.method ?? "GET").trim().toUpperCase();
  const instructions = String(raw.instructions ?? "").trim();

  if (!["aging", "exploit", "recon"].includes(taskType)) {
    throw new Error(`Unsupported taskType "${taskType || "<empty>"}"`);
  }

  if (personas.length === 0) {
    throw new Error("Task spec must declare at least one persona");
  }

  if (personas.length > 3) {
    throw new Error("Task spec supports at most 3 personas in this spike");
  }

  if (!url) {
    throw new Error("Task spec target.url is required");
  }

  if (!["GET", "POST"].includes(method)) {
    throw new Error(`Unsupported target method "${method}"`);
  }

  const headers: Record<string, string> = {};
  const rawHeaders = target.headers;

  if (
    rawHeaders && typeof rawHeaders === "object" && !Array.isArray(rawHeaders)
  ) {
    for (const [key, value] of Object.entries(rawHeaders)) {
      headers[key] = String(value);
    }
  }

  return {
    blockedBy,
    instructions,
    personas,
    target: {
      expectedTitle: target.expectedTitle
        ? String(target.expectedTitle)
        : undefined,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      kind: "url",
      method,
      url,
    },
    taskType: taskType as TaskSpec["taskType"],
  };
}

async function readNetworkConfig(filePath: string) {
  const contents = await readTextIfExists(filePath);

  if (!contents.trim()) {
    return {};
  }

  return JSON.parse(contents) as Record<string, unknown>;
}

function pickString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

async function discoverPersonaSlots(slotRoot: string) {
  const slots: PersonaSlot[] = [];

  try {
    for await (const entry of Deno.readDir(slotRoot)) {
      if (!entry.isDirectory) {
        continue;
      }

      const slotDir = joinPath(slotRoot, entry.name);
      const envPath = joinPath(slotDir, ".env");
      const networkConfigPath = joinPath(slotDir, "network.json");
      const profileDir = joinPath(slotDir, ".playwright-profile");
      const envValues = parseDotEnvFile(await readTextIfExists(envPath));
      const network = await readNetworkConfig(networkConfigPath);

      slots.push({
        acpUrl: pickString(envValues.ACP_URL, network.acpUrl, network.acp_url),
        envPath,
        id: entry.name,
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
      });
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return [];
    }

    throw error;
  }

  return slots.sort((left, right) => left.id.localeCompare(right.id));
}

async function validatePersonaSlot(slot: PersonaSlot) {
  const errors: string[] = [];

  if (!slot.acpUrl) {
    errors.push("Missing ACP_URL");
  }

  if (!slot.timezone) {
    errors.push("Missing TZ");
  }

  if (!slot.proxyUrl) {
    errors.push("Missing PROXY_URL");
  }

  try {
    const profileStat = await Deno.stat(slot.profileDir);

    if (!profileStat.isDirectory) {
      errors.push("Profile path is not a directory");
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      errors.push("Missing .playwright-profile directory");
    } else {
      throw error;
    }
  }

  try {
    await Deno.stat(slot.envPath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      errors.push("Missing .env file");
    } else {
      throw error;
    }
  }

  try {
    await Deno.stat(slot.networkConfigPath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      errors.push("Missing network.json file");
    } else {
      throw error;
    }
  }

  return errors;
}

function selectQueueTask(issues: readonly LinearIssue[]) {
  const sorted = [...issues]
    .filter((issue) => !isTerminalIssue(issue))
    .sort((left, right) => {
      const priorityDelta = normalizePriority(left.priority) -
        normalizePriority(right.priority);

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return left.identifier.localeCompare(right.identifier);
    });

  for (const issue of sorted) {
    const task = parseTaskSpec(issue);
    const blockingIssues = task.blockedBy
      .map((identifier) =>
        sorted.find((candidate) => candidate.identifier === identifier)
      )
      .filter((candidate): candidate is LinearIssue => Boolean(candidate))
      .filter((candidate) => !isTerminalIssue(candidate));

    if (blockingIssues.length > 0) {
      continue;
    }

    return {
      issue,
      promptText: `Run ${issue.identifier} as a ${task.taskType} task.`,
      task,
    } satisfies QueueSelection;
  }

  return null;
}

async function postGraphql<TData>(
  config: AdminConfig,
  services: AdminServices,
  query: string,
  variables: Record<string, unknown>,
) {
  const fetchImpl = services.fetchImpl ?? fetch;
  const response = await fetchImpl(config.graphqlEndpoint, {
    method: "POST",
    headers: {
      authorization: config.linearApiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json();

  if (!response.ok || json.errors?.length) {
    const details = JSON.stringify(json.errors ?? json, null, 2);
    throw new Error(
      `Linear GraphQL request failed: ${response.status} ${details}`,
    );
  }

  return json.data as TData;
}

async function listQueueIssues(config: AdminConfig, services: AdminServices) {
  if (services.linear) {
    const issues = await services.linear.listIssues();

    return issues.filter((issue) => issue.labels.includes(config.queueLabel));
  }

  const data = await postGraphql<{
    issues: {
      nodes: Array<{
        description: string | null;
        id: string;
        identifier: string;
        labels: {
          nodes: Array<{ name: string }>;
        };
        priority: number | null;
        state: {
          name: string;
          type: string;
        } | null;
        title: string;
        updatedAt: string;
      }>;
    };
  }>(config, services, ISSUE_QUERY, { teamName: config.teamName });

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
    .filter((issue) => issue.labels.includes(config.queueLabel));
}

async function transpileSelection(
  selection: QueueSelection,
  config: AdminConfig,
) {
  const slots = await discoverPersonaSlots(config.slotRoot);
  const personas: PersonaSlot[] = [];

  for (const personaId of selection.task.personas) {
    const slot = slots.find((candidate) => candidate.id === personaId);

    if (!slot) {
      throw new Error(
        `Persona slot "${personaId}" was not found under ${config.slotRoot}`,
      );
    }

    const validationErrors = await validatePersonaSlot(slot);

    if (validationErrors.length > 0) {
      throw new Error(`${personaId}: ${validationErrors.join(", ")}`);
    }

    personas.push(slot);
  }

  return {
    issue: selection.issue,
    personas,
    promptText: selection.promptText,
    task: selection.task,
  } satisfies ConnectionPlan;
}

function extractTitle(html: string) {
  const match = /<title>([^<]+)<\/title>/i.exec(html);

  return match?.[1]?.trim() ?? "";
}

function renderWriteback(plan: ConnectionPlan, resultLines: readonly string[]) {
  const joinedPersonas = plan.personas.map((persona) => persona.id).join(", ");
  const targetUrl = plan.task.target.url;

  return [
    `ACP spike run for ${plan.issue.identifier}`,
    "",
    `- Task type: ${plan.task.taskType}`,
    `- Personas: ${joinedPersonas}`,
    `- Target: ${targetUrl}`,
    ...resultLines.map((line) => `- ${line}`),
  ].join("\n");
}

function extractAcpResult(messages: readonly AcpMessage[]) {
  return messages.find((message) =>
    "result" in message && message.result !== undefined
  ) as JsonRpcResponse | undefined;
}

function collectAgentChunks(messages: readonly AcpMessage[]) {
  return messages
    .filter((message) =>
      "method" in message && message.method === "session/update"
    )
    .map((message) =>
      (message as JsonRpcNotification).params as {
        update?: Record<string, unknown>;
      } | undefined
    )
    .map((params) => params?.update)
    .filter((update): update is Record<string, unknown> => Boolean(update))
    .filter((update) => update.sessionUpdate === "agent_message_chunk")
    .map((update) => {
      const content = update.content as { text?: string } | undefined;

      return content?.text?.trim() ?? "";
    })
    .filter(Boolean);
}

function buildDownstreamPrompt(plan: ConnectionPlan, persona: PersonaSlot) {
  const lines = [
    `Issue: ${plan.issue.identifier} — ${plan.issue.title}`,
    `Task type: ${plan.task.taskType}`,
    `Persona: ${persona.id}`,
    `Timezone: ${persona.timezone}`,
    `Proxy URL: ${persona.proxyUrl}`,
    `Target URL: ${plan.task.target.url}`,
    `Target method: ${plan.task.target.method ?? "GET"}`,
  ];

  if (plan.task.target.expectedTitle) {
    lines.push(`Expected title: ${plan.task.target.expectedTitle}`);
  }

  if (plan.task.instructions) {
    lines.push(`Instructions: ${plan.task.instructions}`);
  }

  const headers = plan.task.target.headers;
  if (headers && Object.keys(headers).length > 0) {
    lines.push(`Target headers: ${JSON.stringify(headers)}`);
  }

  return lines.join("\n");
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
  });

  if (!response.ok) {
    throw new Error(`ACP request failed: ${response.status}`);
  }

  return readNdjson(response);
}

async function runDownstreamPersonaSession(
  plan: ConnectionPlan,
  persona: PersonaSlot,
  fetchImpl: typeof fetch,
  config: AdminConfig,
  mcpServers: readonly unknown[],
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
  );
  const initializeResult = extractAcpResult(initializeMessages);

  if (!initializeResult?.result) {
    throw new Error(`ACP initialize failed for ${persona.id}`);
  }

  const sessionMessages = await postAcp(
    persona.acpUrl,
    {
      id: 1,
      jsonrpc: "2.0",
      method: "session/new",
      params: {
        cwd: persona.slotDir,
        mcpServers,
      },
    },
    fetchImpl,
  );
  const sessionResult = extractAcpResult(sessionMessages);
  const downstreamSessionId = String(
    (sessionResult?.result as { sessionId?: string } | undefined)?.sessionId ??
      "",
  );

  if (!downstreamSessionId) {
    throw new Error(`ACP session/new failed for ${persona.id}`);
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
  );
  const promptResult = extractAcpResult(promptMessages);
  const stopReason = String(
    (promptResult?.result as { stopReason?: string } | undefined)?.stopReason ??
      "",
  );

  if (stopReason !== "end_turn" && stopReason !== "cancelled") {
    throw new Error(
      `ACP session/prompt returned invalid stopReason for ${persona.id}`,
    );
  }

  const summary = collectAgentChunks(promptMessages).join("\n").trim();

  if (!summary) {
    throw new Error(
      `ACP session/prompt returned no agent summary for ${persona.id}`,
    );
  }

  const record = {
    acpUrl: persona.acpUrl,
    issueIdentifier: plan.issue.identifier,
    personaId: persona.id,
    sessionId: downstreamSessionId,
    stopReason,
    summary,
  };
  await appendJsonl(
    joinPath(config.runtimeDir, "persona-sessions.jsonl"),
    record,
  );

  return {
    sessionId: downstreamSessionId,
    stopReason,
    summary,
  } satisfies DownstreamSessionResult;
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
  };

  if (config.writebackMode === "live") {
    if (services.linear?.createComment) {
      const created = await services.linear.createComment(plan.issue.id, body);

      await appendJsonl(joinPath(config.runtimeDir, "writebacks.jsonl"), {
        ...record,
        commentId: created.commentId,
      });

      return;
    }

    const data = await postGraphql<{
      commentCreate: {
        comment: { id: string | null } | null;
      } | null;
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
    );

    await appendJsonl(joinPath(config.runtimeDir, "writebacks.jsonl"), {
      ...record,
      commentId: data.commentCreate?.comment?.id ?? null,
    });

    return;
  }

  await appendJsonl(joinPath(config.runtimeDir, "writebacks.jsonl"), record);
}

async function runQueueTask(
  session: SessionRecord,
  config: AdminConfig,
  services: AdminServices,
): Promise<PromptTurnResult> {
  const queueIssues = await listQueueIssues(config, services);
  const selected = selectQueueTask(queueIssues);

  if (!selected) {
    return {
      messages: [
        makeAgentChunk(
          session.sessionId,
          `No eligible ${config.teamName} issues labeled \`${config.queueLabel}\` are available.`,
        ),
      ],
      stopReason: "end_turn",
    };
  }

  let plan: ConnectionPlan;

  try {
    plan = await transpileSelection(selected, config);
  } catch (error) {
    return {
      messages: [
        makeAgentChunk(
          session.sessionId,
          `Fail-fast aborted ${selected.issue.identifier}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      ],
      stopReason: "end_turn",
    };
  }

  const notifications: AcpMessage[] = [
    makeAgentChunk(
      session.sessionId,
      `Selected ${plan.issue.identifier} (${plan.task.taskType}) for ${
        plan.personas.map((persona) => persona.id).join(", ")
      }.`,
    ),
  ];

  const fetchImpl = services.fetchImpl ?? fetch;
  const resultLines: string[] = [];
  const executeForPersona = async (persona: PersonaSlot) => {
    const toolCallId = `acp_${persona.id}`;

    notifications.push(
      makeToolCall(
        session.sessionId,
        toolCallId,
        `Run downstream ACP task as ${persona.id}`,
      ),
    );
    notifications.push(
      makeToolCallUpdate(session.sessionId, toolCallId, "in_progress"),
    );

    const downstream = await runDownstreamPersonaSession(
      plan,
      persona,
      fetchImpl,
      config,
      session.mcpServers,
    );

    notifications.push(
      makeToolCallUpdate(session.sessionId, toolCallId, "completed"),
    );

    return `${persona.id}: ${downstream.stopReason}, ${downstream.summary}`;
  };

  try {
    if (plan.task.taskType === "exploit" && plan.personas.length > 1) {
      resultLines.push(
        ...await Promise.all(
          plan.personas.map((persona) => executeForPersona(persona)),
        ),
      );
    } else {
      for (const persona of plan.personas) {
        if (session.cancelRequested) {
          notifications.push(
            makeAgentChunk(
              session.sessionId,
              "Prompt turn cancelled by client.",
            ),
          );

          return {
            messages: notifications,
            stopReason: "cancelled",
          };
        }

        resultLines.push(await executeForPersona(persona));
      }
    }
  } catch (error) {
    notifications.push(
      makeAgentChunk(
        session.sessionId,
        `Execution failed for ${plan.issue.identifier}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
    );

    return {
      messages: notifications,
      stopReason: "end_turn",
    };
  }

  const writebackBody = renderWriteback(plan, resultLines);
  await recordWriteback(plan, writebackBody, config, services);

  notifications.push(makeAgentChunk(session.sessionId, writebackBody));

  return {
    messages: notifications,
    stopReason: "end_turn",
    writebackBody,
  };
}

function renderDashboard(req: Request, config: AdminConfig) {
  const url = new URL(req.url);
  const email = req.headers.get("Remote-Email") ?? "unknown";
  const host = req.headers.get("Host") ?? "unknown";
  const requestId = req.headers.get("X-Request-Id") ?? "n/a";
  const forwardedFor = req.headers.get("X-Forwarded-For") ?? "n/a";

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
</html>`;

  return new Response(html, {
    headers: {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
    },
  });
}

export function loadConfig(env = Deno.env.toObject()): AdminConfig {
  const runtimeDir = env.ADMIN_RUNTIME_DIR?.trim() || `${Deno.cwd()}/data`;
  const slotRoot = env.TIDELANE_SLOT_ROOT?.trim() || `${Deno.cwd()}/slots`;
  const writebackMode =
    (env.ADMIN_WRITEBACK_MODE?.trim().toLowerCase() || "dry-run") === "live"
      ? "live"
      : "dry-run";

  return {
    defaultMcpServers: loadDefaultMcpServers(env),
    gooseArgs: parseArgs(env.ADMIN_GOOSE_ARGS, ["acp"]),
    gooseCommand: env.ADMIN_GOOSE_COMMAND?.trim() || "goose",
    gooseEnv: loadGooseEnv(env),
    gooseIdleTimeoutMs: parsePositiveInteger(
      env.ADMIN_GOOSE_IDLE_TIMEOUT_MS,
      10 * 60 * 1000,
    ),
    gooseSessionCwd: env.ADMIN_GOOSE_SESSION_CWD?.trim() || Deno.cwd(),
    gooseWsUrl: loadGooseWebSocketUrl(env),
    graphqlEndpoint: env.LINEAR_GRAPHQL_ENDPOINT ??
      "https://api.linear.app/graphql",
    linearApiKey: env.LINEAR_API_KEY ?? "",
    protocolVersion: ACP_PROTOCOL_VERSION,
    queueLabel: env.LINEAR_TEST_LABEL?.trim() || "test",
    runtimeDir,
    slotRoot,
    teamName: env.ADMIN_LINEAR_TEAM?.trim() || "Planning",
    writebackMode,
  };
}

type CreateAdminAppOptions = {
  config?: AdminConfig;
  services?: AdminServices;
};

async function writeStdoutMessage(message: AcpMessage) {
  const encoded = new TextEncoder().encode(`${JSON.stringify(message)}\n`);
  await Deno.stdout.write(encoded);
}

export function createAdminApp(options: CreateAdminAppOptions = {}) {
  const config = options.config ?? loadConfig();
  const services = options.services ?? {};
  const sessions = new Map<string, SessionRecord>();
  const gooseSessions = new Map<string, GooseBridgeSession>();

  const sessionStatus = (session: GooseBridgeSession) => ({
    exit: session.exit,
    lastConnectedAt: session.lastConnectedAt ?? null,
    sessionId: session.sessionId,
    status: session.status,
  });

  const getOrCreateGooseSession = (sessionId?: string) => {
    const normalizedSessionId = sessionId?.trim() || `goose_${crypto.randomUUID()}`;
    const existing = gooseSessions.get(normalizedSessionId);

    if (existing) {
      return existing;
    }

    const session: GooseBridgeSession = {
      createdAt: new Date((services.now ?? Date.now)()).toISOString(),
      sessionId: normalizedSessionId,
      status: "created",
    };
    gooseSessions.set(normalizedSessionId, session);

    return session;
  };

  const spawnGooseProcess = () => {
    if (services.gooseSpawner) {
      return services.gooseSpawner(config);
    }

    return new Deno.Command(config.gooseCommand, {
      args: config.gooseArgs,
      env: config.gooseEnv,
      stderr: "piped",
      stdin: "piped",
      stdout: "piped",
    }).spawn();
  };

  const closeGooseSession = (session: GooseBridgeSession) => {
    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
      session.idleTimer = undefined;
    }

    try {
      session.stdinWriter?.releaseLock();
    } catch (_error) {
      // The writer may already be closed by a process exit.
    }

    session.stdinWriter = undefined;

    if (session.upstreamSocket) {
      try {
        session.upstreamSocket.close();
      } catch (_error) {
        // The upstream socket may already be closed.
      }
    }

    session.upstreamQueue = undefined;
    session.upstreamSocket = undefined;

    if (session.process && session.status === "running") {
      try {
        session.process.kill("SIGTERM");
      } catch (_error) {
        // The process may have already exited.
      }
    }
  };

  const scheduleGooseIdleShutdown = (session: GooseBridgeSession) => {
    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
    }

    session.idleTimer = setTimeout(() => {
      closeGooseSession(session);
      gooseSessions.delete(session.sessionId);
    }, config.gooseIdleTimeoutMs);
  };

  const pumpProcessOutput = async (
    session: GooseBridgeSession,
    stream: ReadableStream<Uint8Array>,
    onLine: (line: string) => void,
  ) => {
    const decoder = new TextDecoder();
    const reader = stream.getReader();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        if (!value) {
          continue;
        }

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (line) {
            onLine(line);
          }

          newlineIndex = buffer.indexOf("\n");
        }
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        onLine(buffer.trim());
      }
    } finally {
      reader.releaseLock();
    }
  };

  const ensureGooseProcess = (session: GooseBridgeSession) => {
    if (session.process && session.status === "running") {
      return;
    }

    const child = spawnGooseProcess();
    session.process = child;
    session.stdinWriter = child.stdin.getWriter();
    session.status = "running";
    session.exit = undefined;

    void pumpProcessOutput(session, child.stdout, (line) => {
      if (session.activeSocket?.readyState === WebSocket.OPEN) {
        session.activeSocket.send(line);
      }
    }).catch((error) => {
      services.logger?.error("goose stdout bridge failed", error);
    });

    if (child.stderr) {
      void pumpProcessOutput(session, child.stderr, (line) => {
        services.logger?.error("goose stderr", line);
      }).catch((error) => {
        services.logger?.error("goose stderr bridge failed", error);
      });
    }

    void child.status.then((status) => {
      session.exit = status;
      session.process = undefined;
      session.stdinWriter = undefined;
      session.status = "exited";

      if (session.activeSocket?.readyState === WebSocket.OPEN) {
        session.activeSocket.close(1011, "goose acp exited");
      }
    }).catch((error) => {
      services.logger?.error("goose process status failed", error);
      session.process = undefined;
      session.stdinWriter = undefined;
      session.status = "exited";
    });
  };

  const attachGooseUpstream = (session: GooseBridgeSession, socket: WebSocket) => {
    if (!config.gooseWsUrl) {
      ensureGooseProcess(session);
      return;
    }

    if (session.upstreamSocket?.readyState === WebSocket.CONNECTING ||
      session.upstreamSocket?.readyState === WebSocket.OPEN) {
      session.upstreamSocket.close(4000, "superseded by a reconnect");
    }

    const upstream = new WebSocket(config.gooseWsUrl);
    session.upstreamSocket = upstream;
    session.upstreamQueue = [];
    session.status = "running";
    session.exit = undefined;

    upstream.onopen = () => {
      const queued = session.upstreamQueue ?? [];
      session.upstreamQueue = [];

      for (const message of queued) {
        upstream.send(message);
      }
    };

    upstream.onmessage = async (event) => {
      if (socket.readyState !== WebSocket.OPEN) {
        return;
      }

      const payload = await websocketMessagePayload(event.data);

      if (payload) {
        socket.send(payload);
      }
    };

    upstream.onerror = (event) => {
      services.logger?.error("goose upstream websocket error", event);
    };

    upstream.onclose = () => {
      if (session.upstreamSocket === upstream) {
        session.upstreamSocket = undefined;
        session.upstreamQueue = undefined;
        session.status = "exited";
      }

      if (socket.readyState === WebSocket.OPEN) {
        socket.close(1011, "goose upstream closed");
      }
    };
  };

  const attachGooseWebSocket = (req: Request, sessionId: string) => {
    const session = getOrCreateGooseSession(sessionId);
    const { response, socket } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
      if (session.idleTimer) {
        clearTimeout(session.idleTimer);
        session.idleTimer = undefined;
      }

      if (session.activeSocket?.readyState === WebSocket.OPEN) {
        session.activeSocket.close(4000, "superseded by a reconnect");
      }

      session.activeSocket = socket;
      session.lastConnectedAt = new Date((services.now ?? Date.now)())
        .toISOString();

      attachGooseUpstream(session, socket);
    };

    socket.onmessage = async (event) => {
      if (config.gooseWsUrl) {
        const payload = await websocketMessagePayload(event.data);

        if (!payload) {
          return;
        }

        const upstream = session.upstreamSocket;

        if (upstream?.readyState === WebSocket.OPEN) {
          upstream.send(payload);
          return;
        }

        session.upstreamQueue?.push(payload);
        return;
      }

      const bytes = await websocketMessageBytes(event.data);

      if (!bytes || !session.stdinWriter) {
        return;
      }

      try {
        await session.stdinWriter.write(bytes);
      } catch (error) {
        services.logger?.error("failed to write to goose stdin", error);

        if (socket.readyState === WebSocket.OPEN) {
          socket.close(1011, "failed to write to goose acp");
        }
      }
    };

    socket.onerror = (event) => {
      services.logger?.error("goose websocket error", event);
    };

    socket.onclose = () => {
      const wasRunning = session.status === "running";

      if (session.activeSocket === socket) {
        session.activeSocket = undefined;
      }

      if (session.upstreamSocket) {
        try {
          session.upstreamSocket.close();
        } catch (_error) {
          // The upstream socket may already be closed.
        }

        session.upstreamSocket = undefined;
        session.upstreamQueue = undefined;
        if (config.gooseWsUrl) {
          session.status = "exited";
        }
      }

      if (wasRunning) {
        scheduleGooseIdleShutdown(session);
      }
    };

    return response;
  };

  const handleAcpRequest = async (
    request: JsonRpcRequest,
  ): Promise<AcpMessage[]> => {
    const id = request.id ?? null;

    if (request.jsonrpc !== "2.0") {
      return [makeError(id, -32600, "Invalid Request", "jsonrpc must be 2.0")];
    }

    if (!request.method) {
      return [makeError(id, -32600, "Invalid Request", "method is required")];
    }

    switch (request.method) {
      case "initialize": {
        const protocolVersion = Number(
          (request.params as { protocolVersion?: unknown } | undefined)
            ?.protocolVersion,
        );

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
            protocolVersion: Number.isFinite(protocolVersion)
              ? Math.min(protocolVersion, config.protocolVersion)
              : config.protocolVersion,
          }),
        ];
      }

      case "session/new": {
        const params = request.params as SessionNewParams | undefined;

        if (
          !params || typeof params.cwd !== "string" ||
          !ensureAbsolutePath(params.cwd)
        ) {
          return [
            makeError(
              id,
              -32602,
              "Invalid params",
              "session/new requires an absolute cwd",
            ),
          ];
        }

        if (!Array.isArray(params.mcpServers)) {
          return [
            makeError(
              id,
              -32602,
              "Invalid params",
              "session/new requires mcpServers",
            ),
          ];
        }

        const sessionId = `sess_${crypto.randomUUID()}`;
        const mcpServers = mergeMcpServers(
          config.defaultMcpServers,
          params.mcpServers,
        );

        sessions.set(sessionId, {
          cancelRequested: false,
          createdAt: new Date((services.now ?? Date.now)()).toISOString(),
          cwd: params.cwd,
          mcpServers,
          prompts: [],
          sessionId,
        });

        await appendJsonl(joinPath(config.runtimeDir, "sessions.jsonl"), {
          createdAt: new Date((services.now ?? Date.now)()).toISOString(),
          cwd: params.cwd,
          mcpServers,
          sessionId,
        });

        return [
          makeResult(id, {
            sessionId,
          }),
        ];
      }

      case "session/prompt": {
        const params = request.params as SessionPromptParams | undefined;

        if (
          !params || typeof params.sessionId !== "string" ||
          !Array.isArray(params.prompt)
        ) {
          return [
            makeError(
              id,
              -32602,
              "Invalid params",
              "session/prompt requires sessionId and prompt[]",
            ),
          ];
        }

        const session = sessions.get(params.sessionId);

        if (!session) {
          return [makeError(id, -32001, "Unknown session", params.sessionId)];
        }

        const promptText = params.prompt
          .filter((content) => content?.type === "text")
          .map((content) => content.text)
          .join("\n")
          .trim();

        session.cancelRequested = false;
        session.prompts.push(promptText);

        let promptTurn: PromptTurnResult;

        try {
          promptTurn = await runQueueTask(session, config, services);
        } catch (error) {
          promptTurn = {
            messages: [
              makeAgentChunk(
                session.sessionId,
                `Prompt failed: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              ),
            ],
            stopReason: "end_turn",
          };
        }

        return [
          ...promptTurn.messages,
          makeResult(id, {
            stopReason: promptTurn.stopReason,
          }),
        ];
      }

      case "session/cancel": {
        const params = request.params as { sessionId?: string } | undefined;

        if (!params?.sessionId || !sessions.has(params.sessionId)) {
          return [];
        }

        const session = sessions.get(params.sessionId);

        if (session) {
          session.cancelRequested = true;
        }

        return [];
      }

      default:
        return [makeError(id, -32601, "Method not found", request.method)];
    }
  };

  const fetchHandler = async (req: Request) => {
    const url = new URL(req.url);

    if (url.pathname === "/healthz" || url.pathname === "/readyz") {
      return json({
        acpPath: "/acp",
        app: "admin",
        ok: true,
        path: url.pathname,
      });
    }

    if (url.pathname === "/api/session") {
      return json({
        acpPath: "/acp",
        host: req.headers.get("Host"),
        path: url.pathname,
        remoteEmail: req.headers.get("Remote-Email"),
      });
    }

    if (url.pathname === "/api/goose-sessions" && req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(req),
      });
    }

    if (url.pathname === "/api/goose-sessions" && req.method === "POST") {
      const payload = (req.headers.get("content-type")?.includes(
          "application/json",
        )
        ? await req.json().catch(() => ({}))
        : {}) as { sessionId?: unknown };
      const sessionId = typeof payload.sessionId === "string"
        ? payload.sessionId
        : undefined;
      const session = getOrCreateGooseSession(sessionId);

      return jsonWithHeaders({
        cwd: config.gooseSessionCwd,
        gooseArgs: config.gooseArgs,
        gooseCommand: config.gooseCommand,
        gooseTransport: config.gooseWsUrl ? "websocket" : "stdio",
        gooseWsUrl: config.gooseWsUrl || null,
        ...sessionStatus(session),
        wsUrl: makeWebSocketUrl(req, `/acp/ws/${session.sessionId}`),
      }, sessionId ? 200 : 201, corsHeaders(req));
    }

    if (url.pathname.startsWith("/acp/ws/")) {
      const sessionId = decodeURIComponent(
        url.pathname.slice("/acp/ws/".length),
      );

      if (!sessionId) {
        return json({ error: "Missing Goose session id" }, 400);
      }

      if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
        return json({ error: "Expected WebSocket upgrade" }, 426);
      }

      return attachGooseWebSocket(req, sessionId);
    }

    if (url.pathname === "/acp" && req.method === "GET") {
      return json({
        contentType: "application/x-ndjson",
        protocolVersion: config.protocolVersion,
        queueLabel: config.queueLabel,
      });
    }

    if (url.pathname === "/acp" && req.method === "POST") {
      let payload: JsonRpcRequest;

      try {
        payload = await req.json();
      } catch (_error) {
        return ndjson([makeError(null, -32700, "Parse error")]);
      }

      return ndjson(await handleAcpRequest(payload));
    }

    return renderDashboard(req, config);
  };

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
    });
    const newSessionMessages = await handleAcpRequest({
      id: 1,
      jsonrpc: "2.0",
      method: "session/new",
      params: {
        cwd: Deno.cwd(),
        mcpServers: config.defaultMcpServers,
      },
    });
    const newSessionResponse = newSessionMessages.find((message) =>
      "result" in message
    ) as JsonRpcResponse | undefined;
    const sessionId = String(
      (newSessionResponse?.result as { sessionId?: string } | undefined)
        ?.sessionId ?? "",
    );

    if (!sessionId) {
      return [...initializeMessages, ...newSessionMessages];
    }

    const promptMessages = await handleAcpRequest({
      id: 2,
      jsonrpc: "2.0",
      method: "session/prompt",
      params: {
        prompt: [
          {
            text: args.join(" ").trim() ||
              "Run the next Planning fixture task.",
            type: "text",
          },
        ],
        sessionId,
      },
    });

    return [...initializeMessages, ...newSessionMessages, ...promptMessages];
  };

  const runStdioServer = async () => {
    const decoder = new TextDecoder();
    let buffer = "";

    const handleLine = async (line: string) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return;
      }

      let request: JsonRpcRequest;

      try {
        request = JSON.parse(trimmed) as JsonRpcRequest;
      } catch (_error) {
        await writeStdoutMessage(makeError(null, -32700, "Parse error"));
        return;
      }

      for (const message of await handleAcpRequest(request)) {
        await writeStdoutMessage(message);
      }
    };

    for await (const chunk of Deno.stdin.readable) {
      buffer += decoder.decode(chunk, { stream: true });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        await handleLine(line);
        newlineIndex = buffer.indexOf("\n");
      }
    }

    buffer += decoder.decode();
    await handleLine(buffer);
  };

  return {
    config,
    fetch: fetchHandler,
    gooseSessions,
    handleAcpRequest,
    async run(args: string[]) {
      if (args.includes("--stdio")) {
        await runStdioServer();
        return;
      }

      const messages = await runCliSession(args);

      for (const message of messages) {
        console.log(JSON.stringify(message));
      }
    },
    runCliSession,
    runStdioServer,
  };
}
