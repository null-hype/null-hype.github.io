import { dag, Container, Directory, Secret, File, object, func, argument } from "@dagger.io/dagger"

type DeploymentConfig = {
  backendBucket: string
  backendPrefix: string
  gcpProject: string
  cloudflareZoneId: string
  gcpZone: string
  domain: string
  instanceName: string
  deploymentSlot: string
  manageDirectDnsRecords: boolean
  manageSlotOriginDnsRecord: boolean
  manageZoneSettings: boolean
}

type SmallwebRootConfig = {
  apps?: Record<string, {
    authorizedEmails?: string[]
    [key: string]: unknown
  }>
  [key: string]: unknown
}

/**
 * Dagger is the operator entrypoint; Terraform owns infrastructure state.
 */
@object()
export class TidelaneInfra {
  /**
   * bootstrap — control-plane prerequisites only (Phase 0).
   */
  @func()
  async bootstrap(
    gcpProject: string,
    cloudflareToken: Secret,
    gcpRegion = "us-central1",
    serviceAccountName = "tidelane-deploy",
    backendBucket = "",
  ): Promise<string> {
    void gcpProject
    void cloudflareToken
    void gcpRegion
    void serviceAccountName
    void backendBucket
    throw new Error("bootstrap not yet implemented — see infra/scripts/bootstrap-gcp-deploy-sa.sh")
  }

  /**
   * plan — non-mutating. Runs Terraform plan against the selected slot.
   */
  @func()
  async plan(
    @argument({ defaultPath: "." }) src: Directory,
    cloudflareToken?: Secret,
    sshPublicKey?: Secret,
    backendBucket = process.env.BACKEND_BUCKET ?? "",
    backendPrefix = process.env.BACKEND_PREFIX ?? "",
    gcpProject = process.env.GCP_PROJECT ?? "",
    cloudflareZoneId = process.env.CLOUDFLARE_ZONE_ID ?? "",
    deploymentSlot = process.env.DEPLOYMENT_SLOT ?? "blue",
    manageDirectDnsRecords = true,
    manageSlotOriginDnsRecord = true,
    manageZoneSettings = false,
    gcpZone = "us-central1-a",
    domain = "tidelands.dev",
    instanceName = "tidelane-smallweb",
    gcpCredentials?: Secret,
  ): Promise<string> {
    const token = cloudflareToken ?? this.resolveSecret("CLOUDFLARE_API_TOKEN", "cloudflare-token")
    const pubKey = sshPublicKey ?? this.resolveSecret("SSH_PUBLIC_KEY", "ssh-public-key")
    const config = this.deploymentConfig({
      backendBucket,
      backendPrefix,
      cloudflareZoneId,
      deploymentSlot,
      domain,
      gcpProject,
      gcpZone,
      instanceName,
      manageDirectDnsRecords,
      manageSlotOriginDnsRecord,
      manageZoneSettings,
    })

    return this.tfInit(src, this.resolveGcpCredentials(gcpCredentials), token, pubKey, config)
      .withExec(["terraform", "plan", ...this.tfVars(config)])
      .stdout()
  }

  /**
   * outputs — non-mutating. Reads Terraform outputs from remote state.
   */
  @func()
  async outputs(
    @argument({ defaultPath: "." }) src: Directory,
    cloudflareToken?: Secret,
    sshPublicKey?: Secret,
    backendBucket = process.env.BACKEND_BUCKET ?? "",
    backendPrefix = process.env.BACKEND_PREFIX ?? "",
    gcpProject = process.env.GCP_PROJECT ?? "",
    cloudflareZoneId = process.env.CLOUDFLARE_ZONE_ID ?? "",
    deploymentSlot = process.env.DEPLOYMENT_SLOT ?? "blue",
    manageDirectDnsRecords = true,
    manageSlotOriginDnsRecord = true,
    manageZoneSettings = false,
    gcpZone = "us-central1-a",
    domain = "tidelands.dev",
    instanceName = "tidelane-smallweb",
    gcpCredentials?: Secret,
  ): Promise<string> {
    const token = cloudflareToken ?? this.resolveSecret("CLOUDFLARE_API_TOKEN", "cloudflare-token")
    const pubKey = sshPublicKey ?? this.resolveSecret("SSH_PUBLIC_KEY", "ssh-public-key")
    const config = this.deploymentConfig({
      backendBucket,
      backendPrefix,
      cloudflareZoneId,
      deploymentSlot,
      domain,
      gcpProject,
      gcpZone,
      instanceName,
      manageDirectDnsRecords,
      manageSlotOriginDnsRecord,
      manageZoneSettings,
    })

    return this.tfInit(src, this.resolveGcpCredentials(gcpCredentials), token, pubKey, config)
      .withExec(["terraform", "output", "-json"])
      .stdout()
  }

