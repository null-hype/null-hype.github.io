import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createBridge } from '../bridge.mjs';
const runtime = {
  canonicalWord: 'Schadenfreude',
  requireVocabularyAdmission: true,
  allowedTool: 'submitLoanword',
  translationMaxLength: 120,
  admitted: true
};
async function fixture(t, verifier) {
  let calls = 0;
  const policies = [{
    id: 'admitted',
    label: 'Admitted',
    source: 'test',
    runtime: structuredClone(runtime)
  }];
  const {
    server
  } = createBridge({
    policies,
    verify: verifier || (async (compiled, p) => {
      calls++;
      return {
        accepted: p.translation === 'Schadenfreude' && JSON.parse(compiled).admitted,
        translation: p.translation,
        reason: 'decision',
        policyHash: createHash('sha256').update(compiled).digest('hex')
      };
    })
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, body, headers = {}) => {
    const r = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      ...(body === undefined ? {} : {
        body: JSON.stringify(body)
      })
    });
    const text = await r.text();
    return {
      status: r.status,
      data: JSON.parse(text.startsWith("event:") ? text.split("\n").find(line => line.startsWith("data:")).slice(5) : text)
    };
  };
  const {
    data: session
  } = await request('/sessions', {
    policyId: 'admitted'
  });
  return {
    request,
    session,
    policies,
    calls: () => calls
  };
}
test('strict input gate, acceptance and later rejection preserve glossary', async t => {
  const f = await fixture(t);
  const path = `/sessions/${f.session.sessionId}/submit`;
  for (const bad of [{
    translation: 'Schadenfreude',
    policyId: 'admitted'
  }, {
    translation: 42
  }, {
    translation: ''
  }, {
    translation: 'x'.repeat(121)
  }, null]) {
    const {
      data
    } = await f.request(path, bad);
    assert.equal(data.accepted, false);
    assert.deepEqual(data.glossary, []);
  }
  assert.equal(f.calls(), 0);
  const accepted = (await f.request(path, {
    translation: 'Schadenfreude'
  })).data;
  assert.equal(accepted.accepted, true);
  assert.deepEqual(accepted.glossary, ['Schadenfreude']);
  const denied = (await f.request(path, {
    translation: 'malicious joy'
  })).data;
  assert.equal(denied.accepted, false);
  assert.deepEqual(denied.glossary, ['Schadenfreude']);
  f.policies[0].runtime.admitted = false;
  assert.equal((await f.request(path, {
    translation: 'Schadenfreude'
  })).data.accepted, true);
});
test('verifier failure and forged verifier digest never mutate glossary', async t => {
  for (const verifier of [async () => {
    throw Error('offline');
  }, async () => ({
    accepted: true,
    reason: 'forged',
    translation: 'x',
    policyHash: 'wrong'
  })]) {
    const f = await fixture(t, verifier);
    const {
      data
    } = await f.request(`/sessions/${f.session.sessionId}/submit`, {
      translation: 'Schadenfreude'
    });
    assert.deepEqual(data.glossary, []);
    assert.equal(data.events.at(-1).outcome, 'error');
  }
});
test('MCP unknown tools and extra fields cannot reach verifier; CORS denies arbitrary origins', async t => {
  const f = await fixture(t);
  const path = `/mcp/${f.session.sessionId}`;
  for (const params of [{
    name: 'execute',
    arguments: {
      translation: 'Schadenfreude'
    }
  }, {
    name: 'submitLoanword',
    arguments: {
      translation: 'Schadenfreude',
      policyId: 'admitted'
    }
  }]) {
    const {
      data
    } = await f.request(path, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params
    }, {
      Accept: 'application/json, text/event-stream'
    });
    assert.equal(data.error.code, -32602);
  }
  assert.equal(f.calls(), 0);
  assert.equal((await f.request('/policies', undefined, {
    Origin: 'https://evil.example'
  })).status, 403);
  assert.equal((await f.request(`/sessions/${f.session.sessionId}?policyId=admitted`)).status, 400);
});
test('MCP advertises typed tool and executes through same gate', async t => {
  const f = await fixture(t);
  const path = `/mcp/${f.session.sessionId}`;
  const headers = {
    Accept: 'application/json, text/event-stream'
  };
  const list = await f.request(path, {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  }, headers);
  assert.equal(list.status, 200);
  assert.equal(list.data.result.tools[0].name, 'submitLoanword');
  assert.deepEqual(list.data.result.tools[0].inputSchema.required, ['translation']);
  const result = await f.request(path, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'submitLoanword',
      _meta: { progressToken: 5 },
      arguments: {
        translation: 'Schadenfreude'
      }
    }
  }, headers);
  assert.equal(result.status, 200);
  assert.deepEqual(JSON.parse(result.data.result.content[0].text).glossary, ['Schadenfreude']);
  assert.equal(f.calls(), 1);
});
