import { connection, dag } from "./sdk/index.ts"

const appCacheDir = `${Deno.cwd()}/data/.cache`
const sidecarUrl = Deno.env.get("DAGGER_VERIFY_SIDECAR_URL") ?? "http://127.0.0.1:7788/verify"

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  })
}

async function runEmbeddedProbe() {
  const startedAt = new Date().toISOString()
  let engineVersion = ""
  let output = ""

  Deno.env.set("XDG_CACHE_HOME", appCacheDir)
  Deno.env.set("DAGGER_NO_NAG", "1")
  await Deno.mkdir(`${appCacheDir}/dagger`, { recursive: true })

  await connection(async () => {
    engineVersion = await dag.version()
    output = await dag
      .container()
      .from("alpine:3.20")
      .withExec(["sh", "-lc", "echo smallweb-dagger-ok"])
      .stdout()
  })

  return {
    ok: true,
    via: "smallweb-embedded",
    startedAt,
    engineVersion,
    output: output.trim(),
    deno: Deno.version.deno,
    cacheDir: appCacheDir,
  }
}

async function runSidecarProbe() {
  const response = await fetch(sidecarUrl, {
    headers: {
      "x-smallweb-app": "dagger-verify",
    },
  })

  const contentType = response.headers.get("content-type") ?? ""
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    return {
      ok: false,
      via: "smallweb-sidecar",
      sidecarUrl,
      sidecarStatus: response.status,
      sidecar: payload,
    }
  }

  return {
    ok: true,
    via: "smallweb-sidecar",
    sidecarUrl,
    sidecar: payload,
  }
}

export default {
  fetch: async (req: Request) => {
    const url = new URL(req.url)

    if (url.pathname === "/healthz") {
      return json({
        ok: true,
        app: "dagger-verify",
      })
    }

    if (url.pathname !== "/verify" && url.pathname !== "/verify-sidecar" && url.pathname !== "/verify-embedded") {
      return json({
        ok: true,
        app: "dagger-verify",
        routes: ["/healthz", "/verify", "/verify-sidecar", "/verify-embedded"],
      })
    }

    try {
      if (url.pathname === "/verify-embedded") {
        return json(await runEmbeddedProbe())
      }

      const result = await runSidecarProbe()
      return json(result, result.ok ? 200 : 502)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : null

      return json({
        ok: false,
        via: "smallweb",
        message,
        stack,
      }, 500)
    }
  },
}
