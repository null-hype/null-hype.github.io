import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'loanword-execution.spec.ts',
  outputDir: '../test-results/gap-execution',
  timeout: 180_000,
  expect: { timeout: 60_000 },
  workers: 1,
  use: {
    baseURL: 'http://localhost:4322',
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4322',
    url: 'http://localhost:4322',
    reuseExistingServer: !process.env.CI,
    env: { ASTRO_TELEMETRY_DISABLED: '1' },
    timeout: 120_000,
  },
});