  /**
   * deploy — production-mutating. Applies Terraform, builds the site, uploads
   * the Smallweb bundle, and configures runtime services on the VM.
   */
  @func()
  async deploy(
    @argument({ defaultPath: "." }) src: Directory,
    cloudflareToken?: Secret,
    sshPublicKey?: Secret,
    sshPrivateKey?: Secret,
    openrouterApiKey?: Secret,
    backendBucket = process.env.BACKEND_BUCKET ?? "",
    backendPrefix = process.env.BACKEND_PREFIX ?? "",
    gcpProject = process.env.GCP_PROJECT ?? "",
    cloudflareZoneId = process.env.CLOUDFLARE_ZONE_ID ?? "",
    @argument({ defaultPath: "..", ignore: [
      ".git",
      ".tmp-smallweb-mutagen",
      ".playwright",
      ".playwright-cli",
      "dist",
      "infra/node_modules",
      "node_modules",
    ] }) repo: Directory,
    @argument({ defaultPath: "../.smallweb-root", ignore: [".vscode/"] }) smallwebRoot: Directory,
    adminAuthorizedEmails = process.env.ADMIN_AUTHORIZED_EMAILS ?? "",
    deploymentSlot = process.env.DEPLOYMENT_SLOT ?? "blue",
    manageDirectDnsRecords = true,
    manageSlotOriginDnsRecord = true,
    manageZoneSettings = false,
    gcpZone = "us-central1-a",
    domain = "tidelands.dev",
    instanceName = "tidelane-smallweb",
    publicGooseSessionApiUrl = "",
    gcpCredentials?: Secret,
  ): Promise<string> {
    const token = cloudflareToken ?? this.resolveSecret("CLOUDFLARE_API_TOKEN", "cloudflare-token")
    const pubKey = sshPublicKey ?? this.resolveSecret("SSH_PUBLIC_KEY", "ssh-public-key")
    const privKey = sshPrivateKey ?? this.resolveSecret("SSH_PRIVATE_KEY", "ssh-private-key")
    const openrouterKey = openrouterApiKey ?? this.resolveSecret("OPENROUTER_API_KEY", "openrouter-api-key")
    const config = this.deploymentConfig({
      backendBucket,
      backendPrefix,
      cloudflareZoneId,
      deploymentSlot,
      domain,
      gcpProject,
      gcpZone,
      instanceName,
      manageDirectDnsRecords,
      manageSlotOriginDnsRecord,
      manageZoneSettings,
    })
    const sessionApiUrl = publicGooseSessionApiUrl || `https://admin.${config.domain}/api/goose-sessions`

    const applyNonce = new Date().toISOString()
    const outputsJson = await this.tfInit(
      src,
      this.resolveGcpCredentials(gcpCredentials),
      token,
      pubKey,
      config,
    )
      .withEnvVariable("DAGGER_TERRAFORM_APPLY_NONCE", applyNonce)
      .withExec(["terraform", "apply", "-auto-approve", ...this.tfVars(config)])
      .withExec(["terraform", "apply", "-refresh-only", "-auto-approve", ...this.tfVars(config)])
      .withExec(["terraform", "output", "-json"])
      .stdout()

    const outputs = JSON.parse(outputsJson) as Record<string, { value: string }>
    const ipv4 = outputs["instance_ipv4"]?.value
    if (!ipv4) {
      throw new Error(`terraform outputs missing instance_ipv4: ${outputsJson}`)
    }

    const dist = this.buildAstroDist(repo, sessionApiUrl)
    const bundle = await this.smallwebBundle(smallwebRoot, dist, adminAuthorizedEmails)
    const runtimeLog = await this.deployRuntime(
      bundle,
      src.file("scripts/bootstrap.sh"),
      ipv4,
      config.domain,
      privKey,
      token,
      openrouterKey,
    )

    return `${outputsJson.trim()}\n\n${runtimeLog}`
  }

