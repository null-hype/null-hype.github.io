// PLAN-189 probe: verify that Deno can load the existing Dagger TS SDK
// and complete a real engine-backed container operation.
import { connection, dag } from "@dagger.io/dagger"

const image = Deno.env.get("DAGGER_DENO_PROBE_IMAGE") ?? "alpine:3.20"

await connection(async () => {
  const engineVersion = await dag.version()
  const output = await dag
    .container()
    .from(image)
    .withExec(["sh", "-lc", "echo deno-dagger-runtime-ok"])
    .stdout()

  console.log(JSON.stringify({
    engineVersion,
    image,
    output: output.trim(),
  }, null, 2))
})
