import { useStore } from '@nanostores/react';
import { useMemo, useState } from 'react';
import tutorialStore from 'tutorialkit:store';
import type { CapabilityGrant, CapabilityTrace, Check, Transition } from '../lib/evidence.pkl.ts';
import { checkAccess } from '../lib/ledgerCheckAccess';
import { valueToText } from '../lib/ruleTraceProtocol';
import './CapabilityTraceViewer.css';

type DocumentRecord = Record<string, { filePath: string; loading: boolean; value: string | Uint8Array } | undefined>;
type LessonRecord = { data?: { custom?: unknown } };

const DEFAULT_TRACE_FILE = '/evidence/capability-trace.json';

interface Props {
  traceFile?: string;
}

function resolveTraceFile(customValue: unknown, fallback: string): string {
  if (customValue && typeof customValue === 'object') {
    const record = customValue as Record<string, unknown>;
    const capabilityTrace = record.capabilityTrace;
    if (capabilityTrace && typeof capabilityTrace === 'object') {
      const traceFile = (capabilityTrace as Record<string, unknown>).traceFile;
      if (typeof traceFile === 'string' && traceFile.length > 0) {
        return traceFile;
      }
    }
  }
  return fallback;
}

function parseTrace(text: string): CapabilityTrace | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as CapabilityTrace;
  } catch {
    return null;
  }
}

/** Grants recorded by policy-decision transitions up to and including `uptoIndex`, keyed by factId -- the most recent grant for a factId wins, mirroring GrantState.pkl's Mapping overwrite semantics. */
function grantsAsOf(transitions: Transition[], uptoIndex: number): Map<string, CapabilityGrant> {
  const grants = new Map<string, CapabilityGrant>();
  for (const tr of transitions) {
    if (tr.index > uptoIndex) break;
    if (tr.kind === 'policy-decision' && tr.grant) {
      grants.set(tr.grant.factId, tr.grant);
    }
  }
  return grants;
}

/** The distinct (factId, vault) pairs this trace's evaluation transitions check against the axiom, in first-seen order. */
function factsUnderEvaluation(transitions: Transition[]): Array<{ factId: string; vault: string }> {
  const seen = new Map<string, { factId: string; vault: string }>();
  for (const tr of transitions) {
    if (tr.kind === 'evaluation' && tr.factId && tr.vault && !seen.has(tr.factId)) {
      seen.set(tr.factId, { factId: tr.factId, vault: tr.vault });
    }
  }
  return [...seen.values()];
}

/**
 * Renders one axiom (`CapabilityTrace.checks[0]`, capability-spike's
 * pkl/Ledger.pkl `checkAccess()`) visibly connected to the facts it
 * governs, the recorded execution's state at a chosen step, and this
 * component's own live re-evaluation of that state -- not a linear replay
 * of pre-baked per-transition labels. `checkAccess` (../lib/
 * ledgerCheckAccess.ts) is called here fresh at every step; its fidelity
 * to the real Pkl axiom is proven separately by ledgerCheckAccess.spec.ts
 * (dev-time) and by this lesson's own WebContainer terminal, which runs
 * that same spec for real via TutorialKit's `mainCommand` -- this
 * component does not simulate that proof, it points at it.
 */
