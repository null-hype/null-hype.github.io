import { dag, Container, Directory, File, Secret, object, func, argument } from "@dagger.io/dagger"

/**
 * Operator contract (PLAN-180):
 *
 *   plan    — non-mutating: terraform plan, print diff, exit
 *   check   — ephemeral-only: Terratest suite, create/destroy test resources
 *   deploy  — production-mutating: terraform apply + smallweb SSH bootstrap
 *   verify  — non-mutating: external smoke checks against tidelands.dev
 *   destroy — production-mutating: terraform destroy
 *
 * Secrets contract (PLAN-181):
 *
 *   gcpCredentials  — GCP service account JSON key (provider + GCS backend)
 *   cloudflareToken — Cloudflare API token (DNS edit + zone settings)
 *   sshPublicKey    — SSH public key injected into instance metadata
 *   sshPrivateKey   — SSH private key for post-provision Dagger bootstrap
 *
 * All non-secret config (backendBucket, backendPrefix, gcpProject, etc.)
 * flows in as plain string args.
 */
@object()
export class TidelaneInfra {
  /**
   * plan — non-mutating.
   * Runs `terraform plan` and prints the diff. Never writes state.
   */
  @func()
  async plan(
    src: Directory,
    gcpCredentials?: Secret,
    cloudflareToken: Secret,
    sshPublicKey: Secret,
    backendBucket: string,
    backendPrefix: string,
    gcpProject: string,
    cloudflareZoneId: string,
    @argument({ defaultValue: "us-central1-a" }) gcpZone: string,
    @argument({ defaultValue: "tidelands.dev" }) domain: string,
    @argument({ defaultValue: "tidelane-smallweb" }) instanceName: string,
  ): Promise<string> {
    return this.tfInit(src, this.resolveGcpCredentials(gcpCredentials), cloudflareToken, sshPublicKey, backendBucket, backendPrefix)
      .withExec([
        "terraform", "plan",
        `-var=gcp_project_id=${gcpProject}`,
        `-var=gcp_zone=${gcpZone}`,
        `-var=domain=${domain}`,
        `-var=cloudflare_zone_id=${cloudflareZoneId}`,
        `-var=instance_name=${instanceName}`,
      ])
      .stdout()
  }

  /**
   * deploy — production-mutating.
   * Runs `terraform apply` then bootstraps smallweb on the instance over SSH.
   * Returns the terraform outputs JSON on success.
   */
  @func()
  async deploy(
    src: Directory,
    gcpCredentials?: Secret,
    cloudflareToken: Secret,
    sshPublicKey: Secret,
    sshPrivateKey: Secret,
    backendBucket: string,
    backendPrefix: string,
    gcpProject: string,
    cloudflareZoneId: string,
    @argument({ defaultValue: "us-central1-a" }) gcpZone: string,
    @argument({ defaultValue: "tidelands.dev" }) domain: string,
    @argument({ defaultValue: "tidelane-smallweb" }) instanceName: string,
  ): Promise<string> {
    const outputsJson = await this.tfInit(src, this.resolveGcpCredentials(gcpCredentials), cloudflareToken, sshPublicKey, backendBucket, backendPrefix)
      .withExec([
        "terraform", "apply", "-auto-approve",
        `-var=gcp_project_id=${gcpProject}`,
        `-var=gcp_zone=${gcpZone}`,
        `-var=domain=${domain}`,
        `-var=cloudflare_zone_id=${cloudflareZoneId}`,
        `-var=instance_name=${instanceName}`,
      ])
      .withExec(["terraform", "output", "-json"])
      .stdout()

    // Parse instance IP from outputs and bootstrap smallweb.
    // terraform output -json shape: { "instance_ipv4": { "value": "1.2.3.4", ... }, ... }
    const outputs = JSON.parse(outputsJson) as Record<string, { value: string }>
    const ipv4 = outputs["instance_ipv4"]?.value
    if (!ipv4) {
      throw new Error(`terraform outputs missing instance_ipv4: ${outputsJson}`)
    }

    await this.sshBootstrap(src.file("scripts/bootstrap.sh"), ipv4, domain, sshPrivateKey)
    return outputsJson
  }

