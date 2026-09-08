// Versioned boundary between a tool response and editor operations.
export function evidenceFiles(result, run) {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(run)) throw new Error('Invalid run identifier');
  if (!result || JSON.stringify(result).length > 131072) throw new Error('Evidence is missing or too large');
  for (const snapshot of [result.before, result.after]) {
    if (!snapshot || !/^[a-f0-9]{64}$/.test(snapshot.id)) throw new Error('Invalid snapshot identity');
  }
  if (!Array.isArray(result.changes) || result.changes.length > 30 ||
      result.returnedChanges !== result.changes.length || !Number.isInteger(result.totalChanges) ||
      result.totalChanges < result.returnedChanges || typeof result.source !== 'string' ||
      typeof result.limitations !== 'string') throw new Error('Invalid evidence manifest');
  const root = `/evidence/${run}`;
  const files = { [`${root}/comparison.json`]: JSON.stringify({
    category: result.category, returnedChanges: result.returnedChanges,
    totalChanges: result.totalChanges, source: result.source, limitations: result.limitations,
    ...result,
  }, null, 2) };
  for (const change of result.changes) {
    if (typeof change.path !== 'string' || change.path.length > 2048 || !change.path.startsWith('/') ||
        /[\\\x00-\x1f\x7f]/.test(change.path) ||
        change.path.slice(1).split('/').some(s => !s || s === '.' || s === '..')) throw new Error('Unsafe evidence path');
    const path = `${root}/changes${change.path}.metadata.json`;
    if (Object.hasOwn(files, path)) throw new Error('Duplicate evidence path');
    files[path] = JSON.stringify({ ...change, kind: 'change-metadata', capturedContents: false,
      before: result.before.id, after: result.after.id }, null, 2);
  }
  return files;
}
