#!/usr/bin/env bash
# bootstrap-prereqs.sh — idempotent prerequisite creation for tidelane-infra.
# Run inside a gcloud+openssh container by the Dagger bootstrap() function.
# Writes outputs to /output/: deploy-key.json, tidelane, tidelane.pub, zone-id.txt
set -euo pipefail

: "${GCP_PROJECT:?GCP_PROJECT is required}"
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"
: "${DOMAIN:?DOMAIN is required}"
GCP_REGION="${GCP_REGION:-us-central1}"
SA_NAME="${SA_NAME:-tidelane-deploy}"
SA_EMAIL="${SA_NAME}@${GCP_PROJECT}.iam.gserviceaccount.com"
BACKEND_BUCKET="${BACKEND_BUCKET:-${GCP_PROJECT}-tidelane-state}"
OUTPUT_DIR="/output"
KEY_OUT="${OUTPUT_DIR}/deploy-key.json"
SSH_KEY_OUT="${OUTPUT_DIR}/tidelane"

mkdir -p "$OUTPUT_DIR"

fail() {
  echo "[bootstrap] FAIL: $1"
  shift
  for line in "$@"; do echo "  $line"; done
  exit 1
}

step() { echo "[bootstrap] $*"; }

# ── Step 1: Verify auth ────────────────────────────────────────────────────
step "verifying GCP auth context"
IDENTITY=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -1)
[ -n "$IDENTITY" ] || fail \
  "no active GCP auth context" \
  "Fix: run 'gcloud auth login' on the host, or provide --gcp-credentials"
step "authenticated as: $IDENTITY"

# ── Step 2: Create service account ────────────────────────────────────────
step "ensuring deploy service account: $SA_EMAIL"
if gcloud iam service-accounts describe "$SA_EMAIL" --project="$GCP_PROJECT" &>/dev/null; then
  step "service account already exists"
else
  gcloud iam service-accounts create "$SA_NAME" \
    --project="$GCP_PROJECT" \
    --display-name="tidelane deploy account" 2>&1 || fail \
    "cannot create service account '$SA_EMAIL'" \
    "Ensure the active identity has roles/iam.serviceAccountAdmin on project $GCP_PROJECT" \
    "Fix: gcloud projects add-iam-policy-binding $GCP_PROJECT \\" \
    "       --member=user:$IDENTITY --role=roles/iam.serviceAccountAdmin"
  step "created service account: $SA_EMAIL"
fi

# ── Step 3: Apply IAM bindings ────────────────────────────────────────────
step "applying IAM bindings to $SA_EMAIL"
ROLES=(
  "roles/compute.instanceAdmin.v1"
  "roles/compute.securityAdmin"
  "roles/storage.objectAdmin"
)
for ROLE in "${ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "$GCP_PROJECT" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="$ROLE" \
    --condition=None \
    --quiet 2>&1 || fail \
    "cannot bind $ROLE to $SA_EMAIL" \
    "Ensure the active identity has roles/resourcemanager.projectIamAdmin" \
    "Fix: gcloud projects add-iam-policy-binding $GCP_PROJECT \\" \
    "       --member=user:$IDENTITY --role=roles/resourcemanager.projectIamAdmin"
  step "bound $ROLE"
done

# ── Step 4: Create GCS state bucket ───────────────────────────────────────
step "ensuring GCS state bucket: gs://$BACKEND_BUCKET"
if gsutil ls -b "gs://$BACKEND_BUCKET" &>/dev/null; then
  step "bucket already exists"
else
  gsutil mb -l "$GCP_REGION" "gs://$BACKEND_BUCKET" 2>&1 || fail \
    "cannot create bucket gs://$BACKEND_BUCKET" \
    "Ensure the active identity has roles/storage.admin" \
    "Fix: gcloud projects add-iam-policy-binding $GCP_PROJECT \\" \
    "       --member=user:$IDENTITY --role=roles/storage.admin"
  gsutil versioning set on "gs://$BACKEND_BUCKET"
  step "created and versioned bucket: gs://$BACKEND_BUCKET"
fi

# ── Step 5: Mint deploy service account key ────────────────────────────────
step "minting deploy key"
if [ -f "$KEY_OUT" ]; then
  step "deploy key already present at $KEY_OUT"
else
  gcloud iam service-accounts keys create "$KEY_OUT" \
    --iam-account="$SA_EMAIL" \
    --project="$GCP_PROJECT" 2>&1 || fail \
    "cannot mint service account key for $SA_EMAIL" \
    "Ensure the active identity has roles/iam.serviceAccountKeyAdmin"
  chmod 600 "$KEY_OUT"
  step "wrote deploy key: $KEY_OUT"
fi

# ── Step 6: Validate Cloudflare token and resolve zone ID ─────────────────
step "validating Cloudflare token"
CF_VERIFY=$(curl -sf \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/user/tokens/verify") || fail \
  "Cloudflare token verification request failed (network or auth error)" \
  "Ensure the token has Zone/DNS/Edit and Zone/Zone Settings/Edit permissions"
echo "$CF_VERIFY" | grep -q '"success":true' || fail \
  "Cloudflare token is invalid or expired" \
  "Response: $CF_VERIFY"
step "Cloudflare token valid"

step "resolving Cloudflare zone ID for $DOMAIN"
CF_ZONES=$(curl -sf \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones?name=${DOMAIN}&status=active")
ZONE_ID=$(echo "$CF_ZONES" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$ZONE_ID" ] || fail \
  "could not resolve Cloudflare zone ID for domain: $DOMAIN" \
  "Ensure $DOMAIN is an active zone in your Cloudflare account" \
  "Dashboard: https://dash.cloudflare.com"
echo "$ZONE_ID" > "${OUTPUT_DIR}/zone-id.txt"
step "zone ID for $DOMAIN: $ZONE_ID"

# ── Step 7: Generate SSH keypair ───────────────────────────────────────────
step "ensuring SSH keypair"
if [ -f "$SSH_KEY_OUT" ]; then
  step "SSH keypair already present at $SSH_KEY_OUT"
else
  ssh-keygen -t ed25519 -f "$SSH_KEY_OUT" -C "tidelane-smallweb" -N ""
  step "wrote SSH keypair: $SSH_KEY_OUT / ${SSH_KEY_OUT}.pub"
fi

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "[bootstrap] ✓ complete"
echo "  Deploy SA:      $SA_EMAIL"
echo "  State bucket:   gs://$BACKEND_BUCKET  (prefix: tidelands-dev/terraform.tfstate)"
echo "  Deploy key:     $KEY_OUT"
echo "  Zone ID:        $ZONE_ID  ($DOMAIN)"
echo "  SSH key:        $SSH_KEY_OUT"
echo ""
echo "Next step:"
echo "  dagger call plan \\"
echo "    --src . \\"
echo "    --gcp-credentials file:infra/.deploy-key.json \\"
echo "    --cloudflare-token env:CLOUDFLARE_API_TOKEN \\"
echo "    --ssh-public-key file:infra/.tidelane.pub \\"
echo "    --backend-bucket $BACKEND_BUCKET \\"
echo "    --backend-prefix tidelands-dev/terraform.tfstate \\"
echo "    --gcp-project $GCP_PROJECT \\"
echo "    --cloudflare-zone-id $ZONE_ID"
