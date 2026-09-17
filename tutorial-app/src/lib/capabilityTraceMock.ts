import type { CapabilityTrace, ReconciliationFlag, Transition } from './evidence.pkl.ts';

// CIT-147 slice 2's second execution adapter: an ordinary TS mock that
// reproduces capability-spike's demo sequence (capability-spike/demo.go's
// runDemo) without a Pkl evaluator or a Go toolchain -- this repo's
// WebContainer lesson has neither. Every governing-rule/detail string below
// is copied verbatim from the real source that produces it (cited per
// constant), not freely reworded, so this mock exercises the same rules the
// real adapter's `Ledger.pkl`/`reconcile.Check` enforce, rather than
// inventing new ones. It is still a mock: nothing here ran a real pkl test
// or wrote real governed state, which is exactly what `source` below says.

const MAIN_FACT_ID = 'flight-booking:area51:vault-access';
const MAIN_VAULT = 'thepentagon.com';
const REJECTED_FACT_ID = 'area51:site4:black-budget-vault-access';
const REJECTED_VAULT = 'site4.internal';
const NEVER_APPROVED_FACT_ID = 'shadow-request:roswell:vault-access';
const BYPASS_FACT_PATH = 'worker/fixtures_invalid/bypassed_gate.pkl';

// Ledger.pkl's deny() message for a fact with no recorded grant at all
// (diagnostic.go's CAP_NO_GRANT case).
const MSG_NO_GRANT = 'no grant has been recorded for this fact -- request pending supervisor review';
// Ledger.pkl's deny() message when the supervisor explicitly rejected the
// request (diagnostic.go's CAP_REJECTED case).
const MSG_REJECTED = 'supervisor explicitly rejected this request';
// reconcile.go's FlagMissingMaterialization detail.
const MSG_MISSING_MATERIALIZATION = 'grant approved but no Proton materialization was ever observed';
// reconcile.go's FlagUnapprovedMaterialization detail.
const MSG_UNAPPROVED_MATERIALIZATION = 'Proton observation recorded with no matching approved grant';

function msgReasonMismatchFactID(observedReason: string, governingFactId: string): string {
  // reconcile.go's FlagReasonMismatch detail (the "wrong fact ID" branch).
  return `PROTON_PASS_AGENT_REASON "${observedReason}" does not match the governing fact ID "${governingFactId}"`;
}

function msgReasonMismatchVault(observedVault: string, grantVault: string): string {
  // reconcile.go's FlagReasonMismatch detail (the "wrong vault" branch).
  return `observed vault "${observedVault}" does not match the governing grant's vault "${grantVault}"`;
}

function msgBoundaryBypassed(factPath: string): string {
  // reconcile.go's FlagBoundaryBypassed detail.
  return `${factPath} does not call Ledger.checkAccess -- any green result did not go through the supervisor boundary`;
}

let nextIndex = 1;
function transition(t: Omit<Transition, 'index'>): Transition {
  return { index: nextIndex++, ...t };
}

