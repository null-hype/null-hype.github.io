/**
 * Dagger Runbook
 *
 * A zx-style task runner for tidelane infrastructure.
 * Delegates secret resolution + Dagger invocation to infra/scripts/dagger.sh.
 *
 * Usage:
 *   deno run -A infra/runbook.ts [plan|deploy|outputs|destroy|verify]
 */

import $ from "https://deno.land/x/dax@0.39.2/mod.ts";

const WRAPPER = "./infra/scripts/dagger.sh";

/**
 * Execute a Dagger command through the Proton Pass wrapper.
 */
async function runDagger(cmd: string, extraArgs: string[] = []) {
  console.log(`\n🚀 Running ${cmd}...\n`);

  await $`${WRAPPER} ${cmd} ${extraArgs}`;
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
