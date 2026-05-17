/**
 * Scenario E — Morning briefing
 *
 * Mirrors: app/(dashboard)/briefing/page.tsx
 *
 * Page heading:       <h1>"Morning <span>Briefing</span>"</h1>
 * Empty state heading: "Synthesis Required"
 * Empty state text:   "No briefing for today yet. Trigger synthesis..."
 * Trigger button:     <button>"Trigger Neural Synthesis"</button>   (when not loading)
 *                     <button>"Synthesizing…"</button>              (while loading)
 *
 * Briefing sections (when briefing exists):
 *   "Calendar & Strategic Alignment"
 *   "High-Priority Communications"
 *   "Knowledge & Document Evolution"
 *
 * Trigger via automations page (/admin/automations):
 *   POST /api/admin/automations → creates a morning_briefing automation
 *   The briefing worker endpoint: POST /api/worker/briefing { orgId, manual: true }
 */

import { test, expect } from "./fixtures/seed";
import { signIn } from "./helpers";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@athene-test.internal";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Test1234!";

test.describe("Scenario E — Morning briefing", () => {
  test("sign in → /briefing → page renders without crash", async ({ page, seed }) => {
    /* ── 1. Sign in ──────────────────────────────────────────────── */
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    /* ── 2. Try to trigger briefing from the /briefing page directly */
    await page.goto("/briefing");
    await page.waitForLoadState("networkidle");

    // If "Trigger Neural Synthesis" button is visible, click it
    // Actual button text from briefing/page.tsx
    const triggerBtn = page.locator('button:has-text("Trigger Neural Synthesis")');
    if (await triggerBtn.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      await triggerBtn.first().click();
      // Wait for the loading state to start ("Synthesizing…")
      await page
        .locator('button:has-text("Synthesizing")')
        .first()
        .waitFor({ state: "visible", timeout: 5_000 })
        .catch(() => {});
      // Give the worker a moment to process
      await page.waitForTimeout(3_000);
    } else {
      // Button not visible — briefing already generated, or worker endpoint fallback
      const resp = await page.request.post("/api/worker/briefing", {
        data: { orgId: seed.orgId, manual: true },
        headers: { "Content-Type": "application/json" },
        failOnStatusCode: false,
      });
      if (resp.status() >= 400) {
        test.info().annotations.push({
          type: "info",
          description: `Worker briefing endpoint returned ${resp.status()} — briefing may not have been generated`,
        });
      }
      await page.waitForTimeout(2_000);
    }

    /* ── 3. Navigate / reload /briefing ─────────────────────────── */
    await page.goto("/briefing");
    await page.waitForLoadState("networkidle");

    /* ── 4. Assert page heading is present ───────────────────────── */
    // Actual h1 text (collapsed): "Morning Briefing"
    // The span wrapping "Briefing" is inside h1 — textContent collapses them
    const heading = page.locator("h1").filter({ hasText: /morning.*briefing/i }).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    /* ── 5. Assert the page content renders in one of two states ─── */
    // State A: empty — shows "Synthesis Required" heading
    const hasSynthesisRequired = await page
      .locator("text=Synthesis Required")
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    // State B: briefing exists — shows one of the section headings
    const hasBriefingContent = await page
      .locator(
        'text="Calendar & Strategic Alignment", ' +
        'text="High-Priority Communications", ' +
        'text="Knowledge & Document Evolution", ' +
        'text="Executive Summary"'
      )
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    expect(
      hasSynthesisRequired || hasBriefingContent,
      "Briefing page must show 'Synthesis Required' empty state or a briefing section heading"
    ).toBe(true);

    /* ── 6. Assert no crash error state ─────────────────────────── */
    const errorMsg = page.locator(
      'text="Something went wrong", text="Failed to load", [role="alert"]:has-text("error")'
    );
    await expect(errorMsg.first()).not.toBeVisible({ timeout: 3_000 });
  });
});
