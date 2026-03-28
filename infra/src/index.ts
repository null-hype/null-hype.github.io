import { dag, Container, Directory, Secret, object, func, argument } from "@dagger.io/dagger"

/**
 * Operator contract (PLAN-180):
 *
 *   bootstrap  Phase 0 — prerequisites only. Creates SA, GCS bucket, SSH keypair.
 *              Never touches compute or DNS. Idempotent. Elevated authority required.
 *   plan       Phase 1 — non-mutating: terraform plan, print diff, exit
 *   check      Phase 1 — ephemeral-only: Terratest suite, create/destroy test resources
 *   deploy     Phase 2 — production-mutating: terraform apply + smallweb SSH bootstrap
 *   verify     Phase 3 — non-mutating: external smoke checks against tidelands.dev
 *   destroy    Phase 2 — production-mutating: terraform destroy
 *
 * Secrets contract (PLAN-181):
 *
 *   gcpCredentials  — GCP service account JSON key (provider + GCS backend)
 *   cloudflareToken — Cloudflare API token (DNS edit + zone settings)
 *   sshPublicKey    — SSH public key → instance metadata at provision time
 *   sshPrivateKey   — SSH private key for post-provision Dagger bootstrap
 *
 * Non-secret config (backendBucket, backendPrefix, gcpProject, etc.) flows
 * in as plain string args.
 */
@object()
export class TidelaneInfra {
  /**
   * bootstrap — control-plane prerequisites only (Phase 0).
   *
   * Creates the prerequisites that plan/deploy require, without touching
   * any Terraform-owned resources (compute, DNS, firewall).
   *
   * What it may create:
   *   - GCP service account for deploy operations
   *   - IAM bindings on that SA
   *   - GCS bucket for Terraform state
   *   - Service account JSON key
   *   - SSH keypair for instance access
   *
   * All operations are idempotent. Failures include the exact remediation
   * command needed to resolve the issue.
   *
   * Implemented in PLAN-193.
   */
  @func()
  async bootstrap(
    gcpProject: string,
    cloudflareToken: Secret,
    @argument({ defaultValue: "us-central1" }) gcpRegion: string,
    @argument({ defaultValue: "tidelane-deploy" }) serviceAccountName: string,
    @argument({ defaultValue: "" }) backendBucket: string,
  ): Promise<string> {
    // TODO(PLAN-193): implement via gcloud prerequisite creation
    throw new Error("bootstrap not yet implemented — see PLAN-193")
  }

  /**
   * plan — non-mutating.
   * Runs `terraform plan` and prints the diff. Never writes state.
   */
  @func()
  async plan(
    src: Directory,
    gcpCredentials: Secret,
    cloudflareToken: Secret,
    sshPublicKey: Secret,
    backendBucket: string,
    backendPrefix: string,
    gcpProject: string,
    @argument({ defaultValue: "us-central1-a" }) gcpZone: string,
    @argument({ defaultValue: "tidelands.dev" }) domain: string,
    cloudflareZoneId: string,
  ): Promise<string> {
    return this.tfContainer(src, gcpCredentials, cloudflareToken, sshPublicKey)
      .withWorkdir("/workspace/terraform")
      .withExec([
        "terraform", "init", "-reconfigure",
        `-backend-config=bucket=${backendBucket}`,
        `-backend-config=prefix=${backendPrefix}`,
      ])
      .withExec([
        "terraform", "plan",
        `-var=gcp_project_id=${gcpProject}`,
        `-var=gcp_zone=${gcpZone}`,
        `-var=domain=${domain}`,
        `-var=cloudflare_zone_id=${cloudflareZoneId}`,
      ])
      .stdout()
  }

