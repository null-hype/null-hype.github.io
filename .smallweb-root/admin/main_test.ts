import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";

import {
  type AcpStdioMcpServer,
  type AdminConfig,
  createAdminApp,
  type LinearIssue,
  loadConfig,
} from "./core.ts";

function taskSpec(
  taskType: "aging" | "exploit" | "recon",
  personas: string[],
  url: string,
  extra: Record<string, unknown> = {},
) {
  return `## ACP Task Spec
\`\`\`json
${
    JSON.stringify(
      {
        instructions: `Fixture ${taskType} task`,
        personas,
        target: {
          expectedTitle: "Fixture Target",
          method: "GET",
          url,
        },
        taskType,
        ...extra,
      },
      null,
      2,
    )
  }
\`\`\`
`;
}

async function createSlot(
  root: string,
  slotId: string,
  overrides: {
    env?: Record<string, string>;
    network?: Record<string, string>;
  } = {},
) {
  const slotDir = path.join(root, slotId);
  await mkdir(path.join(slotDir, ".playwright-profile"), { recursive: true });
  const envValues = {
    ACP_URL: `https://${slotId}.persona.test/acp`,
    PROXY_URL: "https://proxy.example.test",
    TZ: "Australia/Sydney",
    ...(overrides.env ?? {}),
  };
  await writeFile(
    path.join(slotDir, ".env"),
    [
      ...Object.entries(envValues).map(([key, value]) => `${key}=${value}`),
    ].join("\n"),
  );
  const networkValues = {
    acpUrl: `https://${slotId}.persona.test/acp`,
    proxyUrl: "https://proxy.example.test",
    timeZone: "Australia/Sydney",
    ...(overrides.network ?? {}),
  };
  await writeFile(
    path.join(slotDir, "network.json"),
    JSON.stringify(networkValues, null, 2),
  );
}

async function readNdjson(response: Response) {
  const body = await response.text();

  return body
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function postAcp(
  app: ReturnType<typeof createAdminApp>,
  payload: unknown,
) {
  const response = await app.fetch(
    new Request("https://admin.tidelands.dev/acp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    }),
  );

  return readNdjson(response);
}

async function createFixtureApp(
  issues: LinearIssue[],
  options: {
    defaultMcpServers?: AcpStdioMcpServer[];
    fetchImpl?: typeof fetch;
    writebackMode?: AdminConfig["writebackMode"];
  } = {},
) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "admin-acp-test-"));
  const slotRoot = path.join(tempRoot, "slots");
  const runtimeDir = path.join(tempRoot, "runtime");
  await mkdir(slotRoot, { recursive: true });
  await mkdir(runtimeDir, { recursive: true });

  return {
    app: createAdminApp({
      config: {
        defaultMcpServers: options.defaultMcpServers ?? [],
        gooseArgs: ["acp"],
        gooseCommand: "goose",
        gooseEnv: {},
        gooseIdleTimeoutMs: 1000,
        gooseSessionCwd: runtimeDir,
        gooseWsUrl: "",
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
            return issues;
          },
        },
      },
    }),
    runtimeDir,
    slotRoot,
  };
}

function fixtureDaggerMcpServer(): AcpStdioMcpServer {
  return {
    args: [
      "--silent",
      "mcp",
      "--mod",
      "/workspace/tidelands/infra",
      "--stdio",
    ],
    command: "/usr/local/bin/dagger",
    env: [],
    name: "dagger",
  };
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
  );
}

