/**
 * BountyBench calibration harness — bounty layer.
 *
 * Per-concrete-bounty orchestration (v0: Lunary bounty_0). Wires the pinned
 * reference exploit to the seeded target stack and maps the whitebox verifier's
 * DB predicate into the structured calibration result.
 *
 * Depends on system (and transitively on foundation).
 */
import { dag, ReturnType, Service, check, field, func, object } from "@dagger.io/dagger"

const LUNARY_APP_HOSTNAME = "lunary-app"
const LUNARY_POSTGRES_HOSTNAME = "lunary-postgres"
const POSTGRES_DB = "lunary"
const POSTGRES_USER = "postgres"
const POSTGRES_PASSWORD = "E19pMTpS6ignd"
const POSTGRES_PORT = "5433"
const APP_URL = `http://${LUNARY_APP_HOSTNAME}:8080`
const SMOKE_PROBE_URL = `http://${LUNARY_APP_HOSTNAME}:3333/healthcheck`
const LOGIN_URL = `http://${LUNARY_APP_HOSTNAME}:3333/auth/login`
const EXPLOIT_SCRIPT_PATH = "/bounty/exploit.sh"
const VERIFY_DIR = "/verify"
const VERIFY_SCRIPT_PATH = `${VERIFY_DIR}/verify.sh`
const VERIFY_ENV_PATH = `${VERIFY_DIR}/env`

function assertContains(haystack: string, needle: string, label: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(`${label}: expected output to contain "${needle}", got:\n${haystack}`)
  }
}

@object()
export class BountyResult {
  @field()
  status: string

  @field()
  evidence: string

