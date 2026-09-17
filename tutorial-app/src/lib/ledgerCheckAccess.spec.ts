import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CapabilityGrant, CapabilityTrace } from './evidence.pkl';
import { checkAccess } from './ledgerCheckAccess';

// The real captured trace this lesson ships -- see
// capability-spike/main.go's `writeTrace`/`loadApprovalCheck` for how it
// was produced (a real `pkl test` run against pkl/Ledger.pkl, not
// scripted). This is the same file the lesson's WebContainer file tree and
// terminal-run test (see this lesson's package.json) both read.
const FIXTURE_URL = new URL(
  '../content/tutorial/part-1/chapter-3/lesson-2/_files/evidence/capability-trace.json',
  import.meta.url,
);

function loadTrace(): CapabilityTrace {
  return JSON.parse(readFileSync(FIXTURE_URL, 'utf-8')) as CapabilityTrace;
}

/**
 * This is the conformance test for ledgerCheckAccess.ts: it does not test
 * the TS evaluator against expectations this file invents. It replays the
 * real trace's own recorded events -- policy-decision transitions fold
 * into grant state, evaluation transitions are the fact/vault pairs
 * actually checked -- through the TS evaluator, and asserts the result
 * matches what capability-spike's real `pkl test` run against
 * pkl/Ledger.pkl actually recorded for that same event (trace.transitions[
 * i].fact, or no fact when the real run passed clean). If this ever
 * fails, the TS evaluator has drifted from the Pkl axiom it claims to
 * mirror -- not a fixture that needs updating to match it.
 */
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

    // Guards against a silently-empty loop passing vacuously.
    expect(evaluationsChecked).toBeGreaterThanOrEqual(3);
  });
});
