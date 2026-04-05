import { randomUUID } from "node:crypto"
import { createServer } from "node:http"

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"

const port = Number.parseInt(process.env.PORT ?? "7790", 10)
const repoRoot = "/workspaces/null-hype.github.io"
const daggerBin = `${repoRoot}/.render/bin/dagger`
const moduleRef = `${repoRoot}/spikes/dagger-deno-upgrade`

const upstream = new Client(
  {
    name: "dagger-mcp-http-bridge-upstream",
    version: "0.0.1",
  },
  {
    capabilities: {},
  },
)

const upstreamTransport = new StdioClientTransport({
  command: daggerBin,
  args: ["mcp", "-s", "-m", moduleRef, "--stdio"],
  cwd: repoRoot,
  stderr: "pipe",
})

if (upstreamTransport.stderr) {
  upstreamTransport.stderr.on("data", (chunk) => {
    process.stderr.write(chunk)
  })
}

await upstream.connect(upstreamTransport)

function createBridgeSession() {
  const server = new Server(
    {
      name: "dagger-mcp-http-bridge",
      version: "0.0.1",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  )

  server.setRequestHandler(ListToolsRequestSchema, async (request, options) => {
    return upstream.listTools(request.params, options)
  })

  server.setRequestHandler(CallToolRequestSchema, async (request, options) => {
    return upstream.callTool(request.params, undefined, options)
  })

  let closing = false
  let sessionKey = ""
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true,
    onsessioninitialized: (sessionId) => {
      sessionKey = sessionId
      sessions.set(sessionId, { server, transport })
    },
  })

  transport.onclose = async () => {
    if (closing) {
      return
    }

    closing = true
    if (sessionKey) {
      sessions.delete(sessionKey)
    }
    await server.close()
  }

  return { server, transport }
}

async function readJsonBody(req) {
  if (req.method === "GET" || req.method === "DELETE") {
    return undefined
  }

  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
  }

  if (chunks.length === 0) {
    return undefined
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}

function writeJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  })
  res.end(`${JSON.stringify(payload, null, 2)}\n`)
}

const sessions = new Map()

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`)

  if (url.pathname === "/healthz") {
    writeJson(res, 200, {
      ok: true,
      service: "dagger-mcp-http-bridge",
      moduleRef,
      sessions: sessions.size,
    })
    return
  }

  if (url.pathname !== "/mcp") {
    writeJson(res, 404, {
      ok: false,
      message: "not found",
    })
    return
  }

  try {
    const sessionId = req.headers["mcp-session-id"]
    const body = await readJsonBody(req)

    if (req.method === "POST") {
      if (!sessionId) {
        if (body?.method !== "initialize") {
          writeJson(res, 400, {
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Bad Request: No valid session ID provided",
            },
            id: body?.id ?? null,
          })
          return
        }

        const session = createBridgeSession()
        await session.server.connect(session.transport)
        await session.transport.handleRequest(req, res, body)
        return
      }

      const session = sessions.get(sessionId)
      if (!session) {
        writeJson(res, 404, {
          jsonrpc: "2.0",
          error: {
            code: -32001,
            message: "Session not found",
          },
          id: body?.id ?? null,
        })
        return
      }

      await session.transport.handleRequest(req, res, body)
      return
    }

    if (req.method === "GET") {
      res.writeHead(405, {
        Allow: "POST, DELETE",
        "content-type": "application/json; charset=utf-8",
      })
      res.end(
        `${JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Method not allowed.",
          },
          id: null,
        })}\n`,
      )
      return
    }

    if (req.method === "DELETE") {
      if (!sessionId) {
        res.writeHead(400).end("Invalid or missing session ID")
        return
      }

      const session = sessions.get(sessionId)
      if (!session) {
        res.writeHead(404).end("Session not found")
        return
      }

      await session.transport.handleRequest(req, res)
      return
    }

    res.writeHead(405).end("Method not allowed")
  } catch (error) {
    console.error("bridge error", error)
    if (!res.headersSent) {
      writeJson(res, 500, {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : String(error),
        },
        id: null,
      })
    }
  }
})

server.listen(port, "127.0.0.1", () => {
  console.log(`dagger mcp http bridge listening on http://127.0.0.1:${port}/mcp`)
})

async function shutdown() {
  server.close()
  for (const { transport, server: sessionServer } of sessions.values()) {
    await transport.close()
    await sessionServer.close()
  }
  sessions.clear()
  await upstream.close()
}

process.on("SIGINT", async () => {
  await shutdown()
  process.exit(0)
})

process.on("SIGTERM", async () => {
  await shutdown()
  process.exit(0)
})
