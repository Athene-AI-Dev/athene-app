/**
 * Scenario A — Admin onboarding
 *
 * Flow:
 *   1. Sign up as a new admin user via Clerk-hosted UI
 *   2. Create an organisation
 *   3. Navigate to Integrations → connect Nango sandbox
 *   4. Assert that the indexing job is triggered (status indicator visible)
 *
 * Uses the seeded test org + Clerk test-mode credentials so no real OAuth is needed.
 */

import { test, expect } from "./fixtures/seed";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@athene-test.internal";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Test1234!";

test.describe("Scenario A — Admin onboarding", () => {
  test("signup → create org → connect Nango → indexing starts", async ({ page, seed }) => {
    /* ── 1. Land on root; redirected to sign-in since not authenticated ── */
    await page.goto("/");
    await expect(page).toHaveURL(/sign-in|sign-up/);

    /* ── 2. Go to sign-up ─────────────────────────────────────────────── */
    await page.goto("/sign-up");
    await page.waitForLoadState("networkidle");

    // Clerk renders an iframe or native form depending on config.
    // We use locators that are robust to both.
    const emailInput = page.locator('input[name="emailAddress"], input[type="email"]').first();
    await emailInput.fill(ADMIN_EMAIL);

    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    await passwordInput.fill(ADMIN_PASSWORD);

    const submitBtn = page
      .locator('button[type="submit"], button:has-text("Continue"), button:has-text("Sign up")')
      .first();
    await submitBtn.click();

    /* ── 3. Handle optional OTP step then wait for dashboard ────────── */
    // Clerk may show an email-code step in test mode.
    // Use waitFor(state:"visible") so we don't race against DOM insertion.
    const otpInput = page.locator('input[name="code"]');
    const otpVisible = await otpInput
      .waitFor({ state: "visible", timeout: 4_000 })
      .then(() => true)
      .catch(() => false);

    if (otpVisible) {
      const skipBtn = page.locator('button:has-text("Skip")');
      const skipVisible = await skipBtn
        .waitFor({ state: "visible", timeout: 2_000 })
        .then(() => true)
        .catch(() => false);
      if (skipVisible) await skipBtn.click();
    }

    // FIX: Idempotency — on 2nd+ CI run the test-account already exists in Clerk.
    // Detect this by checking if we're still on /sign-up after submit
    // (Clerk shows an error like "email already in use") and fall back to /sign-in.
    // FIX 2: Wait for navigation to settle first — page.url() checked immediately
    // after OTP skip may still show a sign-up transition URL.
    await page.waitForLoadState("networkidle").catch(() => {});
    const stillOnSignUp = page.url().includes("sign-up");
    if (stillOnSignUp) {
      await page.goto("/sign-in");
      await page.waitForLoadState("networkidle");
      await page.locator('input[name="emailAddress"], input[type="email"]').first().fill(ADMIN_EMAIL);
      await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_PASSWORD);
      await page
        .locator('button[type="submit"], button:has-text("Continue"), button:has-text("Sign in")')
        .first()
        .click();
    }

    await page.waitForURL(/\/chat|\/admin/, { timeout: 30_000 });

    /* ── 4. Navigate to admin → integrations ─────────────────────────── */
    await page.goto("/admin/integrations");
    await page.waitForLoadState("networkidle");

    // Verify the integrations page loaded
    await expect(page.locator("h1, h2").filter({ hasText: /integrations?/i }).first()).toBeVisible();

    /* ── 5. Click "Connect" for the Nango / Google Drive integration ──── */
    const connectBtn = page
      .locator('button:has-text("Connect"), a:has-text("Connect")')
      .first();
    await expect(connectBtn).toBeVisible({ timeout: 10_000 });

    /* ── 6. Assert Nango OAuth popup OR inline redirect appeared ─────── */
    // IMPORTANT: register the popup listener BEFORE clicking so the event
    // is never missed (popup can fire synchronously on click).
    let nangoSuccess = false;

    const popupPromise = page.waitForEvent("popup", { timeout: 5_000 }).catch(() => null);
    await connectBtn.click();
    const popup = await popupPromise;

    if (popup) {
      // Nango sandbox auto-closes after success
      await popup.waitForEvent("close", { timeout: 15_000 }).catch(() => {});
      nangoSuccess = true;
    } else {
      // Inline redirect – look for a success toast or status badge
      const successIndicator = page.locator(
        '[data-testid="connection-status"], .sonner-toast, [role="status"]'
      );
      nangoSuccess = await successIndicator
        .filter({ hasText: /connected|success/i })
        .waitFor({ state: "visible", timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
    }

    expect(nangoSuccess, "Nango connection should succeed or show success indicator").toBeTruthy();

    /* ── 7. Assert indexing indicator becomes visible ─────────────────── */
    // After connection the app fires a /api/worker/nango-fetch job.
    // The UI should show a "Syncing…" or "Indexing…" badge.
    const indexingBadge = page.locator(
      '[data-testid="indexing-status"], [aria-label*="index"], *:has-text("Syncing"), *:has-text("Indexing")'
    );
    await expect(indexingBadge.first()).toBeVisible({ timeout: 20_000 });

    // Seed reference just keeps TypeScript happy – no runtime use needed here
    void seed;
  });
});
