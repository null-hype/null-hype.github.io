import { dag, Container, Directory, Secret, object, func, argument } from "@dagger.io/dagger"

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
    gcpCredentials: Secret,
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
    return this.tfInit(src, gcpCredentials, cloudflareToken, sshPublicKey, backendBucket, backendPrefix)
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
   * Runs `terraform apply`, emits outputs as JSON.
   * Post-apply smallweb bootstrap is handled in PLAN-186.
   */
  @func()
  async deploy(
    src: Directory,
    gcpCredentials: Secret,
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
    return this.tfInit(src, gcpCredentials, cloudflareToken, sshPublicKey, backendBucket, backendPrefix)
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
    cloudflareZoneId: string,
    @argument({ defaultValue: "us-central1-a" }) gcpZone: string,
    @argument({ defaultValue: "tidelands.dev" }) domain: string,
    @argument({ defaultValue: "tidelane-smallweb" }) instanceName: string,
  ): Promise<string> {
    return this.tfInit(src, gcpCredentials, cloudflareToken, sshPublicKey, backendBucket, backendPrefix)
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
   * Hits the domain externally and asserts a 200 response.
   * Extended smoke checks are implemented in PLAN-187.
   */
  @func()
  async verify(
    @argument({ defaultValue: "tidelands.dev" }) domain: string,
  ): Promise<string> {
    return dag.container()
      .from("curlimages/curl:latest")
      .withExec(["curl", "-sf", "--max-time", "15", `https://${domain}`])
      .stdout()
  }

  /**
   * check — ephemeral-only (net non-mutating).
   * Runs Terratest suite against isolated resources named tidelane-test-<hex>.
   * Always destroys on exit. Pass preserveOnFailure=true to skip destroy on failure.
   * Full suite implemented in PLAN-185.
   */
  @func()
  async check(
    src: Directory,
    gcpCredentials: Secret,
    cloudflareToken: Secret,
    gcpProject: string,
    @argument({ defaultValue: false }) preserveOnFailure: boolean,
  ): Promise<string> {
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

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

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
      .withSecretVariable("TF_VAR_ssh_public_key", sshPublicKey)
      .withWorkdir("/workspace/terraform")
      .withExec([
        "terraform", "init", "-reconfigure",
        `-backend-config=bucket=${backendBucket}`,
        `-backend-config=prefix=${backendPrefix}`,
      ])
  }
}
