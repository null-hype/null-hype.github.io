import test from 'node:test';
import assert from 'node:assert/strict';
import { compilePolicies, verify, daggerCall } from '../runner.mjs';
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('real hk bundled Pkl in Dagger ignores comments; real verifier uses compiled policy', {
  skip: process.env.GAP_DAGGER_TEST !== '1',
  timeout: 240000
}, async () => {
  const policies = await compilePolicies();
  assert.equal(policies.unadmitted.admitted, false);
  assert.equal(policies.admitted.admitted, true);
  const rejected = await verify(JSON.stringify(policies.unadmitted), {
    translation: 'Schadenfreude'
  });
  assert.equal(rejected.accepted, false);
  const accepted = await verify(JSON.stringify(policies.admitted), {
    translation: 'Schadenfreude'
  });
  assert.equal(accepted.accepted, true);
  assert.equal((await verify(JSON.stringify(policies.admitted), {
    translation: 'malicious joy'
  })).accepted, false);
  assert.equal((await verify(JSON.stringify(policies.admitted), {
    translation: 'Schadenfreude',
    policyId: 'admitted'
  })).accepted, false);
  const dir = await mkdtemp(join(tmpdir(), 'gap-policy-test-'));
  try {
    await cp(new URL('../policy/', import.meta.url), dir, {
      recursive: true
    });
    const path = join(dir, 'unadmitted.pkl');
    const original = await readFile(path, 'utf8');
    await writeFile(path, original.replace('List("Fingerspitzengefühl")', 'List("Fingerspitzengefühl", "Schadenfreude")'));
    const changed = await daggerCall(['compile', `--policy=${dir}`, `--hk=${process.env.HK_BIN}`]);
    assert.equal(changed.unadmitted.admitted, true, 'editing real Pkl then recompiling changes the decision');
    assert.equal((await verify(JSON.stringify(changed.unadmitted), {
      translation: 'Schadenfreude'
    })).accepted, true);
    await writeFile(path, 'amends "Rules.pkl"\nvocabulary = List(\n');
    await assert.rejects(daggerCall(['compile', `--policy=${dir}`, `--hk=${process.env.HK_BIN}`]), 'invalid Pkl must fail compilation');
  } finally {
    await rm(dir, {
      recursive: true,
      force: true
    });
  }
});
