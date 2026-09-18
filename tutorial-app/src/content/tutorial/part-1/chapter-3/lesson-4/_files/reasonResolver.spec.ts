// Vendored from tutorial-app/src/lib/reasonResolver.spec.ts -- this is the
// exact spec that validates reasonResolver.ts, including resolveReasonLog,
// the function ReasonResolverBridge.tsx calls on every edit to
// governedVocabulary.json/grantState.json to drive the live preview to the
// right. The version in tutorial-app/src/lib reads _solution/*.json
// directly (real filesystem access, outside any WebContainer); this copy
// stays inside the _files/ boundary, so the target (fully admitted and
// granted) state below is a literal copy of ../_solution/governedVocabulary.json
// and ../_solution/grantState.json's real committed contents, not a
// separate invention -- keep it in sync with those files on drift, the
// same discipline capabilityRejection.spec.ts's own frozen values already
// document for this chapter.
import { describe, expect, it } from 'vitest';
import type { Grant } from './grant_state.pkl';
import type { AdmittedTerm } from './governedVocabulary.pkl';
import { FIXTURE_REASON, FIXTURE_REASON_GRANTED, FIXTURE_REASON_UNRESOLVED } from './reasonFixture';
import { CODE_TERM_UNRESOLVED, resolveReason, resolveReasonLog } from './reasonResolver';

const solutionAdmitted: AdmittedTerm[] = [
  {
    phrase: 'planting codeword in a fresh session',
    factId: 'pass-cli:color:resume:plant-codeword',
    scope: 'jin-91-resume-session',
    lossAxes: ['session-lifecycle-detail', 'verb-tense'],
  },
  {
    phrase: 'resuming restored session to read back the codeword',
    factId: 'pass-cli:color:resume:read-codeword',
    scope: 'jin-91-resume-session',
    lossAxes: ['session-lifecycle-detail', 'restoration-provenance'],
  },
];

const solutionGrantsByFactId = new Map<string, Grant>([
  ['pass-cli:color:resume:read-codeword', { factID: 'pass-cli:color:resume:read-codeword', vault: 'jin-91-resume-session', approved: true }],
]);
const solutionGrantState = { approvedGrants: Object.fromEntries(solutionGrantsByFactId) };

describe('reason resolver (CIT-149)', () => {
  it('an admitted phrase with no recorded grant reports CAP_NO_GRANT, not a boolean', () => {
    const result = resolveReason(FIXTURE_REASON, solutionAdmitted, new Map());

    expect(result.raw).toBe(FIXTURE_REASON);
    expect(result.resolvedFactId).toBe('pass-cli:color:resume:plant-codeword');
    expect(result.lossAxes.length).toBeGreaterThan(0);
    expect(result.diagnostic).not.toBeNull();
    expect(result.diagnostic).toMatchObject({ severity: 'error', code: 'CAP_NO_GRANT' });
    expect(result.diagnostic!.message.length).toBeGreaterThan(0);
  });

  it('an unadmitted phrase reports CAP_TERM_UNRESOLVED -- a different code from admitted-but-ungranted', () => {
    const grantsWithUnrelatedEntry = new Map<string, Grant>([
      ['pass-cli:color:resume:plant-codeword', { factID: 'pass-cli:color:resume:plant-codeword', vault: 'jin-91-resume-session', approved: true }],
    ]);

    const result = resolveReason(FIXTURE_REASON_UNRESOLVED, solutionAdmitted, grantsWithUnrelatedEntry);

    expect(result.raw).toBe(FIXTURE_REASON_UNRESOLVED);
    expect(result.resolvedFactId).toBeNull();
    expect(result.diagnostic?.code).toBe(CODE_TERM_UNRESOLVED);
    expect(result.diagnostic?.code).not.toBe('CAP_NO_GRANT');
  });

  it('an admitted phrase with an approved matching grant resolves clean', () => {
    const result = resolveReason(FIXTURE_REASON_GRANTED, solutionAdmitted, solutionGrantsByFactId);

    expect(result.diagnostic).toBeNull();
    expect(result.resolvedFactId).toBe('pass-cli:color:resume:read-codeword');
  });

  it('a grant approved for a different scope than the reason carries never resolves clean', () => {
    const grants = new Map<string, Grant>([
      ['pass-cli:color:resume:plant-codeword', { factID: 'pass-cli:color:resume:plant-codeword', vault: 'some-other-scope', approved: true }],
    ]);

    const result = resolveReason(FIXTURE_REASON, solutionAdmitted, grants);

    expect(result.diagnostic).not.toBeNull();
    expect(result.diagnostic?.code).toBe('CAP_VAULT_MISMATCH');
  });

  it('an explicitly rejected grant reports CAP_REJECTED', () => {
    const grants = new Map<string, Grant>([
      ['pass-cli:color:resume:plant-codeword', { factID: 'pass-cli:color:resume:plant-codeword', vault: 'jin-91-resume-session', approved: false }],
    ]);

    const result = resolveReason(FIXTURE_REASON, solutionAdmitted, grants);

    expect(result.diagnostic?.code).toBe('CAP_REJECTED');
  });

  it('a reason not shaped like "<scope> scenario: <phrase>" is unresolved, not a crash', () => {
    const result = resolveReason('not a governed reason string', solutionAdmitted, new Map());

    expect(result.raw).toBe('not a governed reason string');
    expect(result.resolvedFactId).toBeNull();
    expect(result.diagnostic?.code).toBe(CODE_TERM_UNRESOLVED);
  });
});

describe('the interactive cycle (edit vocabulary/grant state, rerun, markers respond)', () => {
  it('starting state (_files/, as committed): nothing admitted yet, every reason is CAP_TERM_UNRESOLVED', () => {
    const log = resolveReasonLog([], { approvedGrants: {} });

    for (const record of log) {
      expect(record.resolvedFactId).toBeNull();
      expect(record.diagnostic?.code).toBe(CODE_TERM_UNRESOLVED);
    }
  });

  it('admitting a phrase resolves its meaning, but access still reports CAP_NO_GRANT', () => {
    const plantCodeword = (solutionAdmitted as AdmittedTerm[]).find(
      (entry) => entry.factId === 'pass-cli:color:resume:plant-codeword',
    )!;

    const log = resolveReasonLog([plantCodeword], { approvedGrants: {} });
    const record = log.find((r) => r.raw === FIXTURE_REASON)!;

    expect(record.resolvedFactId).toBe('pass-cli:color:resume:plant-codeword');
    expect(record.diagnostic?.code).toBe('CAP_NO_GRANT');
  });

  it('fully solved (_solution/, as committed): every reason resolves to its target verdict', () => {
    const log = resolveReasonLog(solutionAdmitted, solutionGrantState);

    expect(log.find((r) => r.raw === FIXTURE_REASON_GRANTED)?.diagnostic).toBeNull();
    expect(log.find((r) => r.raw === FIXTURE_REASON)?.diagnostic?.code).toBe('CAP_NO_GRANT');
    expect(log.find((r) => r.raw === FIXTURE_REASON_UNRESOLVED)?.diagnostic?.code).toBe(CODE_TERM_UNRESOLVED);
  });
});
