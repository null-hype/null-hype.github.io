import type { Grant, GrantState } from './grant_state.pkl';
import type { AdmittedTerm } from './governedVocabulary.pkl';
import { checkAccess } from './ledgerCheckAccess';
import { FIXTURE_REASON, FIXTURE_REASON_GRANTED, FIXTURE_REASON_UNRESOLVED } from './reasonFixture';

/**
 * The one new code CIT-149 adds alongside pkl/Ledger.pkl's existing
 * CAP_NO_GRANT/CAP_REJECTED/CAP_VAULT_MISMATCH: a reason's phrase does not
 * match anything GovernedVocabulary.pkl admits, so there is no factID to
 * check access for at all. Deliberately distinct from CAP_NO_GRANT: a
 * phrase the supervisor never admitted is a different failure from one it
 * admitted but never granted.
 */
export const CODE_TERM_UNRESOLVED = 'CAP_TERM_UNRESOLVED';

/**
 * Mirrors capability-spike/diagnostic/diagnostic.go's Diagnostic --
 * {severity, code, message}, specialized to {factID, vault} the same way
 * that Go struct is.
 */
export interface Diagnostic {
  severity: 'error';
  code: string;
  message: string;
  factID: string;
  vault: string;
}

/**
 * CIT-149's fixed output shape: the raw statement, the fact ID it mapped
 * to (if any), what that mapping loses, and -- only when resolution or the
 * subsequent capability check failed -- a diagnostic. `diagnostic` is
 * `null` exactly when the reason resolves clean, mirroring checkAccess's
 * own null/Verdict split rather than adding a redundant boolean next to
 * it.
 */
export interface ResolvedReason {
  raw: string;
  resolvedFactId: string | null;
  lossAxes: string[];
  diagnostic: Diagnostic | null;
}

/**
 * Matches the "<scope> scenario: <phrase>" shape the generated `color`
 * bin's PROTON_PASS_AGENT_REASON values follow (see
 * src/pass-cli/install.sh and reasonFixture.ts). A reason that doesn't
 * even have this shape can't name an admitted phrase, so it resolves the
 * same way an unadmitted phrase does: CAP_TERM_UNRESOLVED, not a crash.
 */
const REASON_PATTERN = /^(\S+) scenario: (.+)$/;

/**
 * A TypeScript replay of capability-spike/resolver/resolver.go's Resolve()
 * -- open that file to read the function this mirrors. It has no access
 * to a live Pkl evaluator (the browser can't reach one, same limitation
 * ledgerCheckAccess.ts/inventoryCheck.ts already document); it is
 * validated instead by reasonResolver.spec.ts against the same fixtures
 * agent-plugins' resolver_test.go covers.
 *
 * `raw`'s scope prefix is passed through as `checkAccess`'s `vault`
 * argument, so a request whose scope was dropped or doesn't match what
 * was admitted never resolves clean -- it fails the same way a wrong
 * vault does (CAP_NO_GRANT or CAP_VAULT_MISMATCH), never by silently
 * falling back to some other scope's grant.
 */
export function resolveReason(
  raw: string,
  admitted: readonly AdmittedTerm[],
  grantsByFactId: ReadonlyMap<string, Grant>,
): ResolvedReason {
  const match = REASON_PATTERN.exec(raw);

  if (!match) {
    return {
      raw,
      resolvedFactId: null,
      lossAxes: [],
      diagnostic: {
        severity: 'error',
        code: CODE_TERM_UNRESOLVED,
        factID: '',
        vault: '',
        message:
          'reason does not match the "<scope> scenario: <phrase>" shape GovernedVocabulary.pkl is governed against',
      },
    };
  }

  const [, scope, phrase] = match;
  const entry = admitted.find((candidate) => candidate.phrase === phrase && candidate.scope === scope);

  if (!entry) {
    return {
      raw,
      resolvedFactId: null,
      lossAxes: [],
      diagnostic: {
        severity: 'error',
        code: CODE_TERM_UNRESOLVED,
        factID: '',
        vault: scope,
        message: `no admitted vocabulary entry for "${phrase}" in scope "${scope}" -- request pending supervisor vocabulary admission`,
      },
    };
  }

  const verdict = checkAccess(entry.factId, scope, grantsByFactId);

  if (verdict) {
    return {
      raw,
      resolvedFactId: entry.factId,
      lossAxes: entry.lossAxes,
      diagnostic: {
        severity: 'error',
        code: verdict.code,
        message: verdict.message,
        factID: entry.factId,
        vault: scope,
      },
    };
  }

  return {
    raw,
    resolvedFactId: entry.factId,
    lossAxes: entry.lossAxes,
    diagnostic: null,
  };
}

/**
 * The three real reasons the lesson's reason-log renders, in the fixed
 * order every committed fixture (reason-log.jsonl, testdata/reason-log.jsonl
 * on the Go side) uses: granted, admitted-but-ungranted, never-admitted.
 */
export const REASON_LOG_RAWS = [FIXTURE_REASON_GRANTED, FIXTURE_REASON, FIXTURE_REASON_UNRESOLVED] as const;

function isAdmittedTerm(value: unknown): value is AdmittedTerm {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.phrase === 'string' &&
    typeof candidate.factId === 'string' &&
    typeof candidate.scope === 'string' &&
    Array.isArray(candidate.lossAxes)
  );
}

/**
 * Parses ReasonResolverBridge's live `governedVocabulary.json` (an
 * AdmittedTerm[], typed against governedVocabulary.pkl.ts the same way
 * pkl-typescript-generated Pkl data is consumed everywhere else in this
 * chapter) into the shape `resolveReason` expects. Defensive: a document
 * that isn't a well-formed AdmittedTerm[] -- including mid-edit, before a
 * closing bracket exists -- yields no admitted terms rather than crashing
 * the bridge that reads it live on every keystroke.
 */
export function parseAdmittedTerms(value: unknown): AdmittedTerm[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isAdmittedTerm);
}

/**
 * Parses ReasonResolverBridge's live `grantState.json` -- the same
 * `{approvedGrants: Mapping<String, Grant>}` shape pkl/GrantState.pkl and
 * grant_state.pkl.ts's GrantState both declare, and the same shape
 * chapter-3/lesson-2's own grantState.json already uses -- into the
 * ReadonlyMap<string, Grant> checkAccess expects. Defensive for the same
 * reason parseAdmittedTerms is.
 */
export function parseGrantsByFactId(value: unknown): Map<string, Grant> {
  if (!value || typeof value !== 'object') {
    return new Map();
  }
  const approvedGrants = (value as Partial<GrantState>).approvedGrants;
  if (!approvedGrants || typeof approvedGrants !== 'object') {
    return new Map();
  }
  return new Map(Object.entries(approvedGrants as Record<string, Grant>));
}

/**
 * ReasonResolverBridge's whole job: take the two live, learner-edited
 * documents (already JSON-parsed, or `null` while the learner is
 * mid-edit) and recompute all three fixed reasons against them. This is
 * the function that makes the log's Monaco markers respond to editing
 * `governedVocabulary.json`/`grantState.json`, instead of the log being a
 * fixed recording of one already-resolved state.
 */
export function resolveReasonLog(admittedJson: unknown, grantStateJson: unknown): ResolvedReason[] {
  const admitted = parseAdmittedTerms(admittedJson);
  const grantsByFactId = parseGrantsByFactId(grantStateJson);
  return REASON_LOG_RAWS.map((raw) => resolveReason(raw, admitted, grantsByFactId));
}
