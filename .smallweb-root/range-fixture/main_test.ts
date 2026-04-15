import assert from "node:assert/strict"

import { createRangeFixtureApp } from "./main.ts"

Deno.test("range fixture returns deterministic target HTML", async () => {
  const app = createRangeFixtureApp()
  const response = await app.fetch(new Request("https://range-fixture.tidelands.dev/recon?q=alpha&finding=known-vuln"))
  const body = await response.text()

  assert.equal(response.status, 200)
  assert.match(body, /Fixture Target/)
  assert.match(body, /Reflected query: alpha/)
  assert.match(body, /Known finding: known-vuln/)
})

Deno.test("range fixture exposes healthz", async () => {
  const app = createRangeFixtureApp()
  const response = await app.fetch(new Request("https://range-fixture.tidelands.dev/healthz"))
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.app, "range-fixture")
  assert.equal(body.ok, true)
})
