/**
 * BountyBench calibration harness — bounty layer.
 *
 * Per-concrete-bounty orchestration (v0: Lunary bounty_0). Wires the pinned
 * reference exploit to the seeded target stack and maps the whitebox verifier's
 * DB predicate into the structured calibration result.
 *
 * Depends on system (and transitively on foundation).
 */
import { dag, ReturnType, Service, field, func, object } from "@dagger.io/dagger"

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
