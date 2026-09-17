// Vendored from tutorial-app/src/lib/ledgerCheckAccess.ts so this lesson's
// WebContainer sandbox (a self-contained project, no import across the
// _files boundary) can run the exact same evaluator its own terminal
// tests below and the CapabilityTraceViewer panel above both use.
import type { CapabilityGrant } from './evidence.pkl';

export interface AccessVerdict {
  code: string;
  message: string;
}

/**
 * A TypeScript replay of capability-spike/pkl/Ledger.pkl's checkAccess()
 * (see that file's `Check.constraint` in a captured CapabilityTrace for the
 * verbatim Pkl source this mirrors). `grantsByFactId` must be built by
 * folding a trace's `policy-decision` transitions in order, keyed by
 * factId -- Ledger.pkl's real supervisor state is a Pkl
 * `Mapping<String, Grant>` (GrantState.pkl) that the Go side renders by
 * overwriting `current.ApprovedGrants[g.FactID] = &g`
 * (capability-spike/supervisor/state.go), so the most recently recorded
 * grant for a factId is the only one that governs -- never averaged or
 * accumulated.
 *
 * This function has no access to a Pkl evaluator; it is validated instead
 * by ledgerCheckAccess.spec.ts, which replays a real captured trace's
 * events through it and asserts the results match the verdicts
 * capability-spike's actual `pkl test` run recorded for the same events.
 */
export function checkAccess(
  factId: string,
  vault: string,
  grantsByFactId: ReadonlyMap<string, CapabilityGrant>,
): AccessVerdict | null {
  const grant = grantsByFactId.get(factId);
  if (!grant) {
    return { code: 'CAP_NO_GRANT', message: 'no grant has been recorded for this fact -- request pending supervisor review' };
  }
  if (!grant.approved) {
    return { code: 'CAP_REJECTED', message: 'supervisor explicitly rejected this request' };
  }
  if (grant.vault !== vault) {
    return { code: 'CAP_VAULT_MISMATCH', message: `supervisor approved this fact for vault ${grant.vault}, not ${vault}` };
  }
  return null;
}