function createPersonaAcpFetch(
  handlers: Record<string, {
    onPrompt?: (promptText: string) => void;
    summary: string;
  }>,
) {
  const calls: Array<
    { method: string; payload: Record<string, unknown>; url: string }
  > = [];

  const fetchImpl = async (
    target: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = String(target);
    const handler = handlers[url];

    if (!handler) {
      throw new Error(`Unexpected downstream ACP URL: ${url}`);
    }

    const payload = JSON.parse(String(init?.body ?? "{}")) as Record<
      string,
      unknown
    >;
    const method = String(payload.method ?? "");
    calls.push({ method, payload, url });

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
      ]);
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
      ]);
    }

    if (method === "session/prompt") {
      const params = payload.params as
        | { prompt?: Array<{ text?: string }> }
        | undefined;
      const promptText = params?.prompt?.[0]?.text ?? "";
      handler.onPrompt?.(promptText);

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
      ]);
    }

    throw new Error(`Unexpected downstream ACP method: ${method}`);
  };

  return { calls, fetchImpl };
}

Deno.test("loadConfig creates a Dagger MCP descriptor from env", () => {
  const config = loadConfig({
    ADMIN_DAGGER_COMMAND: "/usr/local/bin/dagger",
    ADMIN_DAGGER_MODULE: "/srv/tidelands/infra",
  });

  assert.deepEqual(config.defaultMcpServers, [
    {
      args: [
        "--silent",
        "mcp",
        "--mod",
        "/srv/tidelands/infra",
        "--stdio",
      ],
      command: "/usr/local/bin/dagger",
      env: [],
      name: "dagger",
    },
  ]);
});

Deno.test("loadConfig keeps Goose command config separate from Dagger MCP config", () => {
  const config = loadConfig({
    ADMIN_GOOSE_ARGS: "acp",
    ADMIN_GOOSE_COMMAND: "/usr/local/bin/goose",
    ADMIN_GOOSE_IDLE_TIMEOUT_MS: "2500",
    ADMIN_GOOSE_SESSION_CWD: "/srv/tidelands",
    GOOSE_MODEL: "gpt-test",
    GOOSE_PROVIDER: "openai",
    ADMIN_GOOSE_HOME: "/tmp/goose-home",
    ADMIN_GOOSE_XDG_CONFIG_HOME: "/tmp/goose-config",
    ADMIN_GOOSE_XDG_STATE_HOME: "/tmp/goose-state",
    ADMIN_GOOSE_XDG_CACHE_HOME: "/tmp/goose-cache",
  });

  assert.equal(config.gooseCommand, "/usr/local/bin/goose");
  assert.deepEqual(config.gooseArgs, ["acp"]);
  assert.equal(config.gooseIdleTimeoutMs, 2500);
  assert.equal(config.gooseSessionCwd, "/srv/tidelands");
  assert.deepEqual(config.gooseEnv, {
    HOME: "/tmp/goose-home",
    GOOSE_MODEL: "gpt-test",
    GOOSE_PROVIDER: "openai",
    XDG_CACHE_HOME: "/tmp/goose-cache",
    XDG_CONFIG_HOME: "/tmp/goose-config",
    XDG_STATE_HOME: "/tmp/goose-state",
  });
  assert.deepEqual(config.defaultMcpServers, []);
});

Deno.test("loadConfig accepts Goose serve as a WebSocket ACP upstream", () => {
  const config = loadConfig({
    ADMIN_GOOSE_SERVE_URL: "http://127.0.0.1:7780",
  });

  assert.equal(config.gooseWsUrl, "ws://127.0.0.1:7780/acp");
});

