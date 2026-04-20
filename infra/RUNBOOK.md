# tidelane-infra operator runbook

Covers the full operator workflow for provisioning, verifying, and recovering
the `tidelands.dev` smallweb instance. Written so another operator can run the
system without relying on chat history.

---

## Prerequisites

### One-time setup (before first deploy)

1. **GCS state bucket** — create the bucket that will hold Terraform state.
   Terraform cannot manage this bucket itself (chicken-and-egg).

   ```sh
   gsutil mb -l us-central1 gs://YOUR_STATE_BUCKET
   gsutil versioning set on gs://YOUR_STATE_BUCKET
   ```

2. **GCP service account** — create a service account with the following roles
   on the project:

   - `roles/compute.instanceAdmin.v1`
   - `roles/compute.securityAdmin` (firewall rules)
   - `roles/storage.objectAdmin` on the state bucket only

   Download the JSON key. This is `gcpCredentials`.

3. **Cloudflare API token** — create a token with:

   - Zone / DNS / Edit
   - Zone / Zone Settings / Edit

   Scope it to `tidelands.dev` only. This is `cloudflareToken`.

4. **SSH key pair** — generate a dedicated key for this instance:

   ```sh
   ssh-keygen -t ed25519 -f ~/.ssh/tidelane -C "tidelane-smallweb"
   ```

   `~/.ssh/tidelane.pub` → `sshPublicKey`
   `~/.ssh/tidelane`     → `sshPrivateKey`