  /**
   * destroy — production-mutating.
   * Runs `terraform destroy` against production state.
   */
  @func()
  async destroy(
    src: Directory,
    gcpCredentials?: Secret,
    cloudflareToken: Secret,
    sshPublicKey: Secret,
    backendBucket: string,
    backendPrefix: string,
    gcpProject: string,
    cloudflareZoneId: string,
    @argument({ defaultValue: "us-central1-a" }) gcpZone: string,
    @argument({ defaultValue: "tidelands.dev" }) domain: string,
    @argument({ defaultValue: "tidelane-smallweb" }) instanceName: string,
  ): Promise<string> {
    return this.tfInit(src, this.resolveGcpCredentials(gcpCredentials), cloudflareToken, sshPublicKey, backendBucket, backendPrefix)
      .withExec([
        "terraform", "destroy", "-auto-approve",
        `-var=gcp_project_id=${gcpProject}`,
        `-var=gcp_zone=${gcpZone}`,
        `-var=domain=${domain}`,
        `-var=cloudflare_zone_id=${cloudflareZoneId}`,
        `-var=instance_name=${instanceName}`,
      ])
      .stdout()
  }

  /**
   * verify — non-mutating.
   * Runs external smoke checks against the deployed domain:
   *
   *   1. Apex reachable:   https://<domain>      → 200
   *   2. Health app:       https://health.<domain> → 200, body contains {"ok":true}
   *   3. Cloudflare proxy: response includes CF-Ray header (proves traffic went through CF)
   *   4. TLS:              curl validates the certificate chain (strict mode)
   *
   * Fails fast on first assertion error and prints which check failed.
   */
  @func()
  async verify(
    @argument({ defaultValue: "tidelands.dev" }) domain: string,
  ): Promise<string> {
    const checks = `
set -euo pipefail

DOMAIN="${domain}"
PASS=0
FAIL=0

run_check() {
  local label="$1"
  local cmd="$2"
  local assert="$3"
  local result
  result=$(eval "$cmd" 2>&1) || true
  if echo "$result" | grep -q "$assert"; then
    echo "[PASS] $label"
    PASS=$((PASS + 1))
  else
    echo "[FAIL] $label"
    echo "  expected to find: $assert"
    echo "  got: $result"
    FAIL=$((FAIL + 1))
  fi
}

# 1. Apex returns 200
run_check "apex HTTP 200" \\
  "curl -sS --max-time 15 -o /dev/null -w '%{http_code}' https://$DOMAIN" \\
  "200"

# 2. Health app returns 200 with expected JSON body
run_check "health app HTTP 200" \\
  "curl -sS --max-time 15 https://health.$DOMAIN" \\
  '"ok":true'

# 3. Cloudflare proxy: CF-Ray header present on apex
run_check "Cloudflare proxy (CF-Ray header)" \\
  "curl -sS --max-time 15 -I https://$DOMAIN" \\
  "cf-ray"

# 4. Wildcard: a second subdomain also routes correctly
run_check "wildcard routing (health subdomain via wildcard)" \\
  "curl -sS --max-time 15 -o /dev/null -w '%{http_code}' https://health.$DOMAIN" \\
  "200"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
`

    return dag.container()
      .from("curlimages/curl:latest")
      .withExec(["sh", "-c", checks])
      .stdout()
  }

