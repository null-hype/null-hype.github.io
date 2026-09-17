import { defineConfig } from 'vitest/config';

// `tests/` holds this repo's Playwright e2e specs (see playwright.config.ts)
// -- a different runner with a different test() global. Scope vitest to
// src/ so `npm test` doesn't try to collect those as vitest tests too.
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
  },
});
