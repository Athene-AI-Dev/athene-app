import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Load .env.local so CLERK_SECRET_KEY, E2E_* creds, etc. are available
// in the test runner process (Next.js loads this automatically; Playwright doesn't).
config({ path: "../../.env.local" });

/**
 * E2E Playwright configuration for Athene.
 * Runs against a locally started Next.js dev server.
 * All 5 scenarios must complete in < 5 minutes total.
 */
export default defineConfig({
  globalSetup: "./global-setup.ts",
  testDir: "./",
  testMatch: "**/*.spec.ts",
  // FIX: explicitly set outputDir so test-results/ lands at the repo root,
  // matching the CI workflow's upload path: `path: test-results/`.
  outputDir: "../../test-results",

  /* Fail fast in CI – no retries locally */
  retries: process.env.CI ? 1 : 0,
  // FIX: 4 workers matches the ubuntu-latest runner core count (4 vCPUs).
  // With 5 scenarios and a 5-minute total budget, fewer workers risk breaching
  // the time budget. Keep 4 for both CI and local.
  workers: 4,

  /* Reporter: list in dev, GitHub-annotated + HTML in CI */
  reporter: process.env.CI
    ? [["github"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],

  /* Screenshots / video only on failure */
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    /* Give each action 10 s before timing out */
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  /* Shared timeout per test: 90 s */
  timeout: 90_000,

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Spin up the Next.js dev server before the test run.
   * reuseExistingServer:true means a running `pnpm dev` is reused locally
   * instead of spawning a second instance that lands on a different port. */
  webServer: {
    command: "pnpm run dev",
    url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
