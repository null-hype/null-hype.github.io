import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CapabilityGrant, CapabilityTrace } from './evidence.pkl.ts';
import { checkAccess } from './ledgerCheckAccess';

// The same real trace evidence/capability-trace.json in the file tree to
// the left -- captured by running capability-spike's own `pkl test`
// against pkl/Ledger.pkl (also open to the left). This is the live,
// TutorialKit-run version of the same replay the CapabilityTraceViewer
// panel above does in the browser: if this fails, checkAccess() has
// drifted from the real axiom it claims to mirror.
function loadTrace(): CapabilityTrace {
  return JSON.parse(readFileSync(new URL('./evidence/capability-trace.json', import.meta.url), 'utf-8')) as CapabilityTrace;
}

describe('checkAccess replays capability-spike\'s real trace', () => {
  const trace = loadTrace();

  it('trace ships exactly the ledger.checkAccess axiom', () => {
    expect(trace.checks).toHaveLength(1);
    expect(trace.checks[0].id).toBe('ledger.checkAccess');
    expect(trace.checks[0].constraint).toContain('function checkAccess');
  });

  it('reproduces every evaluation transition\'s recorded verdict from replayed state', () => {
    const grantsByFactId = new Map<string, CapabilityGrant>();
    let evaluationsChecked = 0;

    for (const tr of trace.transitions) {
      if (tr.kind === 'policy-decision' && tr.grant) {
        grantsByFactId.set(tr.grant.factId, tr.grant);
      }
      if (tr.kind !== 'evaluation' || !tr.factId || !tr.vault) {
        continue;
      }
      const verdict = checkAccess(tr.factId, tr.vault, grantsByFactId);
      if (tr.fact) {
        expect(verdict, `transition ${tr.index} (${tr.label})`).not.toBeNull();
        expect(verdict?.code, `transition ${tr.index} (${tr.label})`).toBe(tr.fact.code);
        expect(verdict?.message, `transition ${tr.index} (${tr.label})`).toBe(tr.fact.message);
      } else {
        expect(verdict, `transition ${tr.index} (${tr.label}) recorded no diagnostic -- replay should also clear`).toBeNull();
      }
      evaluationsChecked++;
    }

    expect(evaluationsChecked).toBeGreaterThanOrEqual(3);
  });
});
