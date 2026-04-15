import assert from "node:assert/strict"

import { createRangeFixtureApp } from "../range-fixture/main.ts"
import { createTestSlotApp } from "./main.ts"

async function readNdjson(response: Response) {
  const body = await response.text()

  return body
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

function createRouterFetch(routes: Record<string, { fetch(req: Request): Response | Promise<Response> }>) {
  const fetchImpl = async (target: string | URL | Request, init?: RequestInit) => {
    const request = target instanceof Request ? target : new Request(String(target), init)
    const url = new URL(request.url)
    const app = routes[url.host]

    if (!app) {
      throw new Error(`Unexpected routed host: ${url.host}`)
    }

    return await app.fetch(request)
  }

  return fetchImpl
}

Deno.test("test-slot ACP flow fetches the range fixture and summarizes the finding", async () => {
  const rangeFixture = createRangeFixtureApp()
  const testSlot = createTestSlotApp({
    fetchImpl: createRouterFetch({
      "fixture.test": rangeFixture,
    }),
  })

  const initialize = await readNdjson(await testSlot.fetch(new Request("https://slot.tidelands.dev/acp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: 0,
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        protocolVersion: 1,
      },
    }),
  })))
  assert.equal(initialize[0].result.protocolVersion, 1)

  const sessionNew = await readNdjson(await testSlot.fetch(new Request("https://slot.tidelands.dev/acp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "session/new",
      params: {
        cwd: "/tmp/test-slot",
        mcpServers: [],
      },
    }),
  })))
  const sessionId = sessionNew[0].result.sessionId
  assert.match(sessionId, /^slot_/)

  const prompt = await readNdjson(await testSlot.fetch(new Request("https://slot.tidelands.dev/acp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: 2,
      jsonrpc: "2.0",
      method: "session/prompt",
      params: {
        prompt: [
          {
            text: "Target URL: https://fixture.test/recon?q=alpha&finding=known-vuln",
            type: "text",
          },
        ],
        sessionId,
      },
    }),
  })))
  const summary = prompt[0].params.update.content.text

  assert.match(summary, /Fixture Target/)
  assert.match(summary, /Detected finding "known-vuln"/)
  assert.equal(prompt[1].result.stopReason, "end_turn")
})
