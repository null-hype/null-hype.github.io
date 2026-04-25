/**
 * Dagger Runbook
 * 
 * A zx-style task runner for tidelane infrastructure.
 * Uses dax (Deno's zx alternative) to bridge pass-cli and dagger.
 * 
 * Usage:
 *   deno run -A infra/runbook.ts [plan|deploy|outputs|destroy|verify]
 */

import $ from "https://deno.land/x/dax@0.39.2/mod.ts";

const MOD = "infra/";
const ENV_FILE = "infra/.env";

// Canonical secret/config mapping from environment variables
const flags = [
  "--cloudflare-token=env:CLOUDFLARE_API_TOKEN",
  "--ssh-private-key=env:SSH_PRIVATE_KEY",
  "--ssh-public-key=env:SSH_PUBLIC_KEY",
  "--openrouter-api-key=env:OPENROUTER_API_KEY",
  "--gcp-credentials=env:GCP_CREDENTIALS_JSON",
  // Map non-secret config from env for clarity/masking
  "--backend-bucket=env:BACKEND_BUCKET",
  "--backend-prefix=env:BACKEND_PREFIX",
  "--gcp-project=env:GCP_PROJECT",
  "--cloudflare-zone-id=env:CLOUDFLARE_ZONE_ID",
  "--deployment-slot=env:DEPLOYMENT_SLOT",
  "--admin-authorized-emails=env:ADMIN_AUTHORIZED_EMAILS",
];

/**
 * Execute a dagger command wrapped in pass-cli
 */
async function runDagger(cmd: string, extraArgs: string[] = []) {
  console.log(`\n🚀 Running ${cmd}...\n`);
  
  // pass-cli run handles environment injection from our .env file
  // dagger call then ingests those via the env: prefix
  await $`pass-cli run --env-file ${ENV_FILE} -- dagger -m ${MOD} call ${cmd} ${flags} ${extraArgs}`;
}

/**
 * Tasks
 */
export const plan = () => runDagger("plan");
export const deploy = () => runDagger("deploy");
export const outputs = () => runDagger("outputs");
export const destroy = () => runDagger("destroy");
export const verify = (domain?: string) => runDagger("verify", domain ? [`--domain=${domain}`] : []);

/**
 * CLI Entrypoint
 */
if (import.meta.main) {
  const [task, ...rest] = Deno.args;
  
  const tasks: Record<string, () => Promise<void>> = {
    plan,
    deploy,
    outputs,
    destroy,
    verify: () => verify(rest[0]),
  };

  if (task && tasks[task]) {
    await tasks[task]();
  } else {
    console.log("Usage: deno run -A infra/runbook.ts <task>");
    console.log("\nAvailable tasks:");
    Object.keys(tasks).forEach(t => console.log(`  - ${t}`));
    Deno.exit(1);
  }
}
