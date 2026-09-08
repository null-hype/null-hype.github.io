import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { randomUUID, createHash } from 'node:crypto';
import { MCPServer } from 'mcp-use';
import { z } from 'zod';
const defaultOrigins = [4321, 4322, 6274, 3000, 8787].flatMap(port => [`http://localhost:${port}`, `http://127.0.0.1:${port}`]);
const hash = text => createHash('sha256').update(text).digest('hex');
const exact = (input, keys) => input && typeof input === 'object' && !Array.isArray(input) && Object.keys(input).length === keys.length && keys.every(key => Object.hasOwn(input, key));
export function createBridge({
  policies,
  verify,
  publicUrl = 'http://localhost:8787',
  inspectorUrl = 'http://localhost:6274',
  origins = defaultOrigins
}) {
  const sessions = new Map();
  const sources = structuredClone(policies);
  function snapshot(s) {
    const mcpUrl = `${publicUrl}/mcp/${s.id}`;
    return {
      sessionId: s.id,
      policyId: s.policyId,
      policyHash: s.hash,
      glossary: [...s.glossary],
      events: structuredClone(s.events),
      mcpUrl,
      inspectorUrl: `${inspectorUrl}/inspector?autoConnect=${encodeURIComponent(mcpUrl)}&tab=tools`
    };
  }
  function event(s, method, proposal, accepted, reason, outcome = accepted ? 'accepted' : 'rejected') {
    if (s.events.length >= 200) s.events.shift();
    s.events.push({
      id: randomUUID(),
      at: new Date().toISOString(),
      method,
      translation: typeof proposal?.translation === 'string' ? proposal.translation : null,
      accepted,
      reason,
      outcome,
      policyHash: s.hash
    });
  }
  async function submit(s, proposal, method = 'submitLoanword') {
    // Validate raw input before any schema library can strip unknown keys.
    if (!exact(proposal, ['translation']) || typeof proposal.translation !== 'string' || !proposal.translation.trim() || [...proposal.translation].length > s.runtime.translationMaxLength) {
      const reason = 'Provide only a nonempty translation string; policy overrides and extra fields are forbidden.';
      event(s, method, proposal, false, reason);
      return {
        accepted: false,
        reason,
        ...snapshot(s)
      };
    }
    try {
      const decision = await verify(s.compiled, proposal);
      if (typeof decision.accepted !== 'boolean' || typeof decision.reason !== 'string' || decision.policyHash !== s.hash || typeof decision.translation !== 'string') throw new Error('Invalid verifier result');
      if (decision.accepted && !s.glossary.includes(decision.translation)) s.glossary.push(decision.translation);
      event(s, method, proposal, decision.accepted, decision.reason);
      return {
        accepted: decision.accepted,
        reason: decision.reason,
        ...snapshot(s)
      };
    } catch {
      const reason = 'The verifier could not complete. No glossary change was made.';
      event(s, method, proposal, false, reason, 'error');
      return {
        accepted: false,
        reason,
        ...snapshot(s)
      };
    }
  }
  // Serialize per-session checks so event order and returned snapshots agree.
  function enqueue(s, proposal) {
    const result = s.queue.then(() => submit(s, proposal));
    s.queue = result.catch(() => {});
    return result;
  }
  function createSession(policyId) {
    const policy = sources.find(p => p.id === policyId);
    if (!policy) return null;
    const compiled = JSON.stringify(policy.runtime);
    const s = {
      id: randomUUID(),
      policyId,
      compiled,
      hash: hash(compiled),
      runtime: JSON.parse(compiled),
      glossary: [],
      events: [],
      queue: Promise.resolve()
    };
    s.mcp = new MCPServer({
      name: 'gap-loanword',
      version: '0.1.0',
      basePath: `/mcp/${s.id}`,
      instructions: 'Submit a proposed translation under this session’s immutable authored policy. Callers cannot replace policy.',
      logging: {
        level: 'silent'
      }
    });
    s.mcp.tool({
      name: s.runtime.allowedTool,
      description: 'Submit a translation; only an admitted proposal changes the session glossary.',
      inputSchema: z.object({
        translation: z.string().min(1).max(s.runtime.translationMaxLength)
      }).strict()
    }, async proposal => {
      const result = await enqueue(s, proposal);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result)
        }],
        isError: !result.accepted
      };
    });
    sessions.set(s.id, s);
    return s;
  }
  const server = createServer(async (req, res) => {
    const json = (status, data) => {
      res.writeHead(status, {
        'Content-Type': 'application/json'
      });
      res.end(JSON.stringify(data));
    };
    try {
      const origin = req.headers.origin;
      if (origin && !origins.includes(origin)) return json(403, {
        error: 'Origin is not allowed.'
      });
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
      }
      res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,MCP-Protocol-Version,Mcp-Session-Id');
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
      }
      const url = new URL(req.url, publicUrl);
      if (url.search) return json(400, {
        error: 'Query overrides are not supported.'
      });
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 16384) return json(413, {
          error: 'Request too large.'
        });
      }
      let body;
      try {
        body = raw ? JSON.parse(raw) : undefined;
      } catch {
        return json(400, {
          error: 'Invalid JSON.'
        });
      }
      if (url.pathname === '/policies' && req.method === 'GET') return json(200, {
        policies: structuredClone(sources)
      });
      if (url.pathname === '/sessions' && req.method === 'POST') {
        if (!exact(body, ['policyId']) || typeof body.policyId !== 'string') return json(400, {
          error: 'Provide only policyId.'
        });
        if (sessions.size >= 1000) return json(429, {
          error: 'Workshop session limit reached; restart runtime.'
        });
        const s = createSession(body.policyId);
        return s ? json(201, snapshot(s)) : json(400, {
          error: 'Unknown authored policy.'
        });
      }
      const match = url.pathname.match(/^\/(sessions|mcp)\/([0-9a-f-]+)(\/submit)?$/);
      if (!match) return json(404, {
        error: 'Not found.'
      });
      const s = sessions.get(match[2]);
      if (!s) return json(404, {
        error: 'Unknown session.'
      });
      if (match[1] === 'sessions') {
        if (req.method === 'GET' && !match[3]) return json(200, snapshot(s));
        if (req.method === 'POST' && match[3]) return json(200, await enqueue(s, body));
        return json(405, {
          error: 'Method not allowed.'
        });
      }
      if (match[3]) return json(404, {
        error: 'Not found.'
      });
      if (req.method === 'POST' && body?.method === 'tools/call') {
        // MCP clients may attach protocol metadata, such as a progress token.
        // It never becomes proposal input or changes the bound policy.
        const validEnvelope = exact(body.params, ['name', 'arguments']) ||
          (exact(body.params, ['name', 'arguments', '_meta']) && body.params._meta !== null &&
            typeof body.params._meta === 'object' && !Array.isArray(body.params._meta));
        if (body.params?.name !== s.runtime.allowedTool || !validEnvelope || !exact(body.params.arguments, ['translation']) || typeof body.params.arguments.translation !== 'string' || !body.params.arguments.translation.trim() || [...body.params.arguments.translation].length > s.runtime.translationMaxLength) {
          const reason = 'Unknown tool or forbidden argument; execution was blocked.';
          event(s, body.params?.name || 'unknown', body.params?.arguments, false, reason);
          return json(200, {
            jsonrpc: '2.0',
            id: body.id ?? null,
            error: {
              code: -32602,
              message: reason
            }
          });
        }
      }
      const headers = new Headers(req.headers);
      headers.delete('host');
      const response = await s.mcp.fetch(new Request(`${publicUrl}${url.pathname}`, {
        method: req.method,
        headers,
        ...(raw ? {
          body: raw
        } : {})
      }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (!response.body) return res.end();
      const stream = Readable.fromWeb(response.body);
      res.on('close', () => stream.destroy());
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    } catch (error) {
      console.error(error.message);
      if (!res.headersSent) json(500, {
        error: 'Runtime request failed.'
      });else res.end();
    }
  });
  return {
    server,
    sessions
  };
}
