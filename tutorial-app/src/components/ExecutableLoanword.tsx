import { useEffect, useRef, useState } from 'react';
import './ExecutableLoanword.css';
type Policy = {
  id: string;
  label: string;
  source: string;
  runtime: unknown;
};
type ExecutionEvent = {
  id: string;
  accepted: boolean;
  outcome: 'accepted' | 'rejected' | 'error';
  reason: string;
};
type Session = {
  sessionId: string;
  policyId: string;
  glossary: unknown[];
  events: ExecutionEvent[];
  mcpUrl?: string;
  inspectorUrl?: string;
};
type Decision = Session & {
  accepted: boolean;
  reason: string;
};
const defaultEndpoint = import.meta.env.PUBLIC_GAP_RUNTIME_URL || 'http://localhost:8787';
const refreshError = 'The session could not be refreshed. Displayed records are the last received from the runtime.';
export default function ExecutableLoanword() {
  const [endpoint, setEndpoint] = useState(defaultEndpoint);
  const [connectedEndpoint, setConnectedEndpoint] = useState('');
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [policyId, setPolicyId] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [translation, setTranslation] = useState('malicious joy');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const epoch = useRef(0);
  const decision = session?.events.at(-1);
  const policy = policies.find(item => item.id === (session?.policyId || policyId));
  async function request<T>(base: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${base}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : {
        'Content-Type': 'application/json'
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(60_000)
    });
    if (!response.ok) throw new Error(`Runtime request failed (${response.status}).`);
    return response.json();
  }
  async function connect() {
    const revision = ++epoch.current;
    setBusy(true);
    setError('');
    setSession(null);
    setPolicies([]);
    try {
      const url = new URL(endpoint);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error('Enter an HTTP or HTTPS runtime address without credentials or query parameters.');
      }
      const base = url.href.replace(/\/$/, '');
      const result = await request<{
        policies: Policy[];
      }>(base, '/policies');
      if (!result.policies?.length) throw new Error('The runtime has no compiled policies.');
      if (revision !== epoch.current) return;
      setConnectedEndpoint(base);
      setPolicies(result.policies);
      setPolicyId(result.policies[0].id);
    } catch (err) {
      if (revision === epoch.current) setError(`${message(err)} Start the lesson runtime, then connect again.`);
    } finally {
      if (revision === epoch.current) setBusy(false);
    }
  }
  async function startSession() {
    const revision = ++epoch.current;
    setBusy(true);
    setError('');
    setSession(null);
    try {
      const result = await request<Session>(connectedEndpoint, '/sessions', {
        policyId
      });
      if (revision === epoch.current) setSession(result);
    } catch (err) {
      if (revision === epoch.current) setError(message(err));
    } finally {
      if (revision === epoch.current) setBusy(false);
    }
  }
  async function submit() {
    if (!session) return;
    const revision = epoch.current;
    setBusy(true);
    setError('');
    try {
      const result = await request<Decision>(connectedEndpoint, `/sessions/${session.sessionId}/submit`, {
        translation
      });
      if (revision !== epoch.current) return;
      setSession(current => current && current.events.length > result.events.length ? current : {
        ...current,
        ...result
      });
    } catch (err) {
      if (revision === epoch.current) setError(message(err));
    } finally {
      if (revision === epoch.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (!session?.sessionId) return;
    let cancelled = false;
    let pending = false;
    const id = session.sessionId;
    // Inspector and the lesson share a session. Read the server ledger so a
    // call made in Inspector is also visible here; never fabricate events.
    const timer = window.setInterval(async () => {
      if (pending) return;
      pending = true;
      try {
        const next = await request<Session>(connectedEndpoint, `/sessions/${id}`);
        if (!cancelled) {
          setSession(current => current?.sessionId === id && next.events.length >= current.events.length ? next : current);
          setError(current => current === refreshError ? '' : current);
        }
      } catch {
        if (!cancelled) setError(refreshError);
      } finally {
        pending = false;
      }
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [session?.sessionId, connectedEndpoint]);
  useEffect(() => () => {
    epoch.current += 1;
  }, []);
  return <section className="gap-execution" aria-label="Executable loanword exercise">
    <div className="gap-execution-intro">
      <span>Author → compile → govern → execute</span>
      <h2>A proposal with a consequence</h2>
      <p>Submit a word to a session glossary. The server checks its compiled lesson policy before adding anything.</p>
    </div>

    <details open={!policies.length} className="gap-execution-connection">
      <summary>Connect to the lesson runtime</summary>
      <p>Start <code>gap-runtime</code> from the tutorial repository using its README, then connect. This exercise needs the Dagger service running alongside the tutorial.</p>
      <label>Runtime address<input type="url" value={endpoint} onChange={event => setEndpoint(event.target.value)} disabled={busy} /></label>
      <button type="button" onClick={connect} disabled={busy}>{busy && !policies.length ? 'Connecting…' : 'Connect'}</button>
    </details>

    {policies.length > 0 && <>
      <div className="gap-execution-policy">
        <label>Authored policy<select value={policyId} disabled={busy} onChange={event => setPolicyId(event.target.value)}>
          {policies.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select></label>
        <button type="button" disabled={busy} onClick={startSession}>{session ? 'Start a fresh session' : 'Start session'}</button>
        <p>Each session keeps its starting policy. To compare policies, start a fresh session; its glossary begins empty.</p>
        {session && <p>Current session policy: <strong>{policy?.label || session.policyId}</strong></p>}
      </div>
      {policy && <details>
        <summary>Inspect Pkl and compiled JSON</summary>
        <p>These are the authored source and evaluated output supplied by the runtime.</p>
        <h3>Pkl source</h3><pre>{typeof policy.source === 'string' ? policy.source : JSON.stringify(policy.source, null, 2)}</pre>
        <h3>Compiled JSON</h3><pre>{JSON.stringify(policy.runtime, null, 2)}</pre>
      </details>}
    </>}

    {session && <>
      <form onSubmit={event => {
        event.preventDefault();
        void submit();
      }}>
        <label>Your proposal<input value={translation} maxLength={200} disabled={busy} onChange={event => setTranslation(event.target.value)} /></label>
        <button disabled={busy} type="submit">{busy ? 'Checking with Dagger…' : 'Submit loanword'}</button>
      </form>
      <p role="status" aria-live="polite" className="gap-execution-decision" data-accepted={decision?.accepted}>
        {decision ? `${decision.outcome === 'error' ? 'Execution error' : decision.accepted ? 'Accepted' : 'Rejected'}: ${decision.reason}` : 'The session is ready. Submit a proposal to see the server’s decision.'}
      </p>
      <div className="gap-execution-records">
        <section aria-label="Session glossary"><h3>Session glossary</h3>
          {session.glossary.length ? <ul>{session.glossary.map((entry, index) => <li key={index}>{typeof entry === 'string' ? entry : JSON.stringify(entry)}</li>)}</ul> : <p>No words added.</p>}
        </section>
        <section aria-label="Execution record"><h3>Execution record</h3>
          <p>{session.events.length} recorded call{session.events.length === 1 ? '' : 's'}</p>
          {session.events.length > 0 && <pre>{JSON.stringify(session.events, null, 2)}</pre>}
        </section>
      </div>
      <details><summary>Use the same session in MCP Inspector</summary>
        <p>Call <code>submitLoanword</code> with a <code>translation</code> argument. Calls from Inspector appear in the execution record above.</p>
        {session.inspectorUrl && safeLink(session.inspectorUrl) && <p><a href={session.inspectorUrl} target="_blank" rel="noreferrer">Open MCP Inspector ↗</a></p>}
        <p>Session MCP endpoint:</p><code className="gap-execution-endpoint">{session.mcpUrl || `${connectedEndpoint}/mcp/${session.sessionId}`}</code>
      </details>
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
function message(error: unknown) {
  return error instanceof Error ? error.message : 'The runtime could not be reached.';
}
function safeLink(value: string) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