/** Builds the same 12-transition sequence the real adapter captures, using an in-memory mock of the rules instead of a real Pkl evaluator. */
export function runCapabilityTraceMock(): CapabilityTrace {
  nextIndex = 1;
  const transitions: Transition[] = [];

  transitions.push(
    transition({
      kind: 'evaluation',
      label: 'Worker fact starts red',
      factId: MAIN_FACT_ID,
      vault: MAIN_VAULT,
      governingRule: MSG_NO_GRANT,
      fact: { factId: MAIN_FACT_ID, severity: 'error', code: 'CAP_NO_GRANT', vault: MAIN_VAULT, message: MSG_NO_GRANT },
      grant: null,
      observation: null,
      flag: null,
    }),
  );

  transitions.push(
    transition({
      kind: 'policy-decision',
      label: 'Supervisor approves the main request',
      factId: MAIN_FACT_ID,
      vault: MAIN_VAULT,
      governingRule: null,
      fact: null,
      grant: { factId: MAIN_FACT_ID, vault: MAIN_VAULT, approved: true },
      observation: null,
      flag: null,
    }),
  );
  transitions.push(
    transition({
      kind: 'policy-decision',
      label: 'Supervisor explicitly rejects a second request',
      factId: REJECTED_FACT_ID,
      vault: REJECTED_VAULT,
      governingRule: null,
      fact: null,
      grant: { factId: REJECTED_FACT_ID, vault: REJECTED_VAULT, approved: false },
      observation: null,
      flag: null,
    }),
  );

  transitions.push(
    transition({
      kind: 'evaluation',
      label: 'Same, unmodified worker fact now evaluates green',
      factId: MAIN_FACT_ID,
      vault: MAIN_VAULT,
      governingRule: null,
      fact: null,
      grant: null,
      observation: null,
      flag: null,
    }),
  );

  transitions.push(
    transition({
      kind: 'reconciliation',
      label: 'Approved but not yet materialized: flagged as missing',
      factId: MAIN_FACT_ID,
      vault: MAIN_VAULT,
      governingRule: MSG_MISSING_MATERIALIZATION,
      fact: null,
      grant: null,
      observation: null,
      flag: { kind: 'missing-materialization', factId: MAIN_FACT_ID, detail: MSG_MISSING_MATERIALIZATION },
    }),
  );

  transitions.push(
    transition({
      kind: 'evaluation',
      label: 'Rejected fact stays red with a useful diagnostic',
      factId: REJECTED_FACT_ID,
      vault: REJECTED_VAULT,
      governingRule: MSG_REJECTED,
      fact: { factId: REJECTED_FACT_ID, severity: 'error', code: 'CAP_REJECTED', vault: REJECTED_VAULT, message: MSG_REJECTED },
      grant: null,
      observation: null,
      flag: null,
    }),
  );

  transitions.push(
    transition({
      kind: 'materialization',
      label: 'Proton Pass operation recorded, keyed by the stable fact ID',
      factId: MAIN_FACT_ID,
      vault: MAIN_VAULT,
      governingRule: null,
      fact: null,
      grant: null,
      observation: {
        factId: MAIN_FACT_ID,
        vault: MAIN_VAULT,
        reason: MAIN_FACT_ID,
        operation: 'pass-cli item view --vault-name thepentagon.com --item-title vault-access',
        recordedAt: new Date().toISOString(),
      },
      flag: null,
    }),
  );

  transitions.push(
    transition({
      kind: 'reconciliation',
      label: 'Reconciliation: fact <-> approval <-> Proton reason',
      factId: MAIN_FACT_ID,
      vault: MAIN_VAULT,
      governingRule: null,
      fact: null,
      grant: null,
      observation: null,
      flag: null,
    }),
  );

  const reasonMismatchFactId = msgReasonMismatchFactID(REJECTED_FACT_ID, MAIN_FACT_ID);
  const reasonMismatchVault = msgReasonMismatchVault('cia.gov', MAIN_VAULT);
  const boundaryBypassed = msgBoundaryBypassed(BYPASS_FACT_PATH);
  const misaligned: Array<{ factId: string; kind: ReconciliationFlag['kind']; detail: string }> = [
    { factId: NEVER_APPROVED_FACT_ID, kind: 'unapproved-materialization', detail: MSG_UNAPPROVED_MATERIALIZATION },
    { factId: MAIN_FACT_ID, kind: 'reason-mismatch', detail: reasonMismatchFactId },
    { factId: MAIN_FACT_ID, kind: 'reason-mismatch', detail: reasonMismatchVault },
    { factId: MAIN_FACT_ID, kind: 'boundary-bypassed', detail: boundaryBypassed },
  ];
  for (const flag of misaligned) {
    transitions.push(
      transition({
        kind: 'reconciliation',
        label: 'Deliberately misaligned pass: flag detected',
        factId: flag.factId,
        vault: null,
        governingRule: flag.detail,
        fact: null,
        grant: null,
        observation: null,
        flag: { kind: flag.kind, factId: flag.factId, detail: flag.detail },
      }),
    );
  }

  return {
    traceId: 'webcontainer-mock-demo',
    scenario: 'capability-spike red-approve-green-materialize-reconcile',
    source: 'webcontainer-mock-test',
    sourceRef: "mocks capability-spike/demo.go's rules in TypeScript; not a captured execution",
    transitions,
  };
}