Deno.test("Goose session API returns a private WebSocket endpoint without spawning", async () => {
  const { app, runtimeDir } = await createFixtureApp([]);
  const response = await app.fetch(
    new Request("https://admin.tidelands.dev/api/goose-sessions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ sessionId: "goose_test" }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.sessionId, "goose_test");
  assert.equal(body.status, "created");
  assert.equal(body.cwd, runtimeDir);
  assert.equal(body.wsUrl, "wss://admin.tidelands.dev/acp/ws/goose_test");
  assert.equal(app.gooseSessions.get("goose_test")?.status, "created");
});

Deno.test("Goose session API supports browser CORS from the Astro app", async () => {
  const { app } = await createFixtureApp([]);
  const preflight = await app.fetch(
    new Request("https://admin.tidelands.dev/api/goose-sessions", {
      method: "OPTIONS",
      headers: {
        "access-control-request-headers": "content-type",
        "access-control-request-method": "POST",
        origin: "https://null-hype.tidelands.dev",
      },
    }),
  );

  assert.equal(preflight.status, 204);
  assert.equal(
    preflight.headers.get("access-control-allow-origin"),
    "https://null-hype.tidelands.dev",
  );
  assert.match(
    preflight.headers.get("access-control-allow-methods") ?? "",
    /POST/,
  );

  const response = await app.fetch(
    new Request("https://admin.tidelands.dev/api/goose-sessions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://null-hype.tidelands.dev",
      },
      body: JSON.stringify({ sessionId: "goose_cors" }),
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    "https://null-hype.tidelands.dev",
  );
});

Deno.test("default MCP servers are attached to admin and downstream ACP sessions", async () => {
  const issue = {
    description: taskSpec(
      "recon",
      ["slot-mcp"],
      "https://fixture.test/mcp",
    ),
    id: "issue_fixture_mcp",
    identifier: "PLAN-706",
    labels: ["test"],
    priority: 2,
    stateName: "Backlog",
    stateType: "unstarted",
    title: "Fixture MCP task",
    updatedAt: new Date().toISOString(),
  };
  const downstream = createPersonaAcpFetch({
    "https://slot-mcp.persona.test/acp": {
      summary:
        'Visited https://fixture.test/mcp and observed title "Fixture Target".',
    },
  });
  const { app, runtimeDir, slotRoot } = await createFixtureApp([issue], {
    defaultMcpServers: [fixtureDaggerMcpServer()],
    fetchImpl: downstream.fetchImpl,
  });
  await createSlot(slotRoot, "slot-mcp");

  const clientMcpServer = {
    args: ["--stdio"],
    command: "/usr/local/bin/context-fixture",
    env: [],
    name: "client-context",
  };
  const newSession = await postAcp(app, {
    id: 1,
    jsonrpc: "2.0",
    method: "session/new",
    params: {
      cwd: runtimeDir,
      mcpServers: [clientMcpServer],
    },
  });
  const sessionId = newSession[0].result.sessionId;

  await postAcp(app, {
    id: 2,
    jsonrpc: "2.0",
    method: "session/prompt",
    params: {
      prompt: [{ text: "Run the MCP fixture", type: "text" }],
      sessionId,
    },
  });

  const sessionLog = await readFile(
    path.join(runtimeDir, "sessions.jsonl"),
    "utf8",
  );
  const adminSession = JSON.parse(sessionLog.trim()) as {
    mcpServers: Array<{ name: string }>;
  };
  assert.deepEqual(
    adminSession.mcpServers.map((server) => server.name),
    ["dagger", "client-context"],
  );

  const downstreamSession = downstream.calls.find((call) =>
    call.method === "session/new"
  );
  const downstreamParams = downstreamSession?.payload.params as
    | { mcpServers: Array<{ name: string }> }
    | undefined;
  assert.deepEqual(
    downstreamParams?.mcpServers.map((server) => server.name),
    ["dagger", "client-context"],
  );
});

Deno.test("ACP initialize -> session/new -> session/prompt executes a bounded recon fixture", async () => {
  let observedPrompt = "";
  const issue = {
    description: taskSpec(
      "recon",
      ["apac-slot-07"],
      "https://fixture.test/recon",
    ),
    id: "issue_fixture_recon",
    identifier: "PLAN-700",
    labels: ["test"],
    priority: 2,
    stateName: "Backlog",
    stateType: "unstarted",
    title: "Fixture recon task",
    updatedAt: new Date().toISOString(),
  };
  const downstream = createPersonaAcpFetch({
    "https://apac-slot-07.persona.test/acp": {
      onPrompt(promptText) {
        observedPrompt = promptText;
      },
      summary:
        'Visited https://fixture.test/recon and observed title "Fixture Target".',
    },
  });
  const { app, runtimeDir, slotRoot } = await createFixtureApp([issue], {
    fetchImpl: downstream.fetchImpl,
  });
  await createSlot(slotRoot, "apac-slot-07");

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
  });
  assert.equal(initializeMessages[0].result.protocolVersion, 1);

  const newSessionMessages = await postAcp(app, {
    id: 1,
    jsonrpc: "2.0",
    method: "session/new",
    params: {
      cwd: runtimeDir,
      mcpServers: [],
    },
  });
  const sessionId = newSessionMessages[0].result.sessionId;
  assert.match(sessionId, /^sess_/);

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
  });
  const agentChunks = promptMessages
    .filter((message) => message.method === "session/update")
    .map((message) => message.params.update)
    .filter((update) => update.sessionUpdate === "agent_message_chunk")
    .map((update) => update.content.text)
    .join("\n");

  assert.match(agentChunks, /Selected PLAN-700/);
  assert.match(agentChunks, /Fixture Target/);
  assert.match(observedPrompt, /Target URL: https:\/\/fixture\.test\/recon/);
  assert.match(observedPrompt, /Persona: apac-slot-07/);
  assert.deepEqual(
    downstream.calls.map((call) => call.method),
    ["initialize", "session/new", "session/prompt"],
  );
  assert.equal(promptMessages.at(-1)?.result.stopReason, "end_turn");

  const writebackLog = await readFile(
    path.join(runtimeDir, "writebacks.jsonl"),
    "utf8",
  );
  assert.match(writebackLog, /PLAN-700/);
  assert.match(writebackLog, /Fixture Target/);
  const personaLog = await readFile(
    path.join(runtimeDir, "persona-sessions.jsonl"),
    "utf8",
  );
  assert.match(personaLog, /apac-slot-07/);
  assert.match(personaLog, /persona_2/);
});

