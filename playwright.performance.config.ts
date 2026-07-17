import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: { timeout: 120_000 },
  fullyParallel: false,
  outputDir: ".local/performance-baseline/test-results",
  preserveOutput: "never",
  reporter: "list",
  retries: 0,
  testDir: "tests/performance",
  timeout: 15 * 60_000,
  use: {
    baseURL: "http://127.0.0.1:4323/csv-validator/",
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  webServer: {
    command:
      "node node_modules/astro/bin/astro.mjs preview --host 127.0.0.1 --port 4323",
    env: { ASTRO_TELEMETRY_DISABLED: "1" },
    reuseExistingServer: false,
    timeout: 120_000,
    url: "http://127.0.0.1:4323/csv-validator/",
  },
  workers: 1,
  projects: [
    {
      name: "chromium-performance",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
