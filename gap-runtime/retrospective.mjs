import { MCPServer } from 'mcp-use';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { z } from 'zod';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const evidenceRoot = process.env.RETRO_EVIDENCE_DIR;
if (!evidenceRoot) throw new Error('RETRO_EVIDENCE_DIR must point to the private retrospective exports.');
const pairs = new Map();
for (const file of (await readdir(evidenceRoot)).filter(f => f.endsWith('.json')).slice(0,100)) {
 const raw = await readFile(resolve(evidenceRoot, file), 'utf8');
 if (Buffer.byteLength(raw) > 4 * 1024 * 1024) throw new Error('Evidence export exceeds 4 MiB.');
 const doc = JSON.parse(raw);
 if (doc.version !== '1' || !/^[a-f0-9]{64}$/.test(doc.before?.id) || !/^[a-f0-9]{64}$/.test(doc.after?.id)) throw new Error('Invalid evidence export.');
 const id = `${doc.before.id.slice(0,12)}..${doc.after.id.slice(0,12)}`;
 if (pairs.has(id)) throw new Error('Ambiguous snapshot pair; narrow the evidence directory.');
 pairs.set(id, { raw, before: doc.before.time, after: doc.after.time });
}
if (!pairs.size) throw new Error('No exported snapshot pairs available.');
const client = new Client({name:'retrospective-bridge',version:'0.1.0'});
const transport = new StdioClientTransport({command:'dagger',args:['mcp','--mod',root],env:{...process.env},stderr:'pipe'});
await client.connect(transport);
transport.stderr?.resume();
await client.callTool({name:'SelectMethods',arguments:{methods:['inspectRetrospective']}});
const schema = z.object({
 pair: z.enum([...pairs.keys()]).describe('Choose one exported before..after snapshot pair. Both snapshots belong to the original comparison.'),
 category: z.enum(['all','session','worktree','monitoring','other']).describe('Start with all. Categories are path heuristics, not judgments of progress.')
}).strict();
const publicOrigin = process.env.RETRO_PUBLIC_ORIGIN;
if (publicOrigin && new URL(publicOrigin).protocol !== 'https:') throw new Error('RETRO_PUBLIC_ORIGIN must use HTTPS.');
const publicHosts = publicOrigin ? [new URL(publicOrigin).hostname] : [];
const server = new MCPServer({name:'restic-retrospective',version:'0.1.0',description:'Read-only investigation of exported restic evidence through native Dagger MCP.',allowedHosts:publicHosts,allowedOrigins:['localhost','127.0.0.1',...publicHosts],cors:{origin:['http://localhost:6274','http://localhost:4322',...(publicOrigin ? [publicOrigin] : [])]}});
const workspaceContext = new AsyncLocalStorage();
const workspaceResults = new Map();
const channelPattern = /^[a-f0-9-]{36}$/;
server.app.use('/mcp', async (c, next) => {
 const channel = c.req.query('workspaceChannel');
 await workspaceContext.run(channelPattern.test(channel || '') ? channel : undefined, next);
});
server.get('/inspector/workspace-results', c => {
 const channel = c.req.query('channel');
 if (!channelPattern.test(channel || '')) return c.json({error:'Invalid channel'},400);
 const entry = workspaceResults.get(channel);
 c.header('cache-control','no-store');
 return c.json({events:entry && Date.now()-entry.at < 300000 ? entry.events : []});
});
function publishWorkspaceResult(result) {
 const channel = workspaceContext.getStore();
 if (!channel) return;
 for (const [key, entry] of workspaceResults) if (Date.now()-entry.at >= 300000) workspaceResults.delete(key);
 if (!workspaceResults.has(channel) && workspaceResults.size >= 100) workspaceResults.delete(workspaceResults.keys().next().value);
 const entry = workspaceResults.get(channel) || {events:[]};
 entry.at = Date.now();
 entry.events = [...entry.events,{callId:randomUUID(),result}].slice(-20);
 workspaceResults.set(channel,entry);
}
// Serve the real Inspector alongside MCP so an authenticated deployment can
// embed a single origin. This preserves Inspector itself rather than recreating it.
const workspaceScript = await readFile(resolve(root, 'inspector-workspace.js'), 'utf8');
server.get('/inspector/workspace-bridge.js', c => c.body(workspaceScript, 200, {
 'content-type':'application/javascript', 'cache-control':'no-store'
}));
server.app.all('/inspector/*', async c => {
 const url = new URL(c.req.url);
 const upstream = await fetch('http://127.0.0.1:6274' + url.pathname + url.search, {
  method:c.req.method,
  headers:{'content-type':c.req.header('content-type') || 'application/json'},
  ...(c.req.method === 'GET' || c.req.method === 'HEAD' ? {} : {body:await c.req.text()})
 });
 const headers = new Headers(upstream.headers);
 headers.delete('content-encoding'); headers.delete('content-length');
 headers.set('cache-control','no-store');
 headers.set('cross-origin-embedder-policy','require-corp');
 headers.set('cross-origin-resource-policy','cross-origin');
 headers.set('content-security-policy',"frame-ancestors 'self' http://localhost:4322 https://null-hype.tidelands.dev https://deploy-preview-38--null-hype-tutorial-app.netlify.app https://dev-gap-retrospective-preview--null-hype-tutorial-app.netlify.app https://6a9fc349cad74d1223486c9b--null-hype-tutorial-app.netlify.app");
 if (headers.get('content-type')?.includes('text/html')) {
  const html = (await upstream.text()).replace('<head>', '<head><script src="/inspector/workspace-bridge.js"></script>');
  return new Response(html,{status:upstream.status,headers});
 }
 return new Response(upstream.body,{status:upstream.status,headers});
});
server.get('/inspector', c => c.redirect('/inspector/' + new URL(c.req.url).search));
server.tool({name:'inspectSnapshotPair',description:'What changed between these snapshots? Returns up to 30 changed-file records, category counts, and extraction limitations. No transcript text, restore, deletion, or arbitrary shell execution.',schema},async input => {
 const args = schema.parse(input);
 const response = await client.callTool({name:'CallMethod',arguments:{method:'inspectRetrospective',args:{evidence:pairs.get(args.pair).raw,category:args.category}}});
 if (response.isError) return {isError:true,content:[{type:'text',text:'Dagger could not inspect this exported pair.'}]};
 // Native Dagger MCP includes execution logs before the method's JSON result.
 // Only return the result document, never its build logs or private arguments.
 const lines = response.content.filter(c => c.type === 'text').flatMap(c => c.text.split('\n'));
 for (const line of lines.reverse()) {
  try {
   const result = JSON.parse(line);
   if (result.source && Number.isInteger(result.totalChanges)) {
    publishWorkspaceResult(result);
    return {content:[{type:'text',text:JSON.stringify(result,null,2)}]};
   }
  } catch {}
 }
 throw new Error('Dagger returned no recognizable investigation result.');
});
server.get('/healthz', c => c.json({ready:true,mode:'exported-evidence',pairs:pairs.size}));
await server.listen(8812,{host:'127.0.0.1'});
console.log('Retrospective bridge ready on http://127.0.0.1:8812/mcp');
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=>{await client.close();process.exit(0);});