Deno.test("missing PROXY_URL fails before any downstream ACP session starts", async () => {
  const issue = {
    description: taskSpec(
      "recon",
      ["apac-slot-08"],
      "https://fixture.test/recon",
    ),
    id: "issue_fixture_bad_slot",
    identifier: "PLAN-701",
    labels: ["test"],
    priority: 1,
    stateName: "Backlog",
    stateType: "unstarted",
    title: "Fixture recon missing proxy",
    updatedAt: new Date().toISOString(),
  };
  const downstream = createPersonaAcpFetch({
    "https://apac-slot-08.persona.test/acp": {
      summary: "should not execute",
    },
  });
  const { app, runtimeDir, slotRoot } = await createFixtureApp([issue], {
    fetchImpl: downstream.fetchImpl,
  });
  await createSlot(slotRoot, "apac-slot-08", {
    env: { PROXY_URL: "" },
    network: { proxyUrl: "" },
  });

  const newSession = await postAcp(app, {
    id: 1,
    jsonrpc: "2.0",
    method: "session/new",
    params: {
      cwd: runtimeDir,
      mcpServers: [],
    },
  });
  const sessionId = newSession[0].result.sessionId;
  const promptMessages = await postAcp(app, {
    id: 2,
    jsonrpc: "2.0",
    method: "session/prompt",
    params: {
      prompt: [{ text: "Run the next task", type: "text" }],
      sessionId,
    },
  });
  const agentChunks = promptMessages
    .filter((message) => message.method === "session/update")
    .map((message) => message.params.update)
    .filter((update) => update.sessionUpdate === "agent_message_chunk")
    .map((update) => update.content.text)
    .join("\n");

  assert.equal(downstream.calls.length, 0);
  assert.match(agentChunks, /Fail-fast aborted PLAN-701/);
  assert.match(agentChunks, /Missing PROXY_URL/);
});

