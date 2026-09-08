import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const execute = promisify(execFile);
export const root = fileURLToPath(new URL('.', import.meta.url));
export async function daggerCall(args) {
  const {
    stdout
  } = await execute(process.env.DAGGER_BIN || 'dagger', ['call', ...args], {
    cwd: root,
    timeout: 180000,
    maxBuffer: 4 * 1024 * 1024
  });
  return JSON.parse(stdout);
}
export async function compilePolicies() {
  const hk = process.env.HK_BIN;
  if (!hk) throw new Error('Set HK_BIN to the installed hk 1.57.0 binary (its bundled Pkl evaluator is used).');
  return daggerCall(['compile', '--policy=policy', `--hk=${hk}`]);
}
export async function verify(compiled, proposal) {
  return daggerCall(['verify', `--compiled=${compiled}`, `--proposal=${JSON.stringify(proposal)}`]);
}
