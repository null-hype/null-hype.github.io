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

async function createTestProcessor() {
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
    projectUpdatesEnabled: true,
    projectUpdateDryRun: true,
    projectUpdateHealth: 'onTrack',
    projectUpdateHideDiff: true,
    agentName: 'Test Harness',
  };
  const processor = createRequestProcessor(config, {
    logger: {
      error() {},
    },
  });

  return {
    runtimeDir,
    webhookSecret,
    processor,
  };
}

async function readJsonlEntries(filePath) {
  const contents = await readFile(filePath, 'utf8');
  return contents
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
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

test('AgentSessionEvent response writes a dry-run project update for the issue project', async () => {
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
    webhookId: 'wh_test_project_update',
    agentSession: {
      id: 'session_project_update',
      issue: {
        id: 'issue_project_update',
        identifier: 'PLAN-201',
        title: 'Post project updates when agent work completes',
        project: {
          id: 'project_test',
          name: 'Test Project',
        },
      },
    },
    agentActivity: {
      id: 'activity_project_update',
      type: 'prompt',
      body: 'Finish the task and summarize the result.',
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

  const projectUpdates = await readJsonlEntries(path.join(runtimeDir, 'project-updates.jsonl'));

  assert.equal(projectUpdates.length, 1);
  assert.equal(projectUpdates[0].mode, 'dry-run');
  assert.equal(projectUpdates[0].projectId, 'project_test');
  assert.match(projectUpdates[0].body, /PLAN-201/);
  assert.match(projectUpdates[0].body, /Test Harness is wired correctly/i);
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

  const entries = await readJsonlEntries(path.join(runtimeDir, 'activities.jsonl'));

  assert.equal(entries.length, 1);
  assert.equal(entries[0].content.type, 'response');
  assert.match(entries[0].content.body, /stop signal/i);
  await assert.rejects(readFile(path.join(runtimeDir, 'project-updates.jsonl'), 'utf8'), {
    code: 'ENOENT',
  });
});

test('AgentSessionEvent looks up the issue project and posts a live project update mutation', async () => {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), 'linear-agent-test-'));
  const webhookSecret = 'test-secret';
  const fetchCalls = [];
  const processor = createRequestProcessor(
    {
      port: 0,
      webhookSecret,
      oauthAccessToken: 'oauth-access-token',
      graphqlEndpoint: 'https://api.linear.app/graphql',
      allowedClockSkewMs: 60000,
      runtimeDir,
      dryRun: true,
      projectUpdatesEnabled: true,
      projectUpdateDryRun: false,
      projectUpdateHealth: 'onTrack',
      projectUpdateHideDiff: true,
      agentName: 'Test Harness',
    },
    {
      fetchImpl: async (_url, init) => {
        const request = JSON.parse(init.body);
        fetchCalls.push({
          authorization: init.headers.authorization,
          body: request,
        });

        if (request.query.includes('query IssueProject')) {
          return new Response(
            JSON.stringify({
              data: {
                issue: {
                  id: 'issue_live_project_update',
                  identifier: 'PLAN-301',
                  title: 'Resolve project from issue lookup',
                  state: {
                    name: 'Done',
                    type: 'completed',
                  },
                  project: {
                    id: 'project_live',
                    name: 'Live Test Project',
                  },
                },
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }

        if (request.query.includes('mutation ProjectUpdateCreate')) {
          return new Response(
            JSON.stringify({
              data: {
                projectUpdateCreate: {
                  success: true,
                  projectUpdate: {
                    id: 'project_update_live',
                  },
                },
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }

        throw new Error(`Unexpected GraphQL request: ${request.query}`);
      },
      logger: {
        error() {},
      },
    },
  );
  const now = Date.now();
  const payload = {
    type: 'AgentSessionEvent',
    action: 'prompted',
    createdAt: new Date(now).toISOString(),
    organizationId: 'org_test',
    oauthClientId: 'oauth_test',
    appUserId: 'app_user_test',
    webhookTimestamp: now,
    webhookId: 'wh_test_live_project_update',
    agentSession: {
      id: 'session_live_project_update',
      issue: {
        id: 'issue_live_project_update',
        identifier: 'PLAN-301',
        title: 'Resolve project from issue lookup',
      },
    },
    agentActivity: {
      id: 'activity_live_project_update',
      type: 'prompt',
      body: 'Complete the issue and report the result.',
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

  assert.equal(fetchCalls.length, 2);
  assert.equal(fetchCalls[0].authorization, 'Bearer oauth-access-token');
  assert.match(fetchCalls[0].body.query, /query IssueProject/);
  assert.equal(fetchCalls[1].authorization, 'Bearer oauth-access-token');
  assert.match(fetchCalls[1].body.query, /mutation ProjectUpdateCreate/);
  assert.deepEqual(fetchCalls[1].body.variables.input, {
    projectId: 'project_live',
    body: [
      'Test Harness finished work for **PLAN-301 Resolve project from issue lookup**.',
      '- Project: **Live Test Project**',
      '- Issue status: **Done**',
      '- Agent session: `session_live_project_update`',
      '',
      'Test Harness is wired correctly on the local Node webhook path. This confirms the session webhook was received and the agent activity pipeline is ready for live delegation tests.',
    ].join('\n'),
    health: 'onTrack',
    isDiffHidden: true,
  });

  const projectUpdates = await readJsonlEntries(path.join(runtimeDir, 'project-updates.jsonl'));
  assert.equal(projectUpdates.length, 1);
  assert.equal(projectUpdates[0].projectUpdateId, 'project_update_live');
});
