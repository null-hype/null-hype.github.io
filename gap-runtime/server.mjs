import { readFile } from 'node:fs/promises';
import { createBridge } from './bridge.mjs';
import { compilePolicies, verify } from './runner.mjs';
const compiled = await compilePolicies();
const rules = await readFile(new URL('./policy/Rules.pkl', import.meta.url), 'utf8');
const hook = await readFile(new URL('./policy/hk.pkl', import.meta.url), 'utf8');
const policies = await Promise.all(['unadmitted', 'admitted'].map(async id => ({
  id,
  label: id === 'admitted' ? 'Word admitted' : 'Word not admitted',
  source: `// Rules.pkl\n${rules}\n// ${id}.pkl\n${await readFile(new URL(`./policy/${id}.pkl`, import.meta.url), 'utf8')}\n// hk.pkl (compiler hook)\n${hook}`,
  runtime: compiled[id]
})));
const port = Number(process.env.PORT || 8787);
const {
  server
} = createBridge({
  policies,
  verify,
  publicUrl: process.env.GAP_PUBLIC_URL || `http://localhost:${port}`,
  inspectorUrl: process.env.GAP_INSPECTOR_URL || 'http://localhost:6274'
});
server.listen(port, '127.0.0.1', () => console.log(`GAP runtime ready at http://localhost:${port}; compiled with hk 1.57.0 bundled Pkl in Dagger.`));
