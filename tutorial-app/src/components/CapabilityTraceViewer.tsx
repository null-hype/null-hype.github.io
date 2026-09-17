import { useStore } from '@nanostores/react';
import { useMemo, useState } from 'react';
import tutorialStore from 'tutorialkit:store';
import type { CapabilityTrace, Transition } from '../lib/evidence.pkl.ts';
import { runCapabilityTraceMock } from '../lib/capabilityTraceMock';
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

/**
 * Renders a CapabilityTrace (CIT-147 slice 2) as steppable rule / observation
 * / evaluation cards -- never a flat JSON dump. Two adapters can supply the
 * trace through the exact same shape: the real one read from `traceFile`
 * (captured by capability-spike/cmd/trace-export via
 * tk-evidence-exporter's testdata/capability_trace_real.json) and an
 * in-browser mock (capabilityTraceMock.ts, "ordinary tests" reproducing the
 * same rules). The toggle below swaps which one this component renders,
 * which is the literal acceptance test for CIT-147 slice 2: swapping the
 * adapter must not change the interaction model, only the data and its
 * declared provenance.
 */
export default function CapabilityTraceViewer({ traceFile = DEFAULT_TRACE_FILE }: Props) {
  const documents = useStore(tutorialStore.documents) as DocumentRecord;
  const lesson = tutorialStore.lesson as LessonRecord | undefined;
  const resolvedTraceFile = resolveTraceFile(lesson?.data?.custom, traceFile);

  const [adapter, setAdapter] = useState<'real' | 'mock'>('real');
  const [stepIndex, setStepIndex] = useState(0);

  const realTraceText = valueToText(documents[resolvedTraceFile]?.value);
  const realTrace = useMemo(() => parseTrace(realTraceText), [realTraceText]);
  const mockTrace = useMemo(() => runCapabilityTraceMock(), []);

  const trace = adapter === 'real' ? realTrace : mockTrace;
  const transitions = trace?.transitions ?? [];
  const step: Transition | undefined = transitions[Math.min(stepIndex, transitions.length - 1)];

  return (
    <section className="capability-trace" aria-label="Capability decision trace">
      <div className="capability-trace-provenance" data-source={trace?.source ?? 'unknown'}>
        <strong>{trace ? trace.source : 'loading…'}</strong>
        {trace && <span> — {trace.sourceRef}</span>}
      </div>

      <div className="capability-trace-adapter-switch" role="group" aria-label="Execution adapter">
        <button type="button" aria-pressed={adapter === 'real'} onClick={() => { setAdapter('real'); setStepIndex(0); }}>
          Real capture
        </button>
        <button type="button" aria-pressed={adapter === 'mock'} onClick={() => { setAdapter('mock'); setStepIndex(0); }}>
          WebContainer mock
        </button>
      </div>

      {!trace && adapter === 'real' && (
        <p className="capability-trace-empty">Waiting on {resolvedTraceFile} to load in the editor's file tree…</p>
      )}

      {trace && step && (
        <article className="capability-trace-step" data-kind={step.kind}>
          <header>
            <span className="capability-trace-step-index">
              Step {stepIndex + 1} / {transitions.length}
            </span>
            <span className="capability-trace-step-kind">{step.kind}</span>
          </header>
          <h3>{step.label}</h3>

          <dl>
            <dt>Governing rule</dt>
            <dd>{step.governingRule ?? (step.kind === 'evaluation' && !step.fact ? '(no diagnostic — evaluation passed)' : '—')}</dd>

            <dt>Observation</dt>
            <dd>
              {step.fact && <code>{JSON.stringify(step.fact)}</code>}
              {step.grant && <code>{JSON.stringify(step.grant)}</code>}
              {step.observation && <code>{JSON.stringify(step.observation)}</code>}
              {step.flag && <code>{JSON.stringify(step.flag)}</code>}
              {!step.fact && !step.grant && !step.observation && !step.flag && '—'}
            </dd>

            <dt>Evaluation</dt>
            <dd data-evaluation={step.fact || step.flag ? 'blocked' : 'clear'}>
              {step.fact || step.flag ? 'A diagnostic/flag was recorded for this step' : 'No diagnostic or flag recorded'}
            </dd>
          </dl>
        </article>
      )}

      <div className="capability-trace-nav">
        <button type="button" disabled={stepIndex <= 0} onClick={() => setStepIndex((i) => Math.max(0, i - 1))}>
          ← Previous
        </button>
        <button
          type="button"
          disabled={stepIndex >= transitions.length - 1}
          onClick={() => setStepIndex((i) => Math.min(transitions.length - 1, i + 1))}
        >
          Next →
        </button>
      </div>
    </section>
  );
}
