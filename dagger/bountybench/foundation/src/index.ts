/**
 * BountyBench calibration harness — foundation layer.
 *
 * Cross-bounty primitives that emerge on-demand (PLAN-332 discipline: extract
 * only after a second bounty confirms reuse). v0 is an empty scaffold with a
 * hello stub used by the PLAN-330 smoke test.
 *
 * See dagger/bountybench/CONTRACT.md §10 for the planned surface.
 */
import { object, func } from "@dagger.io/dagger"

@object()
export class Foundation {
  /**
   * Scaffold smoke stub. Proves the module builds and is callable.
   */
  @func()
  hello(): string {
    return "foundation: hello from bountybench-foundation"
  }
}
