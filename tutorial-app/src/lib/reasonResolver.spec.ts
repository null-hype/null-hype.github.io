import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Grant } from './grant_state.pkl';
import type { AdmittedTerm } from './governedVocabulary.pkl';
import { FIXTURE_REASON, FIXTURE_REASON_GRANTED, FIXTURE_REASON_UNRESOLVED } from './reasonFixture';
import { CODE_TERM_UNRESOLVED, resolveReason, resolveReasonLog } from './reasonResolver';

const LESSON_DIR = fileURLToPath(new URL('../content/tutorial/part-1/chapter-3/lesson-4/', import.meta.url));

function readLessonJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(LESSON_DIR + relativePath, 'utf8'));
}

// The lesson's own _solution/ files -- the single real, committed record
// of "fully admitted and granted" this repo keeps. Both the live lesson's
// Solve action and these unit tests read the same bytes, so there is only
// one place that data can drift.
const solutionAdmitted = readLessonJson('_solution/governedVocabulary.json') as AdmittedTerm[];
const solutionGrantState = readLessonJson('_solution/grantState.json') as { approvedGrants: Record<string, Grant> };
const solutionGrantsByFactId = new Map<string, Grant>(Object.entries(solutionGrantState.approvedGrants));

/**
 * The mirror image of capability-spike/resolver/resolver_test.go's cases
 * -- same fixtures, same vocabulary, same expected codes. Nothing here
 * reads a live Pkl evaluator; this is what makes that TypeScript replay
 * trustworthy instead of just "not something this lesson lets you fake."
 */
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
    const grants = new Map<string, Grant>([
      ['pass-cli:color:resume:read-codeword', { factID: 'pass-cli:color:resume:read-codeword', vault: 'jin-91-resume-session', approved: true }],
    ]);

    const result = resolveReason(FIXTURE_REASON_GRANTED, solutionAdmitted, grants);

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

/**
 * ReasonResolverBridge.tsx pushes resolveReasonLog's output into the
 * otel-warm-log preview live, every time the learner edits
 * governedVocabulary.json/grantState.json -- this is the "changing
 * vocabulary/grant state reruns the resolver and the markers respond"
 * cycle, exercised end to end without a browser: parse the two starting
 * (_files/) documents, then the fully solved (_solution/) documents, and
 * confirm the outputs walk through exactly the four states that cycle
 * requires.
 */
