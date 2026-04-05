import http from 'node:http';
import crypto from 'node:crypto';
import https from 'node:https';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const AGENT_ACTIVITY_CREATE_MUTATION = `
  mutation AgentActivityCreate($input: AgentActivityCreateInput!) {
    agentActivityCreate(input: $input) {
      success
      agentActivity {
        id
      }
    }
  }
`;

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

export function loadConfig(env = process.env) {
  const runtimeDir = path.resolve(env.LINEAR_RUNTIME_DIR ?? '.linear-agent-runtime');
  const port = Number.parseInt(env.PORT ?? '3000', 10);
  const allowedClockSkewMs = Number.parseInt(env.LINEAR_ALLOWED_CLOCK_SKEW_MS ?? '60000', 10);
  const dryRun = parseBoolean(
    env.LINEAR_DRY_RUN,
    env.LINEAR_OAUTH_ACCESS_TOKEN ? false : true,
  );

  return {
    port: Number.isFinite(port) ? port : 3000,
    webhookSecret: env.LINEAR_WEBHOOK_SECRET ?? '',
    oauthAccessToken: env.LINEAR_OAUTH_ACCESS_TOKEN ?? '',
    graphqlEndpoint: env.LINEAR_GRAPHQL_ENDPOINT ?? 'https://api.linear.app/graphql',
    allowedClockSkewMs: Number.isFinite(allowedClockSkewMs) ? allowedClockSkewMs : 60000,
    runtimeDir,
    dryRun,
    agentName: env.LINEAR_AGENT_NAME ?? 'Local Spike Harness',
    julesProxyUrl: env.JULES_PROXY_URL ?? '',
    julesProxyHost: env.JULES_PROXY_HOST ?? '',
    julesProxyToken: env.JULES_PROXY_TOKEN ?? '',
  };
}

