/**
 * Scenario E — Morning briefing
 *
 * Flow:
 *   1. Trigger the briefing manually via POST /api/worker/briefing (or the
 *      admin automations UI)
 *   2. Navigate to /briefing
 *   3. Assert the briefing content card renders with at least a heading and
 *      a non-empty body
 *
 * The seeded org has an automation record so the briefing generator has
 * something to render even without a live LLM call.
 */

import { test, expect } from "./fixtures/seed";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@athene-test.internal";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Test1234!";

test.describe("Scenario E — Morning briefing", () => {
  test("trigger briefing manually → open /briefing → content renders", async ({
    page,
    seed,
  }) => {
    // `seed` is used in the fallback trigger (seed.orgId)

    /* ── 1. Sign in as admin ─────────────────────────────────────────── */
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");

    await page
      .locator('input[name="emailAddress"], input[type="email"]')
      .first()
      .fill(ADMIN_EMAIL);
    await page
      .locator('input[name="password"], input[type="password"]')
      .first()
      .fill(ADMIN_PASSWORD);
    await page
      .locator('button[type="submit"], button:has-text("Continue"), button:has-text("Sign in")')
      .first()
      .click();

    await page.waitForURL(/\/chat|\/admin/, { timeout: 30_000 });

    /* ── 2. Manually trigger the briefing ────────────────────────────── */
    // First try the admin automations UI "Run now" button
    await page.goto("/admin/automations");
    await page.waitForLoadState("networkidle");

    const runNowBtn = page.locator(
      'button:has-text("Run now"), button:has-text("Trigger"), button:has-text("Send briefing")'
    );

    if (await runNowBtn.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      await runNowBtn.first().click();
      // Wait for success toast
      await page.locator('.sonner-toast, [role="status"], [role="alert"]').first().waitFor({
        state: "visible",
        timeout: 15_000,
      }).catch(() => {});
    } else {
      // Fallback: hit the worker endpoint directly via the Playwright request API
      const resp = await page.request.post("/api/worker/briefing", {
        data: { orgId: seed.orgId, manual: true },
        headers: { "Content-Type": "application/json" },
        failOnStatusCode: false,
      });
      console.log(`[briefing spec] Worker endpoint status: ${resp.status()}`);
    }

    /* ── 3. Navigate to /briefing ─────────────────────────────────────── */
    await page.goto("/briefing");
    await page.waitForLoadState("networkidle");

    /* ── 4. Assert heading renders ────────────────────────────────────── */
    const briefingHeading = page.locator("h1, h2, h3").first();
    await expect(briefingHeading).toBeVisible({ timeout: 20_000 });

    const headingText = await briefingHeading.textContent();
    // Guard: textContent() returns null for elements with no text nodes
    expect(headingText, "Briefing page must have a non-null heading").not.toBeNull();
    expect((headingText ?? "").trim().length).toBeGreaterThan(0);

    /* ── 5. Assert at least one content paragraph / section renders ───── */
    const contentBlock = page.locator(
      '[data-testid="briefing-content"], article, section, ' +
        'main p, main li, .briefing-body'
    );
    await expect(contentBlock.first()).toBeVisible({ timeout: 15_000 });

    const contentText = await contentBlock.first().textContent();
    // Guard: textContent() returns null for elements with no text nodes
    expect(contentText, "Briefing content block must have text").not.toBeNull();
    expect(
      (contentText ?? "").trim().length,
      "Briefing content block should not be empty"
    ).toBeGreaterThan(10);

    /* ── 6. Verify no error state is shown ───────────────────────────── */
    // FIX: removed .catch(()=>{}) — that silently swallowed assertion failures,
    // making this check always pass even when an error message was visible.
    const errorMsg = page.locator(
      '*:has-text("Something went wrong"), *:has-text("Failed to load")'
    );
    await expect(errorMsg.first()).not.toBeVisible({ timeout: 3_000 });
  });
});