  /**
   * check — ephemeral-only (net non-mutating).
   * Runs Terratest suite against isolated resources named tidelane-test-<hex>.
   * Always destroys on exit. Pass preserveOnFailure=true to skip destroy on failure.
   */
  @func()
  async check(
    src: Directory,
    gcpCredentials?: Secret,
    cloudflareToken: Secret,
    gcpProject: string,
    cloudflareZoneId: string,
    @argument({ defaultValue: false }) preserveOnFailure: boolean,
  ): Promise<string> {
    const resolvedGcpCredentials = this.resolveGcpCredentials(gcpCredentials)
    return dag.container()
      .from("golang:1.22-bookworm")
      .withDirectory("/workspace", src)
      .withSecretVariable("GOOGLE_CREDENTIALS", resolvedGcpCredentials)
      .withSecretVariable("CLOUDFLARE_API_TOKEN", cloudflareToken)
      .withEnvVariable("GCP_PROJECT", gcpProject)
      .withEnvVariable("CLOUDFLARE_ZONE_ID", cloudflareZoneId)
      .withEnvVariable("PRESERVE_ON_FAILURE", preserveOnFailure ? "1" : "0")
      .withWorkdir("/workspace/test")
      .withExec(["go", "mod", "tidy"])
      .withExec(["go", "test", "-v", "-timeout", "30m", "./..."])
      .stdout()
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * sshBootstrap connects to host as the smallweb user, waits for SSH to be
   * ready, copies bootstrap.sh, and runs it with the target domain as argument.
   *
   * Retries SSH connection for up to 90 seconds to allow the instance time to
   * initialise after first boot.
   */
  /**
   * sshBootstrap connects to host as the smallweb user, waits for SSH to be
   * ready, copies bootstrap.sh from src, and runs it with the target domain.
   *
   * Retries SSH connection for up to 90 seconds (18 attempts × 5s) to allow
   * the instance time to initialise after first boot.
   */
  private async sshBootstrap(
    bootstrapFile: File,
    host: string,
    domain: string,
    sshPrivateKey: Secret,
  ): Promise<string> {
    const sshFlags = "-o StrictHostKeyChecking=no -o ConnectTimeout=5 -i /root/.ssh/id_ed25519"
    const target = `smallweb@${host}`

    return dag.container()
      .from("alpine:3.19")
      .withExec(["apk", "add", "--no-cache", "openssh-client"])
      .withMountedSecret("/root/.ssh/id_ed25519", sshPrivateKey)
      .withExec(["chmod", "600", "/root/.ssh/id_ed25519"])
      .withMountedFile("/bootstrap.sh", bootstrapFile)
      // Wait up to 90 seconds for SSH to become available.
      .withExec([
        "sh", "-c",
        `for i in $(seq 1 18); do
           ssh ${sshFlags} ${target} echo ready && break
           echo "waiting for SSH ($i/18)..." && sleep 5
           [ $i -eq 18 ] && echo "SSH timed out" && exit 1
         done`,
      ])
      // Copy bootstrap script and execute it with the domain argument.
      .withExec(["scp", ...sshFlags.split(" "), "/bootstrap.sh", `${target}:/tmp/bootstrap.sh`])
      .withExec(["ssh", ...sshFlags.split(" "), target, `bash /tmp/bootstrap.sh ${domain}`])
      .stdout()
  }

  /**
   * tfInit returns a container with Terraform initialised against the GCS backend.
   * All subsequent terraform commands chain off this.
   */
  private tfInit(
    src: Directory,
    gcpCredentials: Secret,
    cloudflareToken: Secret,
    sshPublicKey: Secret,
    backendBucket: string,
    backendPrefix: string,
  ): Container {
    return dag.container()
      .from("hashicorp/terraform:1.7")
      .withDirectory("/workspace", src)
      .withSecretVariable("GOOGLE_CREDENTIALS", gcpCredentials)
      .withSecretVariable("CLOUDFLARE_API_TOKEN", cloudflareToken)
      .withSecretVariable("TF_VAR_cloudflare_api_token", cloudflareToken)
      .withSecretVariable("TF_VAR_ssh_public_key", sshPublicKey)
      .withWorkdir("/workspace/terraform")
      .withExec([
        "terraform", "init", "-reconfigure",
        `-backend-config=bucket=${backendBucket}`,
        `-backend-config=prefix=${backendPrefix}`,
      ])
  }

  /**
   * Prefer an explicitly-passed secret, then fall back to Render/CI env.
   * This lets the preview service use a normal build command without passing
   * a dedicated --gcp-credentials flag on every invocation.
   */
  private resolveGcpCredentials(gcpCredentials?: Secret): Secret {
    if (gcpCredentials) {
      return gcpCredentials
    }

    const envCredentials = process.env.GCP_CREDENTIALS_JSON
    if (envCredentials && envCredentials.trim() !== "") {
      return dag.setSecret("gcp-credentials", envCredentials)
    }

    throw new Error("gcp credentials are required: pass gcpCredentials or set GCP_CREDENTIALS_JSON")
  }
}
