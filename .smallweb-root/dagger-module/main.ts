const bridgeUrl = Deno.env.get("DAGGER_MCP_BRIDGE_URL") ?? "http://127.0.0.1:7790/mcp"

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  })
}

async function proxyToBridge(req: Request): Promise<Response> {
  const headers = new Headers(req.headers)
  headers.delete("content-length")

  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers,
    redirect: "manual",
  }

  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "DELETE") {
    init.body = req.body
    init.duplex = "half"
  }

  const upstream = await fetch(bridgeUrl, init)

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  })
}

export default {
  fetch: async (req: Request) => {
    const url = new URL(req.url)

    if (url.pathname === "/healthz") {
      return json({
        ok: true,
        app: "dagger-module",
        bridgeUrl,
      })
    }

    if (url.pathname === "/mcp") {
      return proxyToBridge(req)
    }

    return json({
      ok: true,
      app: "dagger-module",
      routes: ["/healthz", "/mcp"],
    })
  },
}
