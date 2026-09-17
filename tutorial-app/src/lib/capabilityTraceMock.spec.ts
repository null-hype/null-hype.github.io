import { describe, expect, it } from 'vitest';
import { runCapabilityTraceMock } from './capabilityTraceMock';

// This is the "run ordinary tests" half of CIT-147 slice 2's swap-adapter
// acceptance test: the mock adapter must produce the same CapabilityTrace
// shape and the same transition sequence (by kind/count) as the real
// adapter's captured fixture (tk-evidence-exporter/testdata/
// capability_trace_real.json), so CapabilityTraceViewer.tsx can render
// either one through the identical interaction model.
describe('runCapabilityTraceMock', () => {
  it('identifies itself as a mock, not a captured execution', () => {
    const trace = runCapabilityTraceMock();
    expect(trace.source).toBe('webcontainer-mock-test');
    expect(trace.sourceRef).not.toHaveLength(0);
    expect(trace.sourceRef.toLowerCase()).toContain('mock');
  });

  it('produces 12 transitions with sequential 1-based indices', () => {
    const trace = runCapabilityTraceMock();
    expect(trace.transitions).toHaveLength(12);
    trace.transitions.forEach((t, i) => expect(t.index).toBe(i + 1));
  });

  it('carries exactly one CAP_NO_GRANT and one CAP_REJECTED evaluation, matching the real adapter', () => {
    const trace = runCapabilityTraceMock();
    const codes = trace.transitions.filter((t) => t.fact).map((t) => t.fact!.code);
    expect(codes.filter((c) => c === 'CAP_NO_GRANT')).toHaveLength(1);
    expect(codes.filter((c) => c === 'CAP_REJECTED')).toHaveLength(1);
  });

  it('carries exactly one materialization and reconciles to the same flag mix as the real 4-flag misaligned pass', () => {
    const trace = runCapabilityTraceMock();
    expect(trace.transitions.filter((t) => t.observation)).toHaveLength(1);

    const flagKinds = trace.transitions.filter((t) => t.flag).map((t) => t.flag!.kind);
    expect(flagKinds).toEqual([
      'missing-materialization',
      'unapproved-materialization',
      'reason-mismatch',
      'reason-mismatch',
      'boundary-bypassed',
    ]);
  });

  it('gives every reconciliation flag a non-empty governingRule sourced from the flag detail', () => {
    const trace = runCapabilityTraceMock();
    for (const t of trace.transitions) {
      if (t.flag) {
        expect(t.governingRule).toBe(t.flag.detail);
      }
    }
  });
});
