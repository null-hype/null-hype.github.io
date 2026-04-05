import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  createRequestProcessor,
  createSignature,
  isFreshTimestamp,
  verifySignature,
} from './app.mjs';

async function createTestProcessor({ config: configOverrides = {}, services: serviceOverrides = {} } = {}) {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), 'linear-agent-test-'));
  const webhookSecret = 'test-secret';
  const config = {
    port: 0,
    webhookSecret,
    oauthAccessToken: '',
    graphqlEndpoint: 'https://api.linear.app/graphql',
    allowedClockSkewMs: 60000,
    runtimeDir,
    dryRun: true,
    agentName: 'Test Harness',
    julesProxyUrl: '',
    julesProxyToken: '',
    ...configOverrides,
  };
  const processor = createRequestProcessor(config, {
    logger: {
      error() {},
    },
    ...serviceOverrides,
  });

  return {
    runtimeDir,
    webhookSecret,
    processor,
  };
}

test('verifySignature accepts exact raw body signatures', () => {
  const rawBody = Buffer.from('{"hello":"world"}');
  const secret = 'test-secret';
  const signature = createSignature(secret, rawBody);

  assert.equal(verifySignature(secret, signature, rawBody), true);
  assert.equal(verifySignature(secret, 'bad-signature', rawBody), false);
});

test('isFreshTimestamp rejects stale deliveries', () => {
  const now = Date.now();

  assert.equal(isFreshTimestamp(now, now, 60000), true);
  assert.equal(isFreshTimestamp(now - 61000, now, 60000), false);
});

test('AgentSessionEvent created is accepted and writes dry-run activities', async () => {
  const { runtimeDir, webhookSecret, processor } = await createTestProcessor();
  const now = Date.now();
  const payload = {
    type: 'AgentSessionEvent',
    action: 'created',
    createdAt: new Date(now).toISOString(),
    organizationId: 'org_test',
    oauthClientId: 'oauth_test',
    appUserId: 'app_user_test',
    webhookTimestamp: now,
    webhookId: 'wh_test_created',
    promptContext: '<issue identifier="PLAN-101"><title>Spike</title></issue>',
    agentSession: {
      id: 'session_created',
      issue: {
        id: 'issue_created',
        identifier: 'PLAN-101',
        title: 'Spike: Deploy minimal Linear agent',
      },
    },
  };
  const rawBody = JSON.stringify(payload);

  const response = await processor.processRequest({
    method: 'POST',
    url: '/webhooks/linear',
    headers: {
      'content-type': 'application/json',
      'linear-event': payload.type,
      'linear-delivery': payload.webhookId,
      'linear-signature': createSignature(webhookSecret, rawBody),
    },
    rawBody: Buffer.from(rawBody),
  });

  assert.equal(response.statusCode, 200);
  await response.backgroundPromise;

  const activityLog = await readFile(path.join(runtimeDir, 'activities.jsonl'), 'utf8');
  assert.match(activityLog, /"type":"thought"/);
  assert.match(activityLog, /"type":"response"/);
});

