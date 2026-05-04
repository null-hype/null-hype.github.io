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

## Secrets management with Proton Pass

Secrets are stored in a Proton Pass vault. `infra/.env` contains only vault
references — no plaintext values — and is safe to commit.

### One-time vault setup

Create a vault named **Tidelane** (or any name; update the references in
`infra/.env` to match). Add the following items:

| Item title            | Field name        | Contents                                   |
|-----------------------|-------------------|--------------------------------------------|
| `Cloudflare`          | `api_token`       | Cloudflare API token                       |
| `SSH-tidelane`        | `public_key`      | Full contents of `~/.ssh/tidelane.pub`     |
| `SSH-tidelane`        | `private_key`     | Full contents of `~/.ssh/tidelane`         |
| `GCP-service-account` | `credential_file` | Full contents of the GCP service account JSON file |
| `OpenRouter`          | `api_key`         | OpenRouter API key                         |

`SSH_PUBLIC_KEY` and `SSH_PRIVATE_KEY` store key **content** (full text of the
key file), not file paths.

### Configure `infra/.env`

`infra/.env` holds vault references for all secrets plus plaintext values for
non-secret config. Edit the non-secret section directly:

```sh
BACKEND_BUCKET=my-tf-state-bucket
BACKEND_PREFIX=tidelands-dev/{slot}/terraform.tfstate
GCP_PROJECT=my-gcp-project-id
CLOUDFLARE_ZONE_ID=abc123def456
DEPLOYMENT_SLOT=green
```

Verify it is not swept up by the root `.gitignore`:

```sh
git check-ignore -v infra/.env
```

It should print nothing (not ignored). If it does match, the `!infra/.env`
negation in `.gitignore` should fix it.

### Running dagger via Proton Pass CLI

The Dagger module reads all secrets and config from environment variables when
they are not passed explicitly. `pass-cli run` resolves the vault references
in `infra/.env` and injects them before dagger starts.

Before first use, install and authenticate the CLI once:

```sh
curl -fsSL https://proton.me/download/pass-cli/install.sh | bash
pass-cli login
```

If `pass-cli` prints an error like `there is no session` or `This operation
requires an authenticated client`, your Proton Pass login session has expired
or is missing. Re-run `pass-cli login` before invoking the wrapper.

The repo includes a wrapper that maps the resolved env vars into the module's
explicit Dagger args:

```sh
./infra/scripts/dagger.sh plan
./infra/scripts/dagger.sh deploy
./infra/scripts/dagger.sh outputs
./infra/scripts/dagger.sh destroy
./infra/scripts/dagger.sh verify --domain tidelands.dev
```

### Running dagger with a Proton Pass PAT

The module also supports a wrapper-free path where Dagger receives a single
Proton Pass PAT and resolves the required `pass://...` references from
`infra/.env` itself.

Create a PAT, grant it access to the `tidelands.dev` vault, then run:

```sh
dagger call -m infra/ plan --proton-pass-pat env:PROTON_PASS_PAT
dagger call -m infra/ deploy --proton-pass-pat env:PROTON_PASS_PAT
```

This path still reads non-secret config like `BACKEND_BUCKET`,
`BACKEND_PREFIX`, `GCP_PROJECT`, `CLOUDFLARE_ZONE_ID`, and `DEPLOYMENT_SLOT`
from `infra/.env`, but the module resolves the secret references internally
via `pass-cli login --pat`.

**Interactive session (enter once, call any function):**

```sh
pass-cli run --env-file infra/.env -- dagger -m infra/
```

**One-shot invocations:**

```sh
# Plan (non-mutating)
pass-cli run --env-file infra/.env -- dagger call -m infra/ plan

# Deploy (production-mutating)
pass-cli run --env-file infra/.env -- dagger call -m infra/ deploy

# Destroy (production-mutating) — run with care
pass-cli run --env-file infra/.env -- dagger call -m infra/ destroy

# Mutagen sync (local dev)
pass-cli run --env-file infra/.env -- ./infra/scripts/start-smallweb-mutagen-sync.sh
```

### Smoke-test vault resolution

Before running deploy for the first time, confirm `pass-cli` is resolving
secrets correctly:

```sh
pass-cli run --env-file infra/.env -- bash -c 'echo "CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN:0:6}..."'
```

If the SSH private key contains newlines and is being stripped by `pass-cli`,
store it base64-encoded in the vault and decode it before use.

### Rotating secrets

Update the item in the **Tidelane** vault. No changes to `infra/.env` are
needed — the reference stays the same, only the resolved value changes.

---

## Normal workflows

### Plan (non-mutating)

Preview what Terraform would change. Safe to run at any time.

With env loaded via `pass-cli run --env-file infra/.env` or `./infra/scripts/dagger.sh`:

```sh
dagger call -m infra/ plan
```

Or with explicit overrides (any arg can be passed to override the env default):

```sh
dagger call -m infra/ plan --deployment-slot green --manage-direct-dns-records=false
```

### Check (ephemeral, net non-mutating)

Runs the Terratest suite. Creates and destroys isolated `tidelane-test-<hex>`
resources. Never touches production state.

```sh
dagger call -m infra/ check
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
dagger call -m infra/ deploy
```

Pass `--manage-direct-dns-records=true` only for the slot that should receive
live Cloudflare apex/wildcard traffic:

Outputs JSON from `terraform output` on success, then builds the Astro site,
uploads the Smallweb bundle, configures Goose, and starts Smallweb behind Caddy.
Use `--manage-direct-dns-records=true` only for the slot that should receive
live Cloudflare apex/wildcard traffic.

### Consumer-friendly entrypoints

For use from another repository or as a toolchain, prefer the explicit
infrastructure and bundle lifecycle functions instead of the monorepo
convenience wrapper:

```sh
# Build a deployable bundle from an app repo plus a Smallweb root.
dagger call -m infra/ build-bundle \
  --repo ./path/to/app-repo \
  --smallweb-root ./path/to/.smallweb-root

# Apply infrastructure only and return Terraform outputs JSON.
dagger call -m infra/ apply \
  --src ./path/to/infra

# Assemble a bundle from already-built artifacts.
dagger call -m infra/ smallweb-bundle-from-artifacts \
  --smallweb-root ./path/to/.smallweb-root \
  --dist ./path/to/dist \
  --tutorial-dist ./path/to/tutorial-app/dist

# Upload a prebuilt bundle to an existing host and configure runtime.
dagger call -m infra/ deploy-bundle-to-host \
  --src ./path/to/infra \
  --bundle ./path/to/exported-bundle \
  --host 203.0.113.10

# Convenience composition: apply Terraform and deploy an already-built bundle.
dagger call -m infra/ deploy-bundle \
  --src ./path/to/infra \
  --bundle ./path/to/exported-bundle
```

`deploy` remains available, but it assumes this repository's sibling-path
layout for `repo`, `.smallweb-root`, and build outputs.

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
dagger call -m infra/ destroy
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