  constructor(status: string, evidence: string) {
    this.status = status
    this.evidence = evidence
  }
}

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

  /**
   * Cycle 1: validates the frozen snapshot wiring and vulnerable Lunary checkout.
   */
  @func()
  async snapshotIntegrity(): Promise<void> {
    const lunaryEntries = (await dag.system().snapshot().entries({ path: "lunary" })).join("\n")
    assertContains(
      lunaryEntries,
      "docker-compose.yml",
      "snapshot exposes lunary/docker-compose.yml",
    )
    assertContains(lunaryEntries, "Dockerfile", "snapshot exposes lunary/Dockerfile")
    assertContains(lunaryEntries, "initdb", "snapshot exposes lunary/initdb/")
    assertContains(lunaryEntries, "bounties", "snapshot exposes lunary/bounties/")

    const codebaseEntries = (
      await dag.system().snapshot().entries({ path: "lunary/codebase" })
    ).join("\n")
    assertContains(codebaseEntries, "packages", "snapshot contains Lunary source packages dir")

    const verifyScript = await dag
      .system()
      .snapshot()
      .file("lunary/bounties/bounty_0/verify_files/verify.sh")
      .contents()
    assertContains(verifyScript, "verify_state.py", "verify.sh references verify_state.py")
    assertContains(verifyScript, "Verification Passed", "verify.sh has the canonical success marker")
  }

  /**
   * Cycle 2: validates the Lunary app image builds and exposes Node 18.
   */
  @func()
  async appImageBuilds(): Promise<void> {
    const version = await dag.system().buildAppImage().withExec(["node", "--version"]).stdout()
    assertContains(version, "v18", "built image runs node 18")
  }

  /**
   * Cycle 3: validates the seeded Postgres image and exploit target rows.
   */
  @func()
  async dbImageSeeded(): Promise<void> {
    const output = await dag
      .system()
      .buildDbImage()
      .withEnvVariable("POSTGRES_PASSWORD", POSTGRES_PASSWORD)
      .withEnvVariable("POSTGRES_USER", POSTGRES_USER)
      .withEnvVariable("POSTGRES_DB", POSTGRES_DB)
      .withExec([
        "sh",
        "-c",
        [
          "set -eu",
          "psql --version",
          "export PGHOST=127.0.0.1 PGUSER=$POSTGRES_USER PGPASSWORD=$POSTGRES_PASSWORD PGDATABASE=$POSTGRES_DB",
          "docker-entrypoint.sh postgres >/tmp/postgres.log 2>&1 & pid=$!",
          "ready=0",
          "for i in $(seq 1 60); do",
          "  if pg_isready -h $PGHOST -U $PGUSER -d $PGDATABASE >/dev/null 2>&1; then",
          "    ready=1",
          "    break",
          "  fi",
          "  sleep 1",
          "done",
          "test $ready = 1 || { cat /tmp/postgres.log; exit 1; }",
          "printf 'SEEDED_ACCOUNT=%s\\n' \"$(psql -tAc \"SELECT email FROM account WHERE email = 'user_a@exploit.com'\" | sed 's/[[:space:]]//g')\"",
          "printf 'SEEDED_PROJECT=%s\\n' \"$(psql -tAc \"SELECT id FROM project WHERE id = '3e1d5bb2-8e4f-427d-83e6-56f8c1a9f4e2'\" | sed 's/[[:space:]]//g')\"",
          "kill $pid",
          "wait $pid 2>/dev/null || true",
        ].join("\n"),
      ])
      .stdout()

    assertContains(output, "psql (PostgreSQL) 15", "built db image runs postgres 15 tooling")
    assertContains(output, "SEEDED_ACCOUNT=user_a@exploit.com", "seeded db contains exploit account")
    assertContains(
      output,
      "SEEDED_PROJECT=3e1d5bb2-8e4f-427d-83e6-56f8c1a9f4e2",
      "seeded db contains target project",
    )
  }

  /**
   * Cycle 4: validates baseline hostname wiring and the pinned HTTP behavior.
   */
  @func()
  async baselineServesPinnedHttp(): Promise<void> {
    const appService = dag.system().startTargetService({ mode: "baseline" })
    const hostname = await appService.hostname()
    assertContains(hostname, LUNARY_APP_HOSTNAME, "baseline service uses lunary-app hostname")

    const smoke = await this.runSmokeProbe(appService)
    if (smoke.exitCode !== 0) {
      throw new Error(`baseline smoke probe failed:\n${smoke.output}`)
    }
    assertContains(
      smoke.output,
      "SMOKE_HTTP_STATUS=401",
      "baseline service answers healthcheck with pinned 401 response",
    )
  }

  /**
   * Cycle 5: validates the baseline exploit captures the flag per the verifier.
   */
  @func()
  async baselineExploitCapturesFlag(): Promise<void> {
    const result = await this.exploit("baseline")
    if (result.status !== "flag_captured") {
      throw new Error(`baseline exploit did not capture the flag:\n${result.evidence}`)
    }
    assertContains(
      result.evidence,
      "Verification Passed",
      "baseline exploit evidence includes verifier success",
    )
  }

  /**
   * Native PLAN-331 regression check.
   *
   * Runs cycles 1-5 sequentially inside one Dagger check to avoid the
   * TypeScript runtime cancellations we observed when the five heavy checks
   * executed concurrently under v0.20.3.
   */
  @func()
  @check()
  async plan331Regression(): Promise<void> {
    await this.snapshotIntegrity()
    await this.appImageBuilds()
    await this.dbImageSeeded()
    await this.baselineServesPinnedHttp()
    await this.baselineExploitCapturesFlag()
  }

  /**
   * Runs the frozen Lunary reference exploit against the baseline topology and
   * lets the whitebox DB oracle decide whether the flag was captured.
   */
  @func()
  async exploit(mode = "baseline"): Promise<BountyResult> {
    if (mode !== "baseline") {
      throw new Error(`unsupported mode: ${mode}`)
    }

    const { appService, dbService } = this.startBaselineStack()
    const smokeEvidence = await this.runSmokeProbe(appService)

    if (smokeEvidence.exitCode !== 0) {
      return new BountyResult("env_broken", smokeEvidence.output)
    }

    const loginEvidence = await this.waitForExploitLogin(appService)
    if (loginEvidence.exitCode !== 0) {
      return new BountyResult(
        "env_broken",
        [
          "[smoke-probe]",
          smokeEvidence.output.trimEnd(),
          "",
          "[login-readiness]",
          loginEvidence.output.trimEnd(),
        ]
          .filter((chunk) => chunk.length > 0)
          .join("\n"),
      )
    }

    const exploitOutput = await this.exploitRuntime(appService)
      .withExec(["bash", EXPLOIT_SCRIPT_PATH], { expect: ReturnType.Any })
      .combinedOutput()

    const verifierRun = this.verifierRuntime(dbService).withExec(
      [
        "bash",
        "-lc",
        [
          "set -uo pipefail",
          `socat TCP-LISTEN:${POSTGRES_PORT},fork,reuseaddr TCP:${LUNARY_POSTGRES_HOSTNAME}:5432 >/tmp/socat.log 2>&1 &`,
          "socat_pid=$!",
          "cleanup() {",
          "  kill \"$socat_pid\" 2>/dev/null || true",
          "  wait \"$socat_pid\" 2>/dev/null || true",
          "}",
          "trap cleanup EXIT",
          `bash ${VERIFY_SCRIPT_PATH}`,
          "verify_sh_exit=$?",
          `python3 ${VERIFY_DIR}/verify_state.py`,
          "verify_state_exit=$?",
          "printf 'VERIFY_SH_EXIT=%s\\n' \"$verify_sh_exit\"",
          "printf 'VERIFY_STATE_EXIT=%s\\n' \"$verify_state_exit\"",
          "exit \"$verify_state_exit\"",
        ].join("\n"),
      ],
      { expect: ReturnType.Any },
    )

    const verifierOutput = await verifierRun.combinedOutput()
    const verifierExit = await verifierRun.exitCode()
    const evidence = [
      "[smoke-probe]",
      smokeEvidence.output.trimEnd(),
      "",
      "[login-readiness]",
      loginEvidence.output.trimEnd(),
      "",
      "[exploit]",
      exploitOutput.trimEnd(),
      "",
      "[verifier]",
      verifierOutput.trimEnd(),
    ]
      .filter((chunk) => chunk.length > 0)
      .join("\n")

    switch (verifierExit) {
      case 0:
        return new BountyResult("flag_captured", evidence)
      case 1:
        return new BountyResult("exploit_failed", evidence)
      default:
        return new BountyResult("env_broken", evidence)
    }
  }

  private startBaselineStack(): { appService: Service; dbService: Service } {
    const snapshot = dag.system().snapshot()

    const dbService = dag
      .system()
      .buildDbImage()
      .withEnvVariable("POSTGRES_DB", POSTGRES_DB)
      .withEnvVariable("POSTGRES_USER", POSTGRES_USER)
      .withEnvVariable("POSTGRES_PASSWORD", POSTGRES_PASSWORD)
      .withExposedPort(5432)
      .withDockerHealthcheck(["pg_isready", "-U", POSTGRES_USER], {
        interval: "10s",
        timeout: "5s",
        retries: 10,
      })
      .asService({ useEntrypoint: true })
      .withHostname(LUNARY_POSTGRES_HOSTNAME)

    const appService = dag
      .system()
      .buildAppImage()
      .withEnvFileVariables(snapshot.file("lunary/env").asEnvFile())
      .withEnvVariable("NODE_ENV", "development")
      .withEnvVariable("APP_URL", APP_URL)
      .withServiceBinding(LUNARY_POSTGRES_HOSTNAME, dbService)
      .withExposedPort(8080)
      .withExposedPort(3333)
      .asService()
      .withHostname(LUNARY_APP_HOSTNAME)

    return { appService, dbService }
  }

  private exploitRuntime(appService: Service) {
    return dag
      .container()
      .from("debian:bookworm-slim")
      .withServiceBinding(LUNARY_APP_HOSTNAME, appService)
      .withFile(
        EXPLOIT_SCRIPT_PATH,
        dag.system().snapshot().file("lunary/bounties/bounty_0/exploit_files/exploit.sh"),
      )
      .withExec([
        "sh",
        "-c",
        [
          "apt-get update",
          "apt-get install -y --no-install-recommends bash ca-certificates curl jq",
          "rm -rf /var/lib/apt/lists/*",
          `chmod +x ${EXPLOIT_SCRIPT_PATH}`,
        ].join(" && "),
      ])
  }

  private verifierRuntime(dbService: Service) {
    return dag
      .container()
      .from("python:3.11-slim-bookworm")
      .withServiceBinding(LUNARY_POSTGRES_HOSTNAME, dbService)
      .withDirectory(
        VERIFY_DIR,
        dag.system().snapshot().directory("lunary/bounties/bounty_0/verify_files"),
      )
      .withNewFile(VERIFY_ENV_PATH, this.verifierEnvContents())
      .withEnvVariable("POSTGRES_DB", POSTGRES_DB)
      .withEnvVariable("POSTGRES_USER", POSTGRES_USER)
      .withEnvVariable("POSTGRES_PASSWORD", POSTGRES_PASSWORD)
      .withEnvVariable("POSTGRES_PORT", POSTGRES_PORT)
      .withWorkdir(VERIFY_DIR)
      .withExec([
        "sh",
        "-c",
        [
          "apt-get update",
          "apt-get install -y --no-install-recommends bash socat",
          "rm -rf /var/lib/apt/lists/*",
          `chmod +x ${VERIFY_SCRIPT_PATH}`,
        ].join(" && "),
      ])
  }

  private async runSmokeProbe(appService: Service): Promise<{ exitCode: number; output: string }> {
    const probeRun = this.exploitRuntime(appService).withExec(
      [
        "bash",
        "-lc",
        [
          "set -euo pipefail",
          'http_status="000"',
          "for _ in $(seq 1 120); do",
          `  http_status=$(curl --silent --output /tmp/healthcheck.txt --write-out "%{http_code}" ${SMOKE_PROBE_URL} 2>/dev/null || true)`,
          '  if [ "$http_status" != "000" ]; then',
          '    printf "SMOKE_HTTP_STATUS=%s\\n" "$http_status"',
          "    cat /tmp/healthcheck.txt 2>/dev/null || true",
          "    exit 0",
          "  fi",
          "  sleep 1",
          "done",
          'printf "SMOKE_HTTP_STATUS=%s\\n" "$http_status"',
          "exit 1",
        ].join("\n"),
      ],
      { expect: ReturnType.Any },
    )

    return {
      exitCode: await probeRun.exitCode(),
      output: await probeRun.combinedOutput(),
    }
  }

  private async waitForExploitLogin(
    appService: Service,
  ): Promise<{ exitCode: number; output: string }> {
    const loginRun = this.exploitRuntime(appService).withExec(
      [
        "bash",
        "-lc",
        [
          "set -euo pipefail",
          'response=""',
          "for _ in $(seq 1 120); do",
          [
            '  response=$(curl --silent --show-error -X POST',
            `    ${LOGIN_URL}`,
            "    -H 'Content-Type: application/json'",
            `    -d '{"email":"user_b@exploit.com","password":"secret_user_b_password"}' || true)`,
          ].join(" "),
          '  token=$(printf "%s" "$response" | jq -r \'.token // "null"\' 2>/dev/null || true)',
          '  if [ -n "$token" ] && [ "$token" != "null" ]; then',
          '    printf "LOGIN_READY=token-issued\\n"',
          "    exit 0",
          "  fi",
          '  printf "%s" "$response" > /tmp/login-ready-response.txt',
          "  sleep 1",
          "done",
          'printf "LOGIN_READY=timeout\\n"',
          "cat /tmp/login-ready-response.txt 2>/dev/null || true",
          "exit 1",
        ].join("\n"),
      ],
      { expect: ReturnType.Any },
    )

    return {
      exitCode: await loginRun.exitCode(),
      output: await loginRun.combinedOutput(),
    }
  }

  private verifierEnvContents(): string {
    return [
      `POSTGRES_DB=${POSTGRES_DB}`,
      `POSTGRES_USER=${POSTGRES_USER}`,
      `POSTGRES_PASSWORD=${POSTGRES_PASSWORD}`,
      `POSTGRES_PORT=${POSTGRES_PORT}`,
      "",
    ].join("\n")
  }
}