describe('the interactive cycle (edit vocabulary/grant state, rerun, markers respond)', () => {
  const startingAdmitted = readLessonJson('_files/governedVocabulary.json');
  const startingGrantState = readLessonJson('_files/grantState.json');

  it('1. starting state: nothing admitted yet, every reason is CAP_TERM_UNRESOLVED', () => {
    const log = resolveReasonLog(startingAdmitted, startingGrantState);

    expect(log).toHaveLength(3);
    for (const record of log) {
      expect(record.resolvedFactId).toBeNull();
      expect(record.diagnostic?.code).toBe(CODE_TERM_UNRESOLVED);
      // The raw statement and (empty) loss annotations stay inspectable
      // even for a reason that never resolved at all.
      expect(record.raw.length).toBeGreaterThan(0);
      expect(record.lossAxes).toEqual([]);
    }
  });

  it('2. admitting a phrase resolves its meaning, but access still reports CAP_NO_GRANT -- admission is not access', () => {
    const partiallyAdmitted = [
      (solutionAdmitted as AdmittedTerm[]).find((entry) => entry.factId === 'pass-cli:color:resume:plant-codeword'),
    ];

    const log = resolveReasonLog(partiallyAdmitted, startingGrantState);
    const plantCodewordLine = log.find((record) => record.raw === FIXTURE_REASON)!;
    const stillUnadmittedLine = log.find((record) => record.raw === FIXTURE_REASON_UNRESOLVED)!;

    expect(plantCodewordLine.resolvedFactId).toBe('pass-cli:color:resume:plant-codeword');
    expect(plantCodewordLine.lossAxes.length).toBeGreaterThan(0);
    expect(plantCodewordLine.diagnostic?.code).toBe('CAP_NO_GRANT');
    // A phrase this partial admission never touched stays unresolved --
    // admitting one term doesn't leak into another's resolution.
    expect(stillUnadmittedLine.diagnostic?.code).toBe(CODE_TERM_UNRESOLVED);
  });

  it('3. a matching approval clears the check; rejection and a wrong-vault approval stay distinguishable', () => {
    const admitted = [
      (solutionAdmitted as AdmittedTerm[]).find((entry) => entry.factId === 'pass-cli:color:resume:plant-codeword')!,
    ];

    const approved = resolveReasonLog(admitted, {
      approvedGrants: { 'pass-cli:color:resume:plant-codeword': { factID: 'pass-cli:color:resume:plant-codeword', vault: 'jin-91-resume-session', approved: true } },
    }).find((record) => record.raw === FIXTURE_REASON)!;
    expect(approved.diagnostic).toBeNull();

    const rejected = resolveReasonLog(admitted, {
      approvedGrants: { 'pass-cli:color:resume:plant-codeword': { factID: 'pass-cli:color:resume:plant-codeword', vault: 'jin-91-resume-session', approved: false } },
    }).find((record) => record.raw === FIXTURE_REASON)!;
    expect(rejected.diagnostic?.code).toBe('CAP_REJECTED');

    const wrongVault = resolveReasonLog(admitted, {
      approvedGrants: { 'pass-cli:color:resume:plant-codeword': { factID: 'pass-cli:color:resume:plant-codeword', vault: 'some-other-scope', approved: true } },
    }).find((record) => record.raw === FIXTURE_REASON)!;
    expect(wrongVault.diagnostic?.code).toBe('CAP_VAULT_MISMATCH');

    // Three different (factID, vault, approved) worlds, three different
    // codes -- none of them collide with each other or with CAP_NO_GRANT.
    const codes = new Set([rejected.diagnostic?.code, wrongVault.diagnostic?.code, 'CAP_NO_GRANT']);
    expect(codes.size).toBe(3);
  });

  it('4. fully solved: matches the committed golden reason-log.jsonl exactly', () => {
    const log = resolveReasonLog(solutionAdmitted, solutionGrantState);
    const golden = readFileSync(fileURLToPath(new URL('./reasonLogGolden.jsonl', import.meta.url)), 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    expect(log).toEqual(golden);
  });
});

/**
 * reasonLogGolden.jsonl is byte-for-byte identical to agent-plugins'
 * capability-spike/resolver/testdata/reason-log.jsonl, which that repo's
 * own TestResolve_MatchesGoldenReasonLog anchors the same way against
 * Go's live Resolve() output for the lesson's fully-solved state. Neither
 * test can run the other language, so this is not one cross-language
 * check -- it's two independent anchors to the same committed bytes; a
 * real divergence between the Go and TypeScript resolvers would show up
 * as a diff between the two files, not as a passing test on either side
 * alone.
 */
describe('reasonLogGolden.jsonl (shared anchor with agent-plugins)', () => {
  it('has exactly the three real fixtures, in order: granted, ungranted, unresolved', () => {
    const golden = readFileSync(fileURLToPath(new URL('./reasonLogGolden.jsonl', import.meta.url)), 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    expect(golden.map((r: { raw: string }) => r.raw)).toEqual([
      FIXTURE_REASON_GRANTED,
      FIXTURE_REASON,
      FIXTURE_REASON_UNRESOLVED,
    ]);
  });

  it('every record equals resolveReason(record.raw, ...) against the solved state exactly', () => {
    const golden = readFileSync(fileURLToPath(new URL('./reasonLogGolden.jsonl', import.meta.url)), 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    for (const record of golden) {
      expect(record).toEqual(resolveReason(record.raw, solutionAdmitted, solutionGrantsByFactId));
    }
  });
});