  /**
   * deploy — production-mutating.
   * Runs `terraform apply`, then bootstraps smallweb over SSH.
   */
  @func()
  async deploy(
    src: Directory,
    gcpCredentials: Secret,
    cloudflareToken: Secret,
    sshPublicKey: Secret,
    sshPrivateKey: Secret,
    backendBucket: string,
    backendPrefix: string,
    gcpProject: string,
    @argument({ defaultValue: "us-central1-a" }) gcpZone: string,
    @argument({ defaultValue: "tidelands.dev" }) domain: string,
    cloudflareZoneId: string,
  ): Promise<string> {
    const outputs = await this.tfContainer(src, gcpCredentials, cloudflareToken, sshPublicKey)
      .withWorkdir("/workspace/terraform")
      .withExec([
        "terraform", "init", "-reconfigure",
        `-backend-config=bucket=${backendBucket}`,
        `-backend-config=prefix=${backendPrefix}`,
      ])
      .withExec([
        "terraform", "apply", "-auto-approve",
        `-var=gcp_project_id=${gcpProject}`,
        `-var=gcp_zone=${gcpZone}`,
        `-var=domain=${domain}`,
        `-var=cloudflare_zone_id=${cloudflareZoneId}`,
      ])
      .withExec(["terraform", "output", "-json"])
      .stdout()

    // TODO(PLAN-186): parse outputs JSON, SSH into instance_ipv4, run bootstrap
    return outputs
  }

  /**
   * verify — non-mutating.
   * Hits tidelands.dev externally and asserts expected routing behavior.
   */
  @func()
  async verify(
    @argument({ defaultValue: "tidelands.dev" }) domain: string,
  ): Promise<string> {
    // TODO(PLAN-187): expand to representative subdomains and assert response content
    return dag.container()
      .from("curlimages/curl:latest")
      .withExec(["curl", "-sf", "--max-time", "10", `https://${domain}`])
      .stdout()
  }

  /**
   * destroy — production-mutating.
   * Runs `terraform destroy` against production state.
   */
  @func()
  async destroy(
    src: Directory,
    gcpCredentials: Secret,
    cloudflareToken: Secret,
    sshPublicKey: Secret,
    backendBucket: string,
    backendPrefix: string,
    gcpProject: string,
    @argument({ defaultValue: "us-central1-a" }) gcpZone: string,
    @argument({ defaultValue: "tidelands.dev" }) domain: string,
    cloudflareZoneId: string,
  ): Promise<string> {
    return this.tfContainer(src, gcpCredentials, cloudflareToken, sshPublicKey)
      .withWorkdir("/workspace/terraform")
      .withExec([
        "terraform", "init", "-reconfigure",
        `-backend-config=bucket=${backendBucket}`,
        `-backend-config=prefix=${backendPrefix}`,
      ])
      .withExec([
        "terraform", "destroy", "-auto-approve",
        `-var=gcp_project_id=${gcpProject}`,
        `-var=gcp_zone=${gcpZone}`,
        `-var=domain=${domain}`,
        `-var=cloudflare_zone_id=${cloudflareZoneId}`,
      ])
      .stdout()
  }

  /**
   * check — ephemeral-only (net non-mutating).
   * Runs Terratest suite against isolated resources named tidelane-test-<hex>.
   * Resources are always destroyed on exit.
   * Pass preserveOnFailure=true to skip destroy when tests fail (for debugging).
   */
  @func()
  async check(
    src: Directory,
    gcpCredentials: Secret,
    cloudflareToken: Secret,
    gcpProject: string,
    @argument({ defaultValue: false }) preserveOnFailure: boolean,
  ): Promise<string> {
    // TODO(PLAN-185): implement full Terratest suite
    return dag.container()
      .from("golang:1.22-bookworm")
      .withDirectory("/workspace", src)
      .withSecretVariable("GOOGLE_CREDENTIALS", gcpCredentials)
      .withSecretVariable("CLOUDFLARE_API_TOKEN", cloudflareToken)
      .withEnvVariable("GCP_PROJECT", gcpProject)
      .withEnvVariable("PRESERVE_ON_FAILURE", preserveOnFailure ? "1" : "0")
      .withWorkdir("/workspace/test")
      .withExec(["go", "test", "-v", "-timeout", "30m", "./..."])
      .stdout()
  }

  // --- private helpers ---

  private tfContainer(
    src: Directory,
    gcpCredentials: Secret,
    cloudflareToken: Secret,
    sshPublicKey: Secret,
  ): Container {
    return dag.container()
      .from("hashicorp/terraform:1.7")
      .withDirectory("/workspace", src)
      .withSecretVariable("GOOGLE_CREDENTIALS", gcpCredentials)
      .withSecretVariable("CLOUDFLARE_API_TOKEN", cloudflareToken)
      .withSecretVariable("TF_VAR_ssh_public_key", sshPublicKey)
  }
}
