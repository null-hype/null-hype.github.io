import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

test("build emits dist/index.js", () => {
  assert.equal(existsSync(new URL("./dist/index.js", import.meta.url)), true)
})

test("compiled module still defines TidelaneInfra", () => {
  const output = readFileSync(new URL("./dist/index.js", import.meta.url), "utf8")
  assert.match(output, /class TidelaneInfra/)
})
