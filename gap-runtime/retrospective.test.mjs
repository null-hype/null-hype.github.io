import test from 'node:test';
import assert from 'node:assert/strict';

async function rpc(method, params, channel = '') {
 const r = await fetch('http://127.0.0.1:8812/mcp' + (channel ? '?workspaceChannel='+channel : ''), {
  method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream'},
  body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})
 });
 const body = await r.text();
 return JSON.parse(body.startsWith('event:') ? body.split('\n').find(l=>l.startsWith('data:')).slice(5) : body);
}
test('real Dagger MCP exposes bounded evidence choices and rejects invalid proposals', async()=>{
 const listed = await rpc('tools/list',{});
 assert.deepEqual(listed.result.tools.map(t=>t.name),['inspectSnapshotPair']);
 const schema = listed.result.tools[0].inputSchema;
 const pair = schema.properties.pair.enum[0];
 assert.ok(pair);
 assert.ok(schema.properties.category.enum.includes('session'));
 for (const input of [{pair,category:'shell'}, {pair:'unknown',category:'all'}, {pair,category:'all',command:'id'}]) {
  const rejected = await rpc('tools/call',{name:'inspectSnapshotPair',arguments:input});
  assert.ok(rejected.error || rejected.result?.isError,JSON.stringify(rejected));
 }
 const result = await rpc('tools/call',{name:'inspectSnapshotPair',arguments:{pair,category:'all'}});
 assert.ok(!result.error && !result.result.isError,JSON.stringify(result));
 const evidence = JSON.parse(result.result.content[0].text);
 assert.ok(evidence.before.id && evidence.after.id);
 assert.ok(evidence.returnedChanges <= 30);
 assert.equal(evidence.returnedChanges,evidence.changes.length);
 assert.equal(evidence.events,undefined);
 assert.match(evidence.limitations,/bounded/);
 const filtered = await rpc('tools/call',{name:'inspectSnapshotPair',arguments:{pair,category:'session'}});
 const sessions = JSON.parse(filtered.result.content[0].text);
 assert.ok(sessions.changes.every(c=>c.category==='session'));
 assert.equal(sessions.totalChanges,evidence.totalChanges);
});
test('workspace channel receives only its own successful comparison results',async()=>{
 const channel=crypto.randomUUID();
 const other=crypto.randomUUID();
 const events=async c=>(await (await fetch('http://127.0.0.1:8812/inspector/workspace-results?channel='+c)).json()).events;
 const listed=await rpc('tools/list',{});
 const pair=listed.result.tools[0].inputSchema.properties.pair.enum[0];
 await rpc('tools/call',{name:'inspectSnapshotPair',arguments:{pair,category:'session'}},channel);
 assert.equal((await events(channel)).length,1);
 assert.equal((await events(channel))[0].result.category,'session');
 assert.deepEqual(await events(other),[]);
 await rpc('tools/call',{name:'inspectSnapshotPair',arguments:{pair,category:'invalid'}},channel);
 assert.equal((await events(channel)).length,1);
});
