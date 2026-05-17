/**
 * Scenario A — Admin onboarding
 *
 * Mirrors: app/(dashboard)/admin/integrations/page.tsx
 *
 * Page heading:  <h1>"System <span>Connectors</span>"</h1>
 * Add button:    <button>"Integrate Tool"</button>    (Plus icon, no connected integrations)
 * Search input:  placeholder "Filter system connectors..."
 * Status badge:  "{n} Active Feeds"
 *
 * Connected integration cards expose:
 *   <button>"Force Sync"</button>  and  <button>"Configure"</button>
 *
 * Available integrations grid: img[alt="Gmail"], img[alt="Slack"], etc.
 */

import { test, expect } from "./fixtures/seed";
import { signIn } from "./helpers";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@athene-test.internal";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Test1234!";

test.describe("Scenario A — Admin onboarding", () => {
  test("sign in → /admin/integrations → System Connectors page renders with connector content", async ({
    page,
    seed,
  }) => {
    void seed;

    /* ── 1. Sign in ──────────────────────────────────────────────── */
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    /* ── 2. Navigate to admin integrations ───────────────────────── */
    await page.goto("/admin/integrations");
    await page.waitForLoadState("networkidle");

    /* ── 3. Verify page heading — actual text: "System Connectors" ── */
    // The h1 contains "System" + a <span class="text-primary">Connectors</span>
    // textContent() collapses both into "System Connectors"
    const heading = page.locator("h1").filter({ hasText: /system\s+connectors/i }).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    /* ── 4. Assert meaningful connector content rendered ─────────── */
    // The page shows one of three states — all are valid:
    //
    // (a) Connected integration cards: "Force Sync" / "Configure" buttons
    const hasForceSync = await page
      .locator('button:has-text("Force Sync")')
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    // (b) "Integrate Tool" primary action button (when no connectors are active)
    // Actual button text from page.tsx: "Integrate Tool" with a Plus icon
    const hasIntegrateButton = await page
      .locator('button:has-text("Integrate Tool")')
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    // (c) Available Integrations grid — connector images are present
    // img alt values come from providers.ts: "Gmail", "Slack", "SharePoint", etc.
    const hasAvailableGrid = await page
      .locator('h2:has-text("Available Integrations"), img[alt="Gmail"], img[alt="Slack"], img[alt="SharePoint"]')
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    expect(
      hasForceSync || hasIntegrateButton || hasAvailableGrid,
      "Integrations page must show connected cards, the 'Integrate Tool' button, or the available connectors grid"
    ).toBe(true);

    /* ── 5. Verify search input is present ───────────────────────── */
    // Actual placeholder from page.tsx: "Filter system connectors..."
    const searchInput = page.locator('input[placeholder="Filter system connectors..."]');
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
  });
});
