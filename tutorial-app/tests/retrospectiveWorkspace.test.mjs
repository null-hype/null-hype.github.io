import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evidenceFiles } from '../src/lib/retrospectiveWorkspace.mjs';
const result = { before:{id:'a'.repeat(64)}, after:{id:'b'.repeat(64)},
 changes:[{path:'/.claude/jobs/log.txt',category:'monitoring'}], returnedChanges:1,totalChanges:1,source:'Export',limitations:'Metadata only' };
test('maps changed paths to labelled metadata in a separate run directory', () => {
 const files=evidenceFiles(result,'run-1');
 assert.equal(Object.keys(files).length,2);
 assert.equal(JSON.parse(files['/evidence/run-1/changes/.claude/jobs/log.txt.metadata.json']).capturedContents,false);
 assert.ok(Object.keys(files).every(path=>path.startsWith('/evidence/run-1/')));
});
test('rejects traversal, malformed counts, excessive rows, and duplicate paths before editor writes', () => {
 for (const path of ['/../plan.md','/x/../../plan.md','/x\\plan.md','//plan.md','/x/./plan.md','relative']) {
  assert.throws(()=>evidenceFiles({...result,changes:[{path}]},'run-1'));
 }
 assert.throws(()=>evidenceFiles({...result,returnedChanges:2},'run-1'));
 assert.throws(()=>evidenceFiles({...result,changes:Array(31).fill(result.changes[0]),returnedChanges:31,totalChanges:31},'run-1'));
 assert.throws(()=>evidenceFiles({...result,changes:[...result.changes,...result.changes],returnedChanges:2,totalChanges:2},'run-1'));
});
