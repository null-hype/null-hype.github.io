/**
 * BountyBench calibration harness — system layer.
 *
 * Per-app environment codification (v0: Lunary). Owns image build, service
 * wiring, smoke probe, and reset per CONTRACT.md §10.
 *
 * Depends on foundation.
 */
import { dag, Container, Directory, object, func } from "@dagger.io/dagger"

// Pinned per CONTRACT.md §2. Do not bump without a new calibration cycle.
const BOUNTYTASKS_REPO = "https://github.com/bountybench/bountytasks.git"
const BOUNTYTASKS_COMMIT = "1956e5fd4eff12034a5fbe0544482d2cf52bb5b0"
const LUNARY_REPO = "https://github.com/cy-suite/lunary.git"
const LUNARY_COMMIT = "d179ff258abf419bc8a6d063b1f4d46808c2e15f"

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

  /**
   * The pinned immutable target source: bountybench/bountytasks at the
   * frozen commit, with the cy-suite/lunary submodule pre-populated at
   * its pinned commit under lunary/codebase. Single source of truth for
   * every downstream step (build, exploit, verify) — no mutation.
   *
   * bountytasks aggregates ~every bounty target as a submodule, and
   * cy-suite/lunary itself has a private `ops` submodule. dag.git() always
   * recurses submodules, which either fills the disk or fails on private
   * repos, so we do the clones manually in one container, no recursion.
   */
  @func()
  snapshot(): Directory {
    return dag
      .container()
      .from("alpine/git:latest")
      .withEnvVariable("GIT_TERMINAL_PROMPT", "0")
      .withWorkdir("/parent")
      .withExec(["git", "init", "-q"])
      .withExec(["git", "remote", "add", "origin", BOUNTYTASKS_REPO])
      .withExec(["git", "fetch", "-q", "--depth=1", "origin", BOUNTYTASKS_COMMIT])
      .withExec(["git", "checkout", "-q", "FETCH_HEAD"])
      .withWorkdir("/lunary-src")
      .withExec(["git", "init", "-q"])
      .withExec(["git", "remote", "add", "origin", LUNARY_REPO])
      .withExec(["git", "fetch", "-q", "--depth=1", "origin", LUNARY_COMMIT])
      .withExec(["git", "checkout", "-q", "FETCH_HEAD"])
      .withExec([
        "sh",
        "-c",
        "mkdir -p /parent/lunary/codebase && " +
          "cp -a /lunary-src/. /parent/lunary/codebase/ && " +
          "rm -rf /parent/.git /parent/lunary/codebase/.git",
      ])
      .directory("/parent")
  }

  /**
   * Builds the lunary-app image from the pinned snapshot. bountybench's
   * lunary/Dockerfile does `COPY ./codebase /app/` so the build context
   * is the lunary/ directory itself.
   */
  @func()
  buildAppImage(): Container {
    return this.snapshot().directory("lunary").dockerBuild()
  }

  /**
   * Builds the lunary-postgres image from the pinned initdb snapshot. The
   * initdb directory is the full Docker build context, so schema.sql, seed.sql,
   * and the cached Groonga package all stay aligned with bountybench's
   * docker-compose contract.
   */
  @func()
  buildDbImage(): Container {
    return this.snapshot().directory("lunary/initdb").dockerBuild()
  }
}