5. **Dagger** — install from [dagger.io](https://dagger.io). No other local
   tooling is required.

---

## Secrets reference

All secrets enter the system as Dagger `Secret` values. The recommended pattern
is to read them from files at call time:

| Dagger arg        | What it is                          | Example source                   |
|-------------------|-------------------------------------|----------------------------------|
| `gcpCredentials`  | GCP service account JSON key        | `file:$HOME/.config/gcp/sa.json` |
| `cloudflareToken` | Cloudflare API token                | `env:CLOUDFLARE_API_TOKEN`       |
| `sshPublicKey`    | SSH public key string               | `file:$HOME/.ssh/tidelane.pub`   |
| `sshPrivateKey`   | SSH private key                     | `file:$HOME/.ssh/tidelane`       |

Non-secret config passed as plain args:

| Arg               | Example value                             |
|-------------------|-------------------------------------------|
| `backendBucket`   | `my-tf-state-bucket`                      |
| `backendPrefix`   | `tidelands-dev/terraform.tfstate`         |
| `gcpProject`      | `my-gcp-project-id`                       |
| `cloudflareZoneId`| `abc123def456` (from Cloudflare dashboard)|
| `gcpZone`         | `us-central1-a` (default)                 |
| `domain`          | `tidelands.dev` (default)                 |
| `instanceName`    | `tidelane-smallweb` (default)             |

---

## Normal workflows

### Plan (non-mutating)

Preview what Terraform would change. Safe to run at any time.

```sh
dagger call plan \
  --src infra                                      \
  --gcp-credentials file:$HOME/.config/gcp/sa.json \
  --cloudflare-token env:CLOUDFLARE_API_TOKEN       \
  --ssh-public-key file:$HOME/.ssh/tidelane.pub     \
  --backend-bucket my-tf-state-bucket               \
  --backend-prefix 'tidelands-dev/{slot}/terraform.tfstate' \
  --gcp-project my-gcp-project-id                   \
  --cloudflare-zone-id abc123def456                 \
  --deployment-slot green                           \
  --manage-direct-dns-records=false
```

### Check (ephemeral, net non-mutating)

Runs the Terratest suite. Creates and destroys isolated `tidelane-test-<hex>`
resources. Never touches production state.

```sh
dagger call check \
  --src infra                                      \
  --gcp-credentials file:$HOME/.config/gcp/sa.json \
  --cloudflare-token env:CLOUDFLARE_API_TOKEN       \
  --ssh-public-key file:$HOME/.ssh/tidelane.pub     \
  --backend-bucket my-tf-state-bucket               \
  --gcp-project my-gcp-project-id                   \
  --cloudflare-zone-id abc123def456
```

To preserve test resources on failure (for debugging):

```sh
dagger call check ... --preserve-on-failure true
```

The failed test output will print the instance name and the manual destroy
command.

### Deploy (production-mutating)

Provisions infrastructure and bootstraps smallweb. Runs `terraform apply` then
SSHs into the instance.

```sh
dagger call deploy \
  --src infra                                      \
  --gcp-credentials file:$HOME/.config/gcp/sa.json \
  --cloudflare-token env:CLOUDFLARE_API_TOKEN       \
  --ssh-public-key file:$HOME/.ssh/tidelane.pub     \
  --ssh-private-key file:$HOME/.ssh/tidelane         \
  --openrouter-api-key env:OPENROUTER_API_KEY       \
  --backend-bucket my-tf-state-bucket               \
  --backend-prefix 'tidelands-dev/{slot}/terraform.tfstate' \
  --gcp-project my-gcp-project-id                   \
  --cloudflare-zone-id abc123def456                 \
  --deployment-slot green                           \
  --manage-direct-dns-records=false
```

Outputs JSON from `terraform output` on success, then builds the Astro site,
uploads the Smallweb bundle, configures Goose, and starts Smallweb behind Caddy.
Use `--manage-direct-dns-records=true` only for the slot that should receive
live Cloudflare apex/wildcard traffic.

### Verify (non-mutating)

Runs four external smoke checks against the live domain. Run this after deploy.

```sh
dagger call verify --domain tidelands.dev
```

Expected output:

```
[PASS] null-hype HTTPS 200
[PASS] admin health HTTPS 200
[PASS] admin CORS preflight
[PASS] Cloudflare proxy header

Results: 4 passed, 0 failed
```

### Destroy (production-mutating)

Tears down all Terraform-managed resources including the instance, firewall
rules, and Cloudflare DNS records.

```sh
dagger call destroy \
  --src infra                                      \
  --gcp-credentials file:$HOME/.config/gcp/sa.json \
  --cloudflare-token env:CLOUDFLARE_API_TOKEN       \
  --ssh-public-key file:$HOME/.ssh/tidelane.pub     \
  --backend-bucket my-tf-state-bucket               \
  --backend-prefix 'tidelands-dev/{slot}/terraform.tfstate' \
  --gcp-project my-gcp-project-id                   \
  --cloudflare-zone-id abc123def456                 \
  --deployment-slot green                           \
  --manage-direct-dns-records=false
```

---

## Interpreting outputs

### `terraform output -json` shape

```json
{
  "instance_name":      { "value": "tidelane-smallweb" },
  "instance_ipv4":      { "value": "34.x.x.x" },
  "instance_zone":      { "value": "us-central1-a" },
  "instance_self_link": { "value": "https://www.googleapis.com/compute/v1/projects/..." },
  "ssh_user":           { "value": "smallweb" },
  "ssh_connection":     { "value": "smallweb@34.x.x.x" }
}
```

`ssh_connection` is the value to use for manual SSH access if needed:

```sh
ssh -i ~/.ssh/tidelane smallweb@34.x.x.x
```

---

## Failure modes and recovery

### SSH timeout during bootstrap

The bootstrap step retries for 90 seconds (18 × 5s). If it times out:

1. Check the firewall rule allows port 22 from the Dagger runner's egress IP.
2. Confirm the SSH public key was injected (`terraform output` first, then
   check the GCE instance metadata in the console).
3. Re-run `deploy` — Terraform apply is idempotent; bootstrap is also idempotent.

### `terraform apply` fails mid-run

Terraform state may be partially written. Run `plan` to see what remains, then
re-run `deploy`. Do not run `destroy` unless you intend to recreate from scratch.

### DNS not resolving after deploy

Cloudflare propagation is fast but not instant. Wait 30–60 seconds, then run
`verify`. If it still fails, check the zone ID is correct and the API token has
DNS edit permission on `tidelands.dev`.

### Instance recreated — IPs changed

Re-running `deploy` updates Cloudflare DNS records automatically (Terraform
manages the records and references the live instance IP). No manual dashboard
work needed.

### smallweb service not running after bootstrap

SSH into the instance and check:

```sh
ssh -i ~/.ssh/tidelane smallweb@<instance_ipv4>
systemctl --user status smallweb
journalctl --user -u smallweb -n 50
```

Re-run bootstrap manually if needed:

```sh
bash /tmp/bootstrap.sh tidelands.dev
```

---

## Rotating secrets

### SSH key rotation

1. Generate a new key pair.
2. Run `deploy` with the new `--ssh-public-key`. Terraform updates instance
   metadata. Old key is replaced on next apply.
3. Update your local SSH config to use the new private key.

### Cloudflare token rotation

Replace `env:CLOUDFLARE_API_TOKEN` with the new token value. No infrastructure
changes needed.

### GCP service account key rotation

Replace the JSON key file. No infrastructure changes needed.
