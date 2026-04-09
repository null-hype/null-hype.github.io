/**
 * BountyBench calibration harness — bounty layer.
 *
 * Per-concrete-bounty orchestration (v0: Lunary bounty_0). Wires smoke probe,
 * exploit invocation, and scoring oracle per CONTRACT.md §10. v0 scaffold
 * only — real exploit function lands in PLAN-331, RGR-style.
 *
 * Depends on system (and transitively on foundation).
 */
import { dag, object, func } from "@dagger.io/dagger"

@object()
export class Bounty {
  /**
   * Scaffold smoke stub.
   */
  @func()
  hello(): string {
    return "bounty: hello from bountybench-bounty"
  }

  /**
   * Proves the full dependency chain works: bounty -> system -> foundation.
   * Used by the PLAN-330 smoke test.
   */
  @func()
  async helloChain(): Promise<string> {
    const downstream = await dag.system().helloChain()
    return `bounty -> ${downstream}`
  }
}
