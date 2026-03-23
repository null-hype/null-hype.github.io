import crypto from 'node:crypto';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const targetUrl = process.env.WEBHOOK_URL ?? `http://127.0.0.1:${port}/webhooks/linear`;
const webhookSecret = process.env.LINEAR_WEBHOOK_SECRET ?? '';
const webhookKind = process.argv[2] ?? 'created';
const notificationAction = process.argv[3] ?? 'issueStatusChanged';

if (!webhookSecret) {
  console.error('LINEAR_WEBHOOK_SECRET is required to sign the mock payload.');
  process.exit(1);
}

function createSignature(rawBody) {
  return crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
}

function createBasePayload(type, action) {
  const now = Date.now();

  return {
    type,
    action,
    createdAt: new Date(now).toISOString(),
    organizationId: 'org_test',
    oauthClientId: 'oauth_test',
    appUserId: 'app_user_test',
    webhookTimestamp: now,
    webhookId: crypto.randomUUID(),
  };
}

function createPayload(kind) {
  switch (kind) {
    case 'created':
      return {
        ...createBasePayload('AgentSessionEvent', 'created'),
        promptContext:
          '<issue identifier="PLAN-101"><title>Spike: Deploy minimal Linear agent</title></issue>',
        agentSession: {
          id: 'session_test_created',
          issue: {
            id: 'issue_test_created',
            identifier: 'PLAN-101',
            title: 'Spike: Deploy minimal Linear agent, validate project-member notification stream',
          },
        },
        url: 'https://linear.app/tidelands2/issue/PLAN-101/spike',
      };
    case 'prompted':
      return {
        ...createBasePayload('AgentSessionEvent', 'prompted'),
        agentSession: {
          id: 'session_test_prompted',
          issue: {
            id: 'issue_test_prompted',
            identifier: 'PLAN-101',
            title: 'Spike: Deploy minimal Linear agent, validate project-member notification stream',
          },
        },
        agentActivity: {
          id: 'activity_prompt_test',
          type: 'prompt',
          body: 'Please summarize what is wired up locally.',
        },
      };
    case 'stop':
      return {
        ...createBasePayload('AgentSessionEvent', 'prompted'),
        agentSession: {
          id: 'session_test_stop',
        },
        agentActivity: {
          id: 'activity_stop_test',
          type: 'prompt',
          body: 'Stop',
          signal: 'stop',
        },
      };
    case 'notification':
      return {
        ...createBasePayload('AppUserNotification', notificationAction),
        notification: {
          issue: {
            id: 'issue_test_notification',
            identifier: 'PLAN-101',
            title: 'Spike: Deploy minimal Linear agent, validate project-member notification stream',
            project: {
              id: 'project_security_research',
              name: 'Security Research',
            },
          },
        },
      };
    default:
      throw new Error(`Unsupported mock payload kind: ${kind}`);
  }
}

const payload = createPayload(webhookKind);
const rawBody = JSON.stringify(payload);

const response = await fetch(targetUrl, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'linear-event': payload.type,
    'linear-delivery': payload.webhookId,
    'linear-signature': createSignature(rawBody),
  },
  body: rawBody,
});

console.log(`POST ${targetUrl}`);
console.log(`status=${response.status}`);
console.log(await response.text());