  /**
   * destroy — production-mutating. Runs Terraform destroy for the selected slot.
   */
  @func()
  async destroy(
    @argument({ defaultPath: "." }) src: Directory,
    cloudflareToken?: Secret,
    sshPublicKey?: Secret,
    backendBucket = process.env.BACKEND_BUCKET ?? "",
    backendPrefix = process.env.BACKEND_PREFIX ?? "",
    gcpProject = process.env.GCP_PROJECT ?? "",
    cloudflareZoneId = process.env.CLOUDFLARE_ZONE_ID ?? "",
    deploymentSlot = process.env.DEPLOYMENT_SLOT ?? "blue",
    manageDirectDnsRecords = true,
    manageSlotOriginDnsRecord = true,
    manageZoneSettings = false,
    gcpZone = "us-central1-a",
    domain = "tidelands.dev",
    instanceName = "tidelane-smallweb",
    gcpCredentials?: Secret,
  ): Promise<string> {
    const token = cloudflareToken ?? this.resolveSecret("CLOUDFLARE_API_TOKEN", "cloudflare-token")
    const pubKey = sshPublicKey ?? this.resolveSecret("SSH_PUBLIC_KEY", "ssh-public-key")
    const config = this.deploymentConfig({
      backendBucket,
      backendPrefix,
      cloudflareZoneId,
      deploymentSlot,
      domain,
      gcpProject,
      gcpZone,
      instanceName,
      manageDirectDnsRecords,
      manageSlotOriginDnsRecord,
      manageZoneSettings,
    })

    return this.tfInit(src, this.resolveGcpCredentials(gcpCredentials), token, pubKey, config)
      .withEnvVariable("DAGGER_TERRAFORM_DESTROY_NONCE", new Date().toISOString())
      .withExec(["terraform", "destroy", "-auto-approve", ...this.tfVars(config)])
      .stdout()
  }

