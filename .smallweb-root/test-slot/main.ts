type JsonRpcRequest = {
  id?: number | string | null
  jsonrpc?: string
  method?: string
  params?: unknown
}

type JsonRpcMessage = Record<string, unknown>

type SessionRecord = {
  cwd: string
  sessionId: string
}

type TestSlotServices = {
  fetchImpl?: typeof fetch
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  })
}

function ndjson(messages: JsonRpcMessage[]) {
  return new Response(
    `${messages.map((message) => JSON.stringify(message)).join("\n")}\n`,
    {
      headers: {
        "cache-control": "no-store",
        "content-type": "application/x-ndjson; charset=utf-8",
      },
    },
  )
}

function makeResult(id: number | string | null | undefined, result: unknown) {
  return {
    id: id ?? null,
    jsonrpc: "2.0",
    result,
  }
}

function makeError(id: number | string | null | undefined, code: number, message: string) {
  return {
    error: {
      code,
      message,
    },
    id: id ?? null,
    jsonrpc: "2.0",
  }
}

function extractPromptText(params: unknown) {
  const prompt = (params as { prompt?: Array<{ text?: string }> } | undefined)?.prompt ?? []

  return prompt
    .map((entry) => entry?.text ?? "")
    .join("\n")
    .trim()
}

function extractLineValue(promptText: string, prefix: string) {
  const line = promptText
    .split("\n")
    .find((candidate) => candidate.startsWith(prefix))

  return line ? line.slice(prefix.length).trim() : ""
}

function extractTitle(html: string) {
  const match = /<title>([^<]+)<\/title>/i.exec(html)

  return match?.[1]?.trim() ?? ""
}

function extractFinding(html: string) {
  const dataAttr = /data-expected-finding="([^"]+)"/i.exec(html)

  if (dataAttr?.[1]) {
    return dataAttr[1].trim()
  }

  const textual = /Known finding:\s*([^<\n]+)/i.exec(html)

  return textual?.[1]?.trim() ?? ""
}

export function createTestSlotApp(services: TestSlotServices = {}) {
  const fetchImpl = services.fetchImpl ?? fetch
  const sessions = new Map<string, SessionRecord>()

  return {
    async fetch(req: Request) {
      const url = new URL(req.url)

      if (url.pathname === "/healthz") {
        return json({
          app: "test-slot",
          mode: "test",
          ok: true,
          path: url.pathname,
        })
      }

      if (url.pathname !== "/acp" || req.method !== "POST") {
        return json({
          app: "test-slot",
          error: "Not found",
          path: url.pathname,
        }, 404)
      }

      const payload = await req.json() as JsonRpcRequest
      const id = payload.id ?? null

      if (payload.jsonrpc !== "2.0" || !payload.method) {
        return ndjson([makeError(id, -32600, "Invalid Request")])
      }

      if (payload.method === "initialize") {
        return ndjson([
          makeResult(id, {
            agentCapabilities: {},
            agentInfo: {
              name: "test-slot",
              version: "0.1.0",
            },
            protocolVersion: 1,
          }),
        ])
      }

      if (payload.method === "session/new") {
        const cwd = String((payload.params as { cwd?: string } | undefined)?.cwd ?? "")

        if (!cwd.startsWith("/")) {
          return ndjson([makeError(id, -32602, "session/new requires absolute cwd")])
        }

        const sessionId = `slot_${crypto.randomUUID()}`
        sessions.set(sessionId, {
          cwd,
          sessionId,
        })

        return ndjson([
          makeResult(id, {
            sessionId,
          }),
        ])
      }

      if (payload.method === "session/prompt") {
        const params = payload.params as { sessionId?: string } | undefined
        const sessionId = String(params?.sessionId ?? "")
        const session = sessions.get(sessionId)

        if (!session) {
          return ndjson([makeError(id, -32001, "Unknown session")])
        }

        const promptText = extractPromptText(payload.params)
        const targetUrl = extractLineValue(promptText, "Target URL: ")

        if (!targetUrl) {
          return ndjson([makeError(id, -32602, "Prompt is missing Target URL")])
        }

        const response = await fetchImpl(targetUrl, {
          method: "GET",
          headers: {
            "x-tidelane-slot-session": session.sessionId,
          },
        })
        const body = await response.text()
        const title = extractTitle(body)
        const finding = extractFinding(body)
        const summary = [
          `Visited ${targetUrl} and observed title "${title || "unknown"}".`,
          finding ? `Detected finding "${finding}".` : `No finding marker detected.`,
        ].join(" ")

        return ndjson([
          {
            jsonrpc: "2.0",
            method: "session/update",
            params: {
              sessionId,
              update: {
                content: {
                  text: summary,
                  type: "text",
                },
                sessionUpdate: "agent_message_chunk",
              },
            },
          },
          makeResult(id, {
            stopReason: "end_turn",
          }),
        ])
      }

      return ndjson([makeError(id, -32601, "Method not found")])
    },
    run(args: string[]) {
      console.log("test slot app")
      console.log(`args: ${JSON.stringify(args)}`)
    },
  }
}

const app = createTestSlotApp()

export default {
  fetch(req: Request) {
    return app.fetch(req)
  },
  run(args: string[]) {
    return app.run(args)
  },
}