export default function CapabilityTraceViewer({ traceFile = DEFAULT_TRACE_FILE }: Props) {
  const documents = useStore(tutorialStore.documents) as DocumentRecord;
  const lesson = tutorialStore.lesson as LessonRecord | undefined;
  const resolvedTraceFile = resolveTraceFile(lesson?.data?.custom, traceFile);

  const traceText = valueToText(documents[resolvedTraceFile]?.value);
  const trace = useMemo(() => parseTrace(traceText), [traceText]);
  const transitions = trace?.transitions ?? [];
  const check: Check | undefined = trace?.checks?.[0];
  const facts = useMemo(() => factsUnderEvaluation(transitions), [transitions]);

  const maxIndex = transitions.length > 0 ? transitions[transitions.length - 1].index : 0;
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedFactId, setSelectedFactId] = useState<string | null>(null);

  const grants = useMemo(() => grantsAsOf(transitions, stepIndex), [transitions, stepIndex]);
  const activeFactId = selectedFactId ?? facts[0]?.factId ?? null;
  const activeFact = facts.find((f) => f.factId === activeFactId);
  const verdict = activeFact ? checkAccess(activeFact.factId, activeFact.vault, grants) : null;
  const currentGrant = activeFactId ? grants.get(activeFactId) : undefined;

  const relevantTransitions = transitions.filter(
    (tr) => tr.index <= stepIndex && tr.factId === activeFactId,
  );

  if (!trace) {
    return (
      <section className="capability-trace" aria-label="Capability decision trace">
        <p className="capability-trace-empty">Waiting on {resolvedTraceFile} to load in the editor's file tree…</p>
      </section>
    );
  }

  return (
    <section className="capability-trace" aria-label="Capability decision trace">
      <div className="capability-trace-provenance" data-source={trace.source}>
        <strong>{trace.source}</strong>
        <span> — {trace.sourceRef}</span>
      </div>

      {check && (
        <article className="capability-trace-axiom">
          <header>Governing axiom</header>
          <p className="capability-trace-axiom-requirement">{check.requirement}</p>
          <pre className="capability-trace-axiom-constraint">{check.constraint}</pre>
          <p className="capability-trace-axiom-source">
            {check.source} @ {check.sourceRef.slice(0, 12)}
          </p>
        </article>
      )}

      <div className="capability-trace-facts" role="group" aria-label="Facts under evaluation">
        {facts.map((f) => {
          const factVerdict = checkAccess(f.factId, f.vault, grants);
          return (
            <button
              key={f.factId}
              type="button"
              aria-pressed={f.factId === activeFactId}
              data-status={factVerdict ? 'blocked' : 'clear'}
              onClick={() => setSelectedFactId(f.factId)}
            >
              {factVerdict ? '✗' : '✓'} {f.factId}
            </button>
          );
        })}
      </div>

      {activeFact && (
        <article className="capability-trace-fact-detail">
          <dl>
            <dt>Fact</dt>
            <dd>
              {activeFact.factId} (vault: {activeFact.vault})
            </dd>

            <dt>Required approval</dt>
            <dd>
              {currentGrant
                ? `grant recorded: approved=${currentGrant.approved}, vault=${currentGrant.vault}`
                : 'no grant recorded yet at this step'}
            </dd>

            <dt>Evaluation (recomputed live from state as of step {stepIndex})</dt>
            <dd data-evaluation={verdict ? 'blocked' : 'clear'}>
              {verdict ? `${verdict.code}: ${verdict.message}` : 'checkAccess() passes -- no diagnostic'}
            </dd>

            <dt>Supporting evidence recorded by step {stepIndex}</dt>
            <dd>
              {relevantTransitions.length === 0 && '—'}
              <ul>
                {relevantTransitions.map((tr) => (
                  <li key={tr.index}>
                    #{tr.index} {tr.label}
                    {tr.fact && <> — diagnostic {tr.fact.code}</>}
                    {tr.grant && <> — grant approved={String(tr.grant.approved)}</>}
                  </li>
                ))}
              </ul>
            </dd>
          </dl>
        </article>
      )}

      <div className="capability-trace-nav">
        <button type="button" disabled={stepIndex <= 0} onClick={() => setStepIndex((i) => Math.max(0, i - 1))}>
          ← Rewind
        </button>
        <span className="capability-trace-step-label">
          Recorded execution advanced through step {stepIndex} / {maxIndex}
        </span>
        <button type="button" disabled={stepIndex >= maxIndex} onClick={() => setStepIndex((i) => Math.min(maxIndex, i + 1))}>
          Advance →
        </button>
      </div>

      <p className="capability-trace-proof-note">
        This panel recomputes <code>checkAccess()</code> in the browser; it does not replay a
        pre-recorded verdict. The proof that this recomputation matches capability-spike's real{' '}
        <code>pkl test</code> run is <code>ledgerCheckAccess.spec.ts</code>, run for real by this
        lesson's own terminal below (TutorialKit's <code>mainCommand</code>), not simulated here.
      </p>
    </section>
  );
}