  /**
   * verify — non-mutating. Runs external smoke checks against the live domain.
   */
  @func()
  async verify(domain = "tidelands.dev"): Promise<string> {
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

run_check "null-hype HTTPS 200" \\
  "curl -sS --max-time 20 -o /dev/null -w '%{http_code}' https://null-hype.$DOMAIN/" \\
  "200"

run_check "admin health HTTPS 200" \\
  "curl -sS --max-time 20 -o /dev/null -w '%{http_code}' https://admin.$DOMAIN/healthz" \\
  "200"

run_check "admin CORS preflight" \\
  "curl -sS --max-time 20 -X OPTIONS -I https://admin.$DOMAIN/api/goose-sessions -H 'Origin: https://null-hype.$DOMAIN' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type'" \\
  "access-control-allow-origin"

run_check "Cloudflare proxy header" \\
  "curl -sS --max-time 20 -I https://null-hype.$DOMAIN/" \\
  "cf-ray"

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
   * check — ephemeral infrastructure test path. Terratest handles create/destroy.
   */
  @func()
  async check(
    @argument({ defaultPath: "." }) src: Directory,
    cloudflareToken?: Secret,
    sshPublicKey?: Secret,
    backendBucket = process.env.BACKEND_BUCKET ?? "",
    gcpProject = process.env.GCP_PROJECT ?? "",
    cloudflareZoneId = process.env.CLOUDFLARE_ZONE_ID ?? "",
    backendPrefixRoot = process.env.BACKEND_PREFIX_ROOT ?? "tidelands-test",
    preserveOnFailure = false,
    gcpCredentials?: Secret,
  ): Promise<string> {
    const token = cloudflareToken ?? this.resolveSecret("CLOUDFLARE_API_TOKEN", "cloudflare-token")
    const pubKey = sshPublicKey ?? this.resolveSecret("SSH_PUBLIC_KEY", "ssh-public-key")
    const resolvedGcpCredentials = this.resolveGcpCredentials(gcpCredentials)
    let ctr = dag.container()
      .from("golang:1.22-bookworm")
      .withDirectory("/workspace", src)
      .withSecretVariable("CLOUDFLARE_API_TOKEN", token)
      .withSecretVariable("TF_VAR_cloudflare_api_token", token)
      .withSecretVariable("TF_VAR_ssh_public_key", pubKey)

    if (resolvedGcpCredentials !== null) {
      ctr = ctr.withSecretVariable("GOOGLE_CREDENTIALS", resolvedGcpCredentials)
    } else {
      ctr = ctr.withMountedDirectory(
        "/root/.config/gcloud",
        dag.host().directory(`${process.env.HOME}/.config/gcloud`),
      )
    }

    return ctr
      .withEnvVariable("BACKEND_BUCKET", backendBucket)
      .withEnvVariable("BACKEND_PREFIX_ROOT", backendPrefixRoot)
      .withEnvVariable("GCP_PROJECT", gcpProject)
      .withEnvVariable("CLOUDFLARE_ZONE_ID", cloudflareZoneId)
      .withEnvVariable("PRESERVE_ON_FAILURE", preserveOnFailure ? "1" : "0")
      .withWorkdir("/workspace/test")
      .withExec([
        "bash", "-lc",
        [
          "set -euo pipefail",
          "apt-get update",
          "apt-get install -y --no-install-recommends ca-certificates curl unzip",
          "curl -fsSLo /tmp/terraform.zip https://releases.hashicorp.com/terraform/1.7.5/terraform_1.7.5_linux_amd64.zip",
          "unzip -q /tmp/terraform.zip -d /tmp/terraform-bin",
          "install -m 0755 /tmp/terraform-bin/terraform /usr/local/bin/terraform",
          "ln -sf /usr/local/bin/terraform /usr/local/bin/tofu",
          "terraform version",
        ].join(" && "),
      ])
      .withExec(["go", "test", "-v", "-timeout", "30m", "./..."])
      .stdout()
  }

  /**
   * moduleCheck — preview-safe Dagger module build and smoke test.
   */
  @func()
  async moduleCheck(src: Directory): Promise<string> {
    return dag.container()
      .from("node:22-bookworm")
      .withDirectory("/workspace", src)
      .withWorkdir("/workspace")
      .withExec(["npm", "ci"])
      .withExec(["npm", "run", "build"])
      .withExec(["node", "--test", "module.smoke.test.mjs"])
      .stdout()
  }

  /**
   * smallwebBundle — creates a deployable bundle from Smallweb root + Astro dist.
   */
  @func()
  async smallwebBundle(
    @argument({ defaultPath: "../.smallweb-root", ignore: [".vscode/"] }) smallwebRoot: Directory,
    @argument({ defaultPath: "../dist" }) dist: Directory,
    adminAuthorizedEmails = "",
  ): Promise<Directory> {
    return dag.directory()
      .withDirectory(".smallweb-root", await this.renderSmallwebRoot(smallwebRoot, adminAuthorizedEmails))
      .withDirectory("dist", dist)
  }

  private buildAstroDist(repo: Directory, publicGooseSessionApiUrl: string): Directory {
    return dag.container()
      .from("node:22-bookworm")
      .withDirectory("/workspace", repo)
      .withWorkdir("/workspace")
      .withEnvVariable("PUBLIC_GOOSE_SESSION_API_URL", publicGooseSessionApiUrl)
      .withExec(["npm", "ci"])
      .withExec(["npm", "run", "build"])
      .directory("/workspace/dist")
  }

  private async deployRuntime(
    bundle: Directory,
    bootstrapFile: File,
    host: string,
    domain: string,
    sshPrivateKey: Secret,
    cloudflareToken: Secret,
    openrouterApiKey: Secret,
  ): Promise<string> {
    const sshFlags = "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 -i /root/.ssh/id_ed25519"
    const target = `smallweb@${host}`
    const remoteRoot = "/home/smallweb/tidelands"
    const runtimeNonce = new Date().toISOString()

    return dag.container()
      .from("alpine:3.20")
      .withExec(["apk", "add", "--no-cache", "bash", "curl", "jq", "openssh-client", "openssl", "tar"])
      .withMountedSecret("/run/secrets/id_ed25519", sshPrivateKey)
      .withSecretVariable("CLOUDFLARE_API_TOKEN", cloudflareToken)
      .withSecretVariable("OPENROUTER_API_KEY", openrouterApiKey)
      .withEnvVariable("DAGGER_RUNTIME_DEPLOY_NONCE", runtimeNonce)
      .withDirectory("/bundle", bundle)
      .withMountedFile("/bootstrap.sh", bootstrapFile)
      .withNewFile("/configure-runtime.sh", this.remoteRuntimeScript(domain, remoteRoot), { permissions: 0o755 })
      .withExec(["sh", "-c", "mkdir -p /root/.ssh && cp /run/secrets/id_ed25519 /root/.ssh/id_ed25519 && chmod 600 /root/.ssh/id_ed25519"])
      .withExec([
        "sh", "-c",
        `for i in $(seq 1 24); do
           ssh ${sshFlags} ${target} echo ready && break
           echo "waiting for SSH ($i/24)..." && sleep 5
           [ $i -eq 24 ] && echo "SSH timed out" && exit 1
         done`,
      ])
      .withExec(["scp", ...sshFlags.split(" "), "/bootstrap.sh", `${target}:/tmp/bootstrap.sh`])
      .withExec(["ssh", ...sshFlags.split(" "), target, `bash /tmp/bootstrap.sh ${domain}`])
      .withExec(["tar", "-C", "/bundle", "-czf", "/tmp/tidelands-bundle.tgz", "."])
      .withExec(["ssh", ...sshFlags.split(" "), target, `mkdir -p ${remoteRoot}`])
      .withExec(["scp", ...sshFlags.split(" "), "/tmp/tidelands-bundle.tgz", `${target}:/tmp/tidelands-bundle.tgz`])
      .withExec(["ssh", ...sshFlags.split(" "), target, `tar -xzf /tmp/tidelands-bundle.tgz -C ${remoteRoot}`])
      .withExec(["scp", ...sshFlags.split(" "), "/configure-runtime.sh", `${target}:/tmp/configure-runtime.sh`])
      .withExec([
        "bash", "-lc",
        `ssh ${sshFlags} ${target} "CLOUDFLARE_API_TOKEN=$(printf %q "$CLOUDFLARE_API_TOKEN") OPENROUTER_API_KEY=$(printf %q "$OPENROUTER_API_KEY") bash /tmp/configure-runtime.sh"`,
      ])
      .stdout()
  }

  private remoteRuntimeScript(domain: string, remoteRoot: string): string {
    return `#!/usr/bin/env bash
set -euo pipefail

DOMAIN=${JSON.stringify(domain)}
REMOTE_ROOT=${JSON.stringify(remoteRoot)}
SMALLWEB_ROOT="$REMOTE_ROOT/.smallweb-root"
CERT_WORK="$HOME/.config/tidelands"
CERT_DIR="/etc/caddy/certs"
ADMIN_ENV="$SMALLWEB_ROOT/admin/.env"

test -d "$SMALLWEB_ROOT"
test -n "$OPENROUTER_API_KEY"
test -n "$CLOUDFLARE_API_TOKEN"

mkdir -p "$CERT_WORK"

if [[ ! -s "$CERT_WORK/origin.crt" || ! -s "$CERT_WORK/origin.key" ]]; then
  rm -f "$CERT_WORK/origin.crt" "$CERT_WORK/origin.key" "$CERT_WORK/origin.csr"
  openssl req -new -newkey rsa:2048 -nodes \\
    -keyout "$CERT_WORK/origin.key" \\
    -out "$CERT_WORK/origin.csr" \\
    -subj "/CN=$DOMAIN" \\
    -addext "subjectAltName=DNS:$DOMAIN,DNS:*.$DOMAIN"

  cert_response="$(jq -n \\
    --rawfile csr "$CERT_WORK/origin.csr" \\
    --arg domain "$DOMAIN" \\
    '{hostnames: [$domain, ("*." + $domain)], request_type: "origin-rsa", requested_validity: 5475, csr: $csr}' \\
    | curl -fsS https://api.cloudflare.com/client/v4/certificates \\
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \\
      -H "Content-Type: application/json" \\
      --data @- || true)"

  if echo "$cert_response" | jq -e '.success == true' >/dev/null 2>&1; then
    echo "$cert_response" | jq -r '.result.certificate' > "$CERT_WORK/origin.crt"
  else
    echo "[runtime] Cloudflare Origin CA request failed; using self-signed origin certificate"
    openssl req -x509 -newkey rsa:2048 -nodes -days 365 \\
      -keyout "$CERT_WORK/origin.key" \\
      -out "$CERT_WORK/origin.crt" \\
      -subj "/CN=$DOMAIN" \\
      -addext "subjectAltName=DNS:$DOMAIN,DNS:*.$DOMAIN"
  fi
fi

sudo install -d -m 0755 "$CERT_DIR"
sudo install -m 0644 "$CERT_WORK/origin.crt" "$CERT_DIR/origin.crt"
sudo install -m 0600 "$CERT_WORK/origin.key" "$CERT_DIR/origin.key"
if id caddy >/dev/null 2>&1; then
  sudo chown caddy:caddy "$CERT_DIR/origin.key"
fi

cat > "$ADMIN_ENV" <<EOF
OPENROUTER_API_KEY=$OPENROUTER_API_KEY
GOOSE_PROVIDER=openrouter
GOOSE_MODEL=google/gemini-2.5-flash
GOOSE_MAX_TOKENS=4096
ADMIN_GOOSE_COMMAND=$HOME/.local/bin/goose
ADMIN_GOOSE_ARGS=acp
ADMIN_GOOSE_SESSION_CWD=$REMOTE_ROOT
ADMIN_GOOSE_IDLE_TIMEOUT_MS=30000
ADMIN_GOOSE_HOME=$HOME/.config/goose
ADMIN_GOOSE_XDG_CONFIG_HOME=$HOME/.config/goose
ADMIN_GOOSE_XDG_STATE_HOME=$HOME/.local/state/goose
ADMIN_GOOSE_XDG_CACHE_HOME=$HOME/.cache/goose
EOF
chmod 0600 "$ADMIN_ENV"

mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/smallweb.service" <<EOF
[Unit]
Description=Smallweb
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=$HOME/.local/bin/smallweb up --addr 127.0.0.1:7777 --dir $SMALLWEB_ROOT --domain $DOMAIN
Restart=on-failure
RestartSec=5
Environment=PATH=$HOME/.deno/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin
Environment=DENO_DIR=$HOME/.cache/deno

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now smallweb
systemctl --user restart smallweb

sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
$DOMAIN, *.$DOMAIN {
  tls $CERT_DIR/origin.crt $CERT_DIR/origin.key

  @websocket header Upgrade websocket
  reverse_proxy @websocket 127.0.0.1:7777 {
    header_up Origin https://{http.request.host}
  }

  reverse_proxy 127.0.0.1:7777
}
EOF

sudo systemctl enable --now caddy
sudo systemctl restart caddy

sleep 2
curl -fsS -H "Host: admin.$DOMAIN" http://127.0.0.1:7777/healthz >/dev/null
sudo systemctl --no-pager --plain status caddy | sed -n '1,20p'
systemctl --user --no-pager --plain status smallweb | sed -n '1,20p'
`
  }

  private tfInit(
    src: Directory,
    gcpCredentials: Secret | null,
    cloudflareToken: Secret,
    sshPublicKey: Secret,
    config: DeploymentConfig,
  ): Container {
    let ctr = dag.container()
      .from("hashicorp/terraform:1.7")
      .withDirectory("/workspace", src)
      .withSecretVariable("CLOUDFLARE_API_TOKEN", cloudflareToken)
      .withSecretVariable("TF_VAR_cloudflare_api_token", cloudflareToken)
      .withSecretVariable("TF_VAR_ssh_public_key", sshPublicKey)

    if (gcpCredentials !== null) {
      ctr = ctr.withSecretVariable("GOOGLE_CREDENTIALS", gcpCredentials)
    } else {
      ctr = ctr.withMountedDirectory(
        "/root/.config/gcloud",
        dag.host().directory(`${process.env.HOME}/.config/gcloud`),
      )
    }

    return ctr
      .withWorkdir("/workspace/terraform")
      .withExec([
        "terraform", "init", "-reconfigure",
        `-backend-config=bucket=${config.backendBucket}`,
        `-backend-config=prefix=${config.backendPrefix}`,
      ])
  }

  private tfVars(config: DeploymentConfig): string[] {
    return [
      `-var=gcp_project_id=${config.gcpProject}`,
      `-var=gcp_zone=${config.gcpZone}`,
      `-var=domain=${config.domain}`,
      `-var=cloudflare_zone_id=${config.cloudflareZoneId}`,
      `-var=instance_name=${config.instanceName}`,
      `-var=deployment_slot=${config.deploymentSlot}`,
      `-var=manage_direct_dns_records=${config.manageDirectDnsRecords}`,
      `-var=manage_slot_origin_dns_record=${config.manageSlotOriginDnsRecord}`,
      `-var=manage_zone_settings=${config.manageZoneSettings}`,
    ]
  }

  private deploymentConfig(input: DeploymentConfig): DeploymentConfig {
    return {
      ...input,
      backendPrefix: input.backendPrefix.replaceAll("{slot}", input.deploymentSlot),
    }
  }

  private resolveSecret(envVar: string, name: string): Secret {
    const val = process.env[envVar]
    if (!val?.trim()) throw new Error(`${envVar} environment variable is not set`)
    return dag.setSecret(name, val)
  }

  private resolveGcpCredentials(gcpCredentials?: Secret): Secret | null {
    if (gcpCredentials) {
      return gcpCredentials
    }

    const envCredentials = process.env.GCP_CREDENTIALS_JSON
    if (envCredentials && envCredentials.trim() !== "") {
      return dag.setSecret("gcp-credentials", envCredentials)
    }

    return null
  }

  private async renderSmallwebRoot(smallwebRoot: Directory, adminAuthorizedEmails: string): Promise<Directory> {
    const config = JSON.parse(await smallwebRoot.file(".smallweb/config.json").contents()) as SmallwebRootConfig
    const authorizedEmails = this.parseAdminAuthorizedEmails(adminAuthorizedEmails)

    if (authorizedEmails.length > 0) {
      const adminApp = config.apps?.admin ?? {}
      config.apps = {
        ...(config.apps ?? {}),
        admin: {
          ...adminApp,
          authorizedEmails,
        },
      }
    }

    return smallwebRoot.withNewFile(".smallweb/config.json", `${JSON.stringify(config, null, 2)}\n`)
  }

  private parseAdminAuthorizedEmails(value: string): string[] {
    return value
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter((entry) => entry !== "")
  }
}
