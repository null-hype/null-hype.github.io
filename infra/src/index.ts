import { dag, Container, Directory, File, Secret, object, func, argument } from "@dagger.io/dagger"

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
    backendConfig: File,
    varFile: File,
  ): Promise<string> {
    return this.terraform(src, gcpCredentials, cloudflareToken)
      .withMountedFile("/workspace/backend.tfvars", backendConfig)
      .withMountedFile("/workspace/prod.tfvars", varFile)
      .withWorkdir("/workspace/terraform")
      .withExec(["terraform", "init", "-backend-config=/workspace/backend.tfvars", "-reconfigure"])
      .withExec(["terraform", "plan", "-var-file=/workspace/prod.tfvars", "-out=/tmp/tfplan"])
      .stdout()
  }

  /**
   * deploy — production-mutating.
   * Runs `terraform apply` then bootstraps smallweb over SSH.
   */
  @func()
  async deploy(
    src: Directory,
    gcpCredentials: Secret,
    cloudflareToken: Secret,
    backendConfig: File,
    varFile: File,
    sshPrivateKey: Secret,
  ): Promise<string> {
    const apply = await this.terraform(src, gcpCredentials, cloudflareToken)
      .withMountedFile("/workspace/backend.tfvars", backendConfig)
      .withMountedFile("/workspace/prod.tfvars", varFile)
      .withWorkdir("/workspace/terraform")
      .withExec(["terraform", "init", "-backend-config=/workspace/backend.tfvars", "-reconfigure"])
      .withExec(["terraform", "apply", "-var-file=/workspace/prod.tfvars", "-auto-approve"])
      .withExec(["terraform", "output", "-json"])
      .stdout()

    // TODO(PLAN-184): post-apply smallweb bootstrap via SSH using outputs
    return apply
  }

  /**
   * verify — non-mutating.
   * Hits tidelands.dev externally and asserts expected routing behavior.
   */
  @func()
  async verify(): Promise<string> {
    // TODO(PLAN-187): implement external smoke checks
    return dag.container()
      .from("curlimages/curl:latest")
      .withExec(["curl", "-sf", "--max-time", "10", "https://tidelands.dev"])
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
    backendConfig: File,
    varFile: File,
  ): Promise<string> {
    return this.terraform(src, gcpCredentials, cloudflareToken)
      .withMountedFile("/workspace/backend.tfvars", backendConfig)
      .withMountedFile("/workspace/prod.tfvars", varFile)
      .withWorkdir("/workspace/terraform")
      .withExec(["terraform", "init", "-backend-config=/workspace/backend.tfvars", "-reconfigure"])
      .withExec(["terraform", "destroy", "-var-file=/workspace/prod.tfvars", "-auto-approve"])
      .stdout()
  }

  /**
   * check — ephemeral-only (net non-mutating).
   * Runs Terratest suite against isolated resources. Destroys on exit.
   * Pass preserveOnFailure=true to skip destroy when tests fail.
   */
  @func()
  async check(
    src: Directory,
    gcpCredentials: Secret,
    cloudflareToken: Secret,
    @argument({ defaultValue: false }) preserveOnFailure: boolean,
  ): Promise<string> {
    // TODO(PLAN-185): implement Terratest suite
    const env = preserveOnFailure ? "PRESERVE_ON_FAILURE=1" : "PRESERVE_ON_FAILURE=0"
    return dag.container()
      .from("golang:1.22-bookworm")
      .withDirectory("/workspace", src)
      .withWorkdir("/workspace/test")
      .withEnvVariable("PRESERVE_ON_FAILURE", preserveOnFailure ? "1" : "0")
      .withExec(["go", "test", "-v", "-timeout", "30m", "./..."])
      .stdout()
  }

  // --- private helpers ---

  private terraform(
    src: Directory,
    gcpCredentials: Secret,
    cloudflareToken: Secret,
  ): Container {
    return dag.container()
      .from("hashicorp/terraform:1.7")
      .withDirectory("/workspace", src)
      .withSecretVariable("GOOGLE_CREDENTIALS", gcpCredentials)
      .withSecretVariable("CLOUDFLARE_API_TOKEN", cloudflareToken)
  }
}
