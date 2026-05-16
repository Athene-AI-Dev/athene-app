import { defineConfig, devices } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";

// Load .env.local so NANGO_SECRET_KEY and other secrets are available
// to the Playwright test process (not just the Next.js server process)
const envPath = path.join(__dirname, ".env.local");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,        // long timeout for LLM SSE responses
  retries: 1,
  fullyParallel: false,     // run sequentially — auth state is shared
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: "http://localhost:3000",
    storageState: "./playwright/.auth/user.json",
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // Global setup: authenticate once and save cookie/localStorage
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },
    // All feature tests — depend on the authenticated session
    {
      name: "athene",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "./playwright/.auth/user.json",
      },
      testMatch: /athene-full\.spec\.ts/,
    },
    // Pipeline integration tests — exercise real embed → store → retrieve → RAG
    {
      name: "pipeline",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "./playwright/.auth/user.json",
      },
      testMatch: /pipeline\.spec\.ts/,
    },
  ],
});
