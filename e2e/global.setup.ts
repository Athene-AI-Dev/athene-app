/**
 * Global Playwright setup — authenticate once and save session to disk.
 *
 * Clerk uses a cookie-based session. We connect to the already-running
 * Chrome instance (CDP at :9222) which has the user already signed in,
 * then copy its storage state so every test reuses the auth session.
 *
 * If CDP isn't available we fall back to a headless browser and fill
 * the sign-in form using PLAYWRIGHT_EMAIL / PLAYWRIGHT_PASSWORD env vars.
 */

import { chromium, type FullConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_FILE = path.join(__dirname, "../playwright/.auth/user.json");
const BASE = "http://localhost:3000";

async function setup(config: FullConfig) {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  // ── Strategy 1: reuse CDP browser (already signed in) ───────
  try {
    const browser = await chromium.connectOverCDP("http://localhost:9222", {
      timeout: 5_000,
    });
    const contexts = browser.contexts();
    const ctx = contexts[0];
    if (ctx) {
      // Navigate to the app to trigger Clerk cookie initialisation
      const page = await ctx.newPage();
      await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 15_000 });
      await page.waitForTimeout(2000);

      const storageState = await ctx.storageState();
      fs.writeFileSync(AUTH_FILE, JSON.stringify(storageState, null, 2));
      console.log("[setup] Saved auth from CDP browser");
      await page.close();
      await browser.close();
      return;
    }
    await browser.close();
  } catch {
    console.log("[setup] CDP not available — falling back to headless login");
  }

  // ── Strategy 2: headless login via form ─────────────────────
  const email = process.env.PLAYWRIGHT_EMAIL ?? process.env.TEST_EMAIL ?? "";
  const password = process.env.PLAYWRIGHT_PASSWORD ?? process.env.TEST_PASSWORD ?? "";

  if (!email || !password) {
    console.warn("[setup] No credentials — writing empty auth file; tests may fail");
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }, null, 2));
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = browser.newContext();
  const page = await (await ctx).newPage();

  await page.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  // Clerk sign-in form
  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.fill(email);
  await emailInput.press("Enter");
  await page.waitForTimeout(1000);

  const pwInput = page.locator('input[type="password"]').first();
  await pwInput.fill(password);
  await pwInput.press("Enter");

  // Wait for redirect away from sign-in
  await page.waitForURL((url) => !url.toString().includes("sign-in"), { timeout: 20_000 });
  await page.waitForTimeout(2000);

  const storageState = await (await ctx).storageState();
  fs.writeFileSync(AUTH_FILE, JSON.stringify(storageState, null, 2));
  console.log("[setup] Saved auth from headless login");

  await browser.close();
}

export default setup;