test('AgentSessionEvent created dispatches to Jules when configured', async () => {
  const fetchCalls = [];
  const { runtimeDir, webhookSecret, processor } = await createTestProcessor({
    config: {
      julesProxyUrl: 'https://jules.tidelands.dev',
      julesProxyToken: 'proxy-token',
    },
    services: {
      fetchImpl: async (url, init) => {
        fetchCalls.push({ url, init });
        return new Response(
          JSON.stringify({
            name: 'sessions/session-live',
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        );
      },
    },
  });
  const now = Date.now();
  const payload = {
    type: 'AgentSessionEvent',
    action: 'created',
    createdAt: new Date(now).toISOString(),
    organizationId: 'org_test',
    oauthClientId: 'oauth_test',
    appUserId: 'app_user_test',
    webhookTimestamp: now,
    webhookId: 'wh_test_dispatch',
    promptContext: '<issue identifier="PLAN-234"><title>Wire Jules</title></issue>',
    agentSession: {
      id: 'session_created',
      issue: {
        id: 'issue_created',
        identifier: 'PLAN-234',
        title: 'Wire Jules dispatch',
        description: 'Issue body markdown',
      },
    },
  };
  const rawBody = JSON.stringify(payload);

  const response = await processor.processRequest({
    method: 'POST',
    url: '/webhooks/linear',
    headers: {
      'content-type': 'application/json',
      'linear-event': payload.type,
      'linear-delivery': payload.webhookId,
      'linear-signature': createSignature(webhookSecret, rawBody),
    },
    rawBody: Buffer.from(rawBody),
  });

  assert.equal(response.statusCode, 200);
  await response.backgroundPromise;

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, 'https://jules.tidelands.dev/api/dispatch');
  assert.equal(fetchCalls[0].init.method, 'POST');
  assert.equal(fetchCalls[0].init.headers.authorization, 'Bearer proxy-token');
  assert.deepEqual(JSON.parse(fetchCalls[0].init.body), {
    promptContext: '<issue identifier="PLAN-234"><title>Wire Jules</title></issue>',
    issueId: 'issue_created',
    issueIdentifier: 'PLAN-234',
  });

  const activityLog = await readFile(path.join(runtimeDir, 'activities.jsonl'), 'utf8');
  assert.match(activityLog, /"type":"thought"/);
  assert.match(activityLog, /"type":"response"/);
});

test('AppUserNotification contributes to the matrix summary', async () => {
  const { webhookSecret, processor } = await createTestProcessor();
  const now = Date.now();
  const payload = {
    type: 'AppUserNotification',
    action: 'issueStatusChanged',
    createdAt: new Date(now).toISOString(),
    organizationId: 'org_test',
    oauthClientId: 'oauth_test',
    appUserId: 'app_user_test',
    webhookTimestamp: now,
    webhookId: 'wh_test_notification',
    notification: {
      issue: {
        id: 'issue_notification',
        identifier: 'PLAN-101',
        title: 'Spike: Deploy minimal Linear agent',
        project: {
          id: 'project_security_research',
          name: 'Security Research',
        },
      },
    },
  };
  const rawBody = JSON.stringify(payload);

  const response = await processor.processRequest({
    method: 'POST',
    url: '/webhooks/linear',
    headers: {
      'content-type': 'application/json',
      'linear-event': payload.type,
      'linear-delivery': payload.webhookId,
      'linear-signature': createSignature(webhookSecret, rawBody),
    },
    rawBody: Buffer.from(rawBody),
  });

  assert.equal(response.statusCode, 200);
  await response.backgroundPromise;

  const matrixResponse = await processor.processRequest({
    method: 'GET',
    url: '/matrix',
  });
  const matrix = matrixResponse.body;

  assert.equal(matrix.totalNotifications, 1);
  assert.equal(matrix.actions.issueStatusChanged.count, 1);
});

test('AgentSessionEvent stop signal records only a terminal response', async () => {
  const { runtimeDir, webhookSecret, processor } = await createTestProcessor();
  const now = Date.now();
  const payload = {
    type: 'AgentSessionEvent',
    action: 'prompted',
    createdAt: new Date(now).toISOString(),
    organizationId: 'org_test',
    oauthClientId: 'oauth_test',
    appUserId: 'app_user_test',
    webhookTimestamp: now,
    webhookId: 'wh_test_stop',
    agentSession: {
      id: 'session_stop',
    },
    agentActivity: {
      id: 'activity_stop',
      type: 'prompt',
      body: 'Stop',
      signal: 'stop',
    },
  };
  const rawBody = JSON.stringify(payload);

  const response = await processor.processRequest({
    method: 'POST',
    url: '/webhooks/linear',
    headers: {
      'content-type': 'application/json',
      'linear-event': payload.type,
      'linear-delivery': payload.webhookId,
      'linear-signature': createSignature(webhookSecret, rawBody),
    },
    rawBody: Buffer.from(rawBody),
  });

  assert.equal(response.statusCode, 200);
  await response.backgroundPromise;

  const activityLog = await readFile(path.join(runtimeDir, 'activities.jsonl'), 'utf8');
  const entries = activityLog
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));

  assert.equal(entries.length, 1);
  assert.equal(entries[0].content.type, 'response');
  assert.match(entries[0].content.body, /stop signal/i);
});

test('Jules dispatch failures are logged without failing the webhook response', async () => {
  const { runtimeDir, webhookSecret, processor } = await createTestProcessor({
    config: {
      julesProxyUrl: 'https://jules.tidelands.dev',
    },
    services: {
      fetchImpl: async () =>
        new Response(JSON.stringify({ ok: false, error: 'upstream failure' }), {
          status: 502,
          headers: {
            'content-type': 'application/json',
          },
        }),
    },
  });
  const now = Date.now();
  const payload = {
    type: 'AgentSessionEvent',
    action: 'created',
    createdAt: new Date(now).toISOString(),
    organizationId: 'org_test',
    oauthClientId: 'oauth_test',
    appUserId: 'app_user_test',
    webhookTimestamp: now,
    webhookId: 'wh_test_dispatch_failure',
    promptContext: '<issue identifier="PLAN-235"><title>Dispatch failure</title></issue>',
    agentSession: {
      id: 'session_created',
      issue: {
        id: 'issue_created',
        identifier: 'PLAN-235',
        title: 'Wire Jules dispatch',
      },
    },
  };
  const rawBody = JSON.stringify(payload);

  const response = await processor.processRequest({
    method: 'POST',
    url: '/webhooks/linear',
    headers: {
      'content-type': 'application/json',
      'linear-event': payload.type,
      'linear-delivery': payload.webhookId,
      'linear-signature': createSignature(webhookSecret, rawBody),
    },
    rawBody: Buffer.from(rawBody),
  });

  assert.equal(response.statusCode, 200);
  await response.backgroundPromise;

  const activityLog = await readFile(path.join(runtimeDir, 'activities.jsonl'), 'utf8');
  assert.match(activityLog, /"type":"thought"/);
  assert.match(activityLog, /"type":"response"/);

  const errorLog = await readFile(path.join(runtimeDir, 'errors.jsonl'), 'utf8');
  assert.match(errorLog, /Jules dispatch failed: 502/);
  assert.match(errorLog, /AgentSessionEvent/);
});
