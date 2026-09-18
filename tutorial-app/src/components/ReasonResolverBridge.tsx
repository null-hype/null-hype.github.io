import { useStore } from '@nanostores/react';
import { useEffect, useMemo, useRef } from 'react';
import tutorialStore from 'tutorialkit:store';
import { resolveReasonLog } from '../lib/reasonResolver';
import type { ResolvedReason } from '../lib/reasonResolver';
import { valueToText } from '../lib/loanwordArcProtocol';
import './LoanwordArcBridge.css';

type DocumentRecord = Record<
  string,
  | {
      filePath: string;
      loading: boolean;
      value: string | Uint8Array;
    }
  | undefined
>;

const VOCABULARY_FILE = '/governedVocabulary.json';
const GRANT_STATE_FILE = '/grantState.json';

function safeJsonParse(text: string): { ok: true; value: unknown } | { ok: false } {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { ok: true, value: undefined };
  }
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch (_error) {
    return { ok: false };
  }
}

/**
 * CIT-149's live half: pkl/GovernedVocabulary.pkl and pkl/GrantState.pkl
 * are read-only references in the tree to the left, but
 * governedVocabulary.json and grantState.json are the same shapes,
 * editable, starting empty. This component is the only thing that reads
 * them: it recomputes resolveReasonLog on every edit and pushes the
 * result into the otel-warm-log preview, so admitting a phrase or
 * recording a grant changes the Monaco markers immediately, without a
 * page reload -- the same live-preview mechanism LoanwordArcBridge uses
 * for translation.en, applied to a governed-vocabulary resolution instead
 * of a loanword-admission one.
 *
 * A JSON parse failure (the learner is mid-edit, or the file is
 * momentarily unbalanced) keeps whatever was last successfully rendered
 * rather than blanking the preview -- editing one file should not make
 * the other's already-resolved lines disappear.
 */
export default function ReasonResolverBridge() {
  const documents = useStore(tutorialStore.documents) as DocumentRecord;
  const vocabularyText = valueToText(documents[VOCABULARY_FILE]?.value);
  const grantStateText = valueToText(documents[GRANT_STATE_FILE]?.value);
  const revisionRef = useRef(0);
  const lastRecordsRef = useRef<ResolvedReason[] | null>(null);

  const records = useMemo(() => {
    const admittedJson = safeJsonParse(vocabularyText);
    const grantStateJson = safeJsonParse(grantStateText);

    if (!admittedJson.ok || !grantStateJson.ok) {
      return lastRecordsRef.current;
    }

    const next = resolveReasonLog(admittedJson.value ?? [], grantStateJson.value ?? {});
    lastRecordsRef.current = next;
    return next;
  }, [vocabularyText, grantStateText]);

  useEffect(() => {
    if (!records) {
      return undefined;
    }

    revisionRef.current += 1;
    const message = {
      payload: { previewMode: 'reason-resolver-log' as const, records, revision: revisionRef.current },
      source: 'tk-reason-resolver-bridge',
      type: 'lesson-state',
    };
    const send = (frame: HTMLIFrameElement) => frame.contentWindow?.postMessage(message, '*');
    const onReady = (event: MessageEvent) => {
      if (event.data?.type !== 'lesson-preview-ready' || event.data?.source !== 'tk-warm-log-preview') {
        return;
      }
      const frame = getPreviewFrames().find((frame) => frame.contentWindow === event.source);
      if (frame) send(frame);
    };
    window.addEventListener('message', onReady);
    getPreviewFrames().forEach(send);

    return () => {
      window.removeEventListener('message', onReady);
    };
  }, [records]);

  const rows = records ?? [];

  return (
    <section className="gap-check" aria-label="Reason resolution">
      <div className="gap-check-heading">
        <span className="gap-check-eyebrow">reason → vocabulary → grant → verdict</span>
      </div>
      <ol className="gap-check-gates">
        {rows.map((record) => (
          <li key={record.raw}>
            <span aria-hidden="true">{record.diagnostic ? '○' : '✓'}</span>
            <span>
              <code>{record.raw}</code>
              {' -> '}
              {record.diagnostic ? <strong>{record.diagnostic.code}</strong> : <strong>resolved</strong>}
            </span>
          </li>
        ))}
      </ol>
      <p role="status" aria-live="polite" className="gap-check-feedback">
        Edit <code>governedVocabulary.json</code> to admit a phrase (it stays <code>CAP_NO_GRANT</code> until
        something in <code>grantState.json</code> also approves it), then edit <code>grantState.json</code> to
        approve, reject, or approve-for-a-different-vault -- the log to the right updates as you save either file.
      </p>
      <div className="gap-check-actions">
        <button type="button" onClick={() => tutorialStore.setSelectedFile(VOCABULARY_FILE)}>
          Edit governedVocabulary.json
        </button>
        <button type="button" onClick={() => tutorialStore.setSelectedFile(GRANT_STATE_FILE)}>
          Edit grantState.json
        </button>
      </div>
    </section>
  );
}

function getPreviewFrames() {
  return Array.from(
    document.querySelectorAll('#previews-container iframe, .previews-container iframe'),
  ) as HTMLIFrameElement[];
}