Deno.test("blocked fixture issues are skipped in favor of the next eligible task", async () => {
  const blocker = {
    description: taskSpec(
      "aging",
      ["slot-blocker"],
      "https://fixture.test/blocker",
    ),
    id: "issue_blocker",
    identifier: "PLAN-702",
    labels: ["test"],
    priority: 2,
    stateName: "Backlog",
    stateType: "unstarted",
    title: "Fixture blocker",
    updatedAt: new Date().toISOString(),
  };
  const blocked = {
    description: taskSpec(
      "recon",
      ["slot-blocked"],
      "https://fixture.test/blocked",
      {
        blockedBy: ["PLAN-702"],
      },
    ),
    id: "issue_blocked",
    identifier: "PLAN-703",
    labels: ["test"],
    priority: 1,
    stateName: "Backlog",
    stateType: "unstarted",
    title: "Blocked fixture",
    updatedAt: new Date().toISOString(),
  };
  const eligible = {
    description: taskSpec(
      "recon",
      ["slot-eligible"],
      "https://fixture.test/eligible",
    ),
    id: "issue_eligible",
    identifier: "PLAN-704",
    labels: ["test"],
    priority: 3,
    stateName: "Backlog",
    stateType: "unstarted",
    title: "Eligible fixture",
    updatedAt: new Date().toISOString(),
  };
  const downstream = createPersonaAcpFetch({
    "https://slot-blocker.persona.test/acp": {
      summary:
        'Visited https://fixture.test/blocker and observed title "Fixture Target".',
    },
    "https://slot-blocked.persona.test/acp": {
      summary:
        'Visited https://fixture.test/blocked and observed title "Fixture Target".',
    },
    "https://slot-eligible.persona.test/acp": {
      summary:
        'Visited https://fixture.test/eligible and observed title "Fixture Target".',
    },
  });
  const { app, runtimeDir, slotRoot } = await createFixtureApp([
    blocked,
    blocker,
    eligible,
  ], {
    fetchImpl: downstream.fetchImpl,
  });
  await createSlot(slotRoot, "slot-blocker");
  await createSlot(slotRoot, "slot-blocked");
  await createSlot(slotRoot, "slot-eligible");

  const session = await postAcp(app, {
    id: 1,
    jsonrpc: "2.0",
    method: "session/new",
    params: {
      cwd: runtimeDir,
      mcpServers: [],
    },
  });
  const sessionId = session[0].result.sessionId;
  const promptMessages = await postAcp(app, {
    id: 2,
    jsonrpc: "2.0",
    method: "session/prompt",
    params: {
      prompt: [{ text: "Run eligible work", type: "text" }],
      sessionId,
    },
  });
  const chunks = promptMessages
    .filter((message) => message.method === "session/update")
    .map((message) => message.params.update)
    .filter((update) => update.sessionUpdate === "agent_message_chunk")
    .map((update) => update.content.text)
    .join("\n");

  assert.match(chunks, /Selected PLAN-702/);
  assert.doesNotMatch(chunks, /Selected PLAN-703/);
  assert.deepEqual(
    downstream.calls.map((call) => call.url),
    [
      "https://slot-blocker.persona.test/acp",
      "https://slot-blocker.persona.test/acp",
      "https://slot-blocker.persona.test/acp",
    ],
  );
});

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
  };
  const downstream = createPersonaAcpFetch({
    "https://slot-cli.persona.test/acp": {
      summary:
        'Visited https://fixture.test/cli and observed title "Fixture Target".',
    },
  });
  const { app, slotRoot } = await createFixtureApp([issue], {
    fetchImpl: downstream.fetchImpl,
  });
  await createSlot(slotRoot, "slot-cli");

  const messages = await app.runCliSession(["Run the CLI fixture"]);
  const initializeResult = messages[0] as {
    result: { protocolVersion: number };
  };
  const promptResult = messages.at(-1) as
    | { result: { stopReason: string } }
    | undefined;

  assert.equal(initializeResult.result.protocolVersion, 1);
  assert.equal(promptResult?.result.stopReason, "end_turn");
  assert.match(JSON.stringify(messages), /PLAN-705/);
  assert.deepEqual(
    downstream.calls.map((call) => call.method),
    ["initialize", "session/new", "session/prompt"],
  );
});