export function createSignature(secret, rawBody) {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function verifySignature(secret, headerSignature, rawBody) {
  if (!secret || typeof headerSignature !== 'string') {
    return false;
  }

  const received = Buffer.from(headerSignature, 'hex');
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();

  if (received.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(received, expected);
}

export function isFreshTimestamp(webhookTimestamp, now = Date.now(), allowedClockSkewMs = 60000) {
  if (!Number.isFinite(webhookTimestamp)) {
    return false;
  }

  return Math.abs(now - webhookTimestamp) <= allowedClockSkewMs;
}

function createPaths(config) {
  return {
    runtimeDir: config.runtimeDir,
    deliveries: path.join(config.runtimeDir, 'deliveries.jsonl'),
    notifications: path.join(config.runtimeDir, 'notifications.jsonl'),
    activities: path.join(config.runtimeDir, 'activities.jsonl'),
    errors: path.join(config.runtimeDir, 'errors.jsonl'),
  };
}

async function ensureRuntimeDir(config) {
  await mkdir(config.runtimeDir, { recursive: true });
}

async function appendJsonl(filePath, record) {
  await appendFile(filePath, `${JSON.stringify(record)}\n`, 'utf8');
}

async function readJsonl(filePath) {
  try {
    const contents = await readFile(filePath, 'utf8');
    return contents
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

function summarizeNotifications(entries) {
  const actions = {};

  for (const entry of entries) {
    const current = actions[entry.action] ?? { count: 0, lastSeenAt: null, samples: [] };
    current.count += 1;
    current.lastSeenAt = entry.createdAt;

    if (current.samples.length < 5) {
      current.samples.push({
        issueIdentifier: entry.issueIdentifier,
        issueTitle: entry.issueTitle,
        projectName: entry.projectName,
      });
    }

    actions[entry.action] = current;
  }

  return {
    totalNotifications: entries.length,
    actions,
  };
}

function summarizePrompt(payload) {
  const issueIdentifier = payload.agentSession?.issue?.identifier;
  const issueTitle = payload.agentSession?.issue?.title;
  const promptBody = payload.agentActivity?.body;

  const parts = [];

  if (issueIdentifier) {
    parts.push(issueIdentifier);
  }

  if (issueTitle) {
    parts.push(issueTitle);
  }

  if (promptBody) {
    parts.push(`prompt: ${promptBody}`);
  }

  if (parts.length === 0 && payload.promptContext) {
    parts.push(`promptContext chars=${payload.promptContext.length}`);
  }

  return parts.join(' | ') || 'session context received';
}

function buildAgentActivities(payload, config) {
  const isStop = payload.action === 'prompted' && payload.agentActivity?.signal === 'stop';

  if (isStop) {
    return [
      {
        type: 'response',
        body: `${config.agentName} received a stop signal and halted further work.`,
      },
    ];
  }

  const contextSummary = summarizePrompt(payload);

  return [
    {
      type: 'thought',
      body: `${config.agentName} acknowledged the session and is reviewing ${contextSummary}.`,
    },
    {
      type: 'response',
      body: `${config.agentName} is wired correctly on the local Node webhook path. This confirms the session webhook was received and the agent activity pipeline is ready for live delegation tests.`,
    },
  ];
}

function summarizeNotification(payload) {
  const notification = payload.notification ?? {};
  const issue = notification.issue ?? notification.comment?.issue ?? payload.issue ?? null;
  const project = notification.project ?? issue?.project ?? null;

  return {
    type: payload.type,
    action: payload.action,
    createdAt: payload.createdAt ?? new Date(payload.webhookTimestamp ?? Date.now()).toISOString(),
    issueId: issue?.id ?? null,
    issueIdentifier: issue?.identifier ?? null,
    issueTitle: issue?.title ?? null,
    projectId: project?.id ?? null,
    projectName: project?.name ?? null,
  };
}

async function postGraphql(config, body, fetchImpl = fetch) {
  const response = await fetchImpl(config.graphqlEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.oauthAccessToken}`,
    },
    body: JSON.stringify(body),
  });

  const json = await response.json();

  if (!response.ok || json.errors?.length) {
    const details = JSON.stringify(json.errors ?? json, null, 2);
    throw new Error(`Linear GraphQL request failed: ${response.status} ${details}`);
  }

  return json.data;
}

async function emitActivity(config, paths, sessionId, content, services) {
  const record = {
    mode: config.dryRun ? 'dry-run' : 'live',
    recordedAt: new Date().toISOString(),
    agentSessionId: sessionId,
    content,
  };

  if (config.dryRun || !config.oauthAccessToken) {
    await appendJsonl(paths.activities, record);
    return { dryRun: true };
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
    services.fetchImpl ?? fetch,
  );

  await appendJsonl(paths.activities, {
    ...record,
    agentActivityId: data.agentActivityCreate?.agentActivity?.id ?? null,
  });

  return data;
}

async function readResponseBody(response) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return await response.json();
  }

  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { body: text };
  }
}

async function requestProxy(config, init, services) {
  if (services.fetchImpl) {
    return await services.fetchImpl(config.julesProxyUrl, init);
  }

  if (!config.julesProxyHost) {
    return await fetch(config.julesProxyUrl, init);
  }

  const targetUrl = new URL(config.julesProxyUrl);
  const transport = targetUrl.protocol === 'https:' ? https : http;

  return await new Promise((resolve, reject) => {
    const request = transport.request(
      {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port,
        method: init.method,
        path: `${targetUrl.pathname}${targetUrl.search}`,
        headers: init.headers,
      },
      (response) => {
        const chunks = [];

        response.on('data', (chunk) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          resolve(
            new Response(Buffer.concat(chunks), {
              status: response.statusCode ?? 500,
              headers: response.headers,
            }),
          );
        });

        response.on('error', reject);
      },
    );

    request.on('error', reject);

    if (init.body) {
      request.write(init.body);
    }

    request.end();
  });
}

async function dispatchToJules(config, payload, services) {
  if (!config.julesProxyUrl) {
    return null;
  }

  const issue = payload.agentSession?.issue;
  const promptContext = payload.promptContext ?? issue?.description ?? '';

  if (!issue?.id || !issue?.identifier || !promptContext) {
    throw new Error('AgentSessionEvent payload is missing Jules dispatch context');
  }

  const headers = {
    'content-type': 'application/json',
  };

  if (config.julesProxyHost) {
    headers.host = config.julesProxyHost;
  }

  if (config.julesProxyToken) {
    headers.authorization = `Bearer ${config.julesProxyToken}`;
  }

  const response = await requestProxy(
    {
      ...config,
      julesProxyUrl: `${config.julesProxyUrl.replace(/\/$/, '')}/api/dispatch`,
    },
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        promptContext,
        issueId: issue.id,
        issueIdentifier: issue.identifier,
      }),
    },
    services,
  );

  const body = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(`Jules dispatch failed: ${response.status} ${JSON.stringify(body)}`);
  }

  return body;
}

async function logProcessingError(paths, payload, error, logger, stage) {
  await appendJsonl(paths.errors, {
    recordedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    payloadType: payload.type ?? null,
    stage,
    webhookId: payload.webhookId ?? null,
  });

  logger.error(error);
}

async function handleAgentSessionEvent(payload, config, paths, services) {
  const sessionId = payload.agentSession?.id;

  if (!sessionId) {
    throw new Error('AgentSessionEvent payload is missing agentSession.id');
  }

  await appendJsonl(path.join(config.runtimeDir, 'raw-payloads.jsonl'), {
    receivedAt: new Date().toISOString(),
    payload,
  });

  const logger = services.logger ?? console;

  for (const content of buildAgentActivities(payload, config)) {
    try {
      await emitActivity(config, paths, sessionId, content, services);
    } catch (error) {
      await logProcessingError(paths, payload, error, logger, 'emitActivity');
    }
  }

  if (payload.action === 'created') {
    try {
      await dispatchToJules(config, payload, services);
    } catch (error) {
      await logProcessingError(paths, payload, error, logger, 'dispatchToJules');
    }
  }
}

async function handleNotification(payload, paths) {
  const summary = summarizeNotification(payload);
  await appendJsonl(paths.notifications, summary);
}

async function dispatchWebhook(payload, config, paths, services) {
  switch (payload.type) {
    case 'AgentSessionEvent':
      await handleAgentSessionEvent(payload, config, paths, services);
      break;
    case 'AppUserNotification':
      await handleNotification(payload, paths);
      break;
    case 'PermissionChange':
    case 'OAuthApp':
      await appendJsonl(paths.deliveries, {
        receivedAt: new Date().toISOString(),
        type: payload.type,
        action: payload.action,
        webhookId: payload.webhookId ?? null,
      });
      break;
    default:
      await appendJsonl(paths.errors, {
        recordedAt: new Date().toISOString(),
        error: `Unhandled webhook type: ${payload.type ?? 'unknown'}`,
        payload,
      });
  }
}

async function sendJson(res, statusCode, body) {
  const serialized = JSON.stringify(body, null, 2);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(serialized),
  });
  res.end(serialized);
}

async function readRawBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

export function createRequestProcessor(config = loadConfig(), services = {}) {
  const paths = createPaths(config);
  const logger = services.logger ?? console;

  return {
    paths,
    async processRequest({
      method,
      url,
      headers = {},
      rawBody = Buffer.alloc(0),
    }) {
      await ensureRuntimeDir(config);

      if (method === 'GET' && url === '/healthz') {
        return {
          statusCode: 200,
          body: {
            ok: true,
            port: config.port,
            dryRun: config.dryRun,
            webhookSecretConfigured: Boolean(config.webhookSecret),
            oauthAccessTokenConfigured: Boolean(config.oauthAccessToken),
            runtimeDir: config.runtimeDir,
          },
        };
      }

      if (method === 'GET' && url === '/matrix') {
        const entries = await readJsonl(paths.notifications);
        return {
          statusCode: 200,
          body: summarizeNotifications(entries),
        };
      }

      if (method !== 'POST' || url !== '/webhooks/linear') {
        return {
          statusCode: 404,
          body: { ok: false, error: 'Not found' },
        };
      }

      if (!config.webhookSecret) {
        return {
          statusCode: 500,
          body: {
            ok: false,
            error: 'LINEAR_WEBHOOK_SECRET is not configured',
          },
        };
      }

      if (!verifySignature(config.webhookSecret, headers['linear-signature'], rawBody)) {
        return {
          statusCode: 401,
          body: { ok: false, error: 'Invalid Linear-Signature header' },
        };
      }

      let payload;

      try {
        payload = JSON.parse(rawBody.toString('utf8'));
      } catch {
        return {
          statusCode: 400,
          body: { ok: false, error: 'Invalid JSON payload' },
        };
      }

      if (
        !isFreshTimestamp(
          Number(payload.webhookTimestamp),
          services.now?.() ?? Date.now(),
          config.allowedClockSkewMs,
        )
      ) {
        return {
          statusCode: 401,
          body: { ok: false, error: 'Stale webhookTimestamp' },
        };
      }

      await appendJsonl(paths.deliveries, {
        receivedAt: new Date().toISOString(),
        type: payload.type ?? null,
        action: payload.action ?? null,
        webhookId: payload.webhookId ?? null,
        linearEventHeader: headers['linear-event'] ?? null,
        linearDeliveryHeader: headers['linear-delivery'] ?? null,
      });

      return {
        statusCode: 200,
        body: {
          ok: true,
          type: payload.type ?? null,
          action: payload.action ?? null,
          dryRun: config.dryRun,
        },
        backgroundPromise: dispatchWebhook(payload, config, paths, services).catch((error) =>
          logProcessingError(paths, payload, error, logger, 'dispatchWebhook')
        ),
      };
    },
  };
}

export function createWebhookServer(config = loadConfig(), services = {}) {
  const { processRequest } = createRequestProcessor(config, services);

  const server = http.createServer((req, res) => {
    void (async () => {
      const response = await processRequest({
        method: req.method,
        url: req.url,
        headers: req.headers,
        rawBody: await readRawBody(req),
      });

      await sendJson(res, response.statusCode, response.body);

      if (response.backgroundPromise) {
        void response.backgroundPromise;
      }
    })().catch(async () => {
      if (!res.headersSent) {
        await sendJson(res, 500, { ok: false, error: 'Internal server error' });
      } else {
        res.end();
      }
    });
  });

  return server;
}

export async function startWebhookServer(config = loadConfig(), services = {}) {
  const server = createWebhookServer(config, services);

  await new Promise((resolve) => {
    server.listen(config.port, resolve);
  });

  return server;
}
