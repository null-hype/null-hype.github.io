/**
 * BountyBench calibration harness — system layer.
 *
 * Per-app environment codification (v0: Lunary). Owns image build, service
 * wiring, smoke probe, and reset per CONTRACT.md §10. v0 scaffold only — real
 * surface lands in PLAN-331, RGR-style.
 *
 * Depends on foundation.
 */
import { dag, object, func } from "@dagger.io/dagger"

@object()
export class System {
  /**
   * Scaffold smoke stub.
   */
  @func()
  hello(): string {
    return "system: hello from bountybench-system"
  }

  /**
   * Proves the dependency graph is wired by calling into foundation.
   * Used by the PLAN-330 smoke test together with bounty.helloChain.
   */
  @func()
  async helloChain(): Promise<string> {
    const downstream = await dag.foundation().hello()
    return `system -> ${downstream}`
  }
}
