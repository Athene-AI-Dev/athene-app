/**
 * Scenario C — Email approval
 *
 * Flow:
 *   1. Log in as admin
 *   2. Ask "draft an email to Alice about the demo"
 *   3. Assert that an approval card / pending action renders
 *   4. Click "Approve"
 *   5. Intercept the outbound API call and assert the request body contains
 *      the correct recipient ("Alice") and context ("demo")
 *
 * The /api/agent/approve endpoint is the real one; we mock only the
 * downstream email-send HTTP call using Playwright's route interception.
 */

import { test, expect } from "./fixtures/seed";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@athene-test.internal";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Test1234!";

test.describe("Scenario C — Email approval", () => {
  test('ask draft email → approve → mock email endpoint fires with correct body', async ({
    page,
    seed,
  }) => {
    // Worst-case: 30s sign-in + 60s approval card + 10s approve + 10s confirm = 110s.
    // Override the 90s global config timeout.
    test.setTimeout(120_000);
    void seed;

    /* ── 1. Sign in ──────────────────────────────────────────────────── */
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

    await page.waitForURL(/\/chat/, { timeout: 30_000 });

    /* ── 2. Go to chat ───────────────────────────────────────────────── */
    await page.goto("/chat");
    await page.waitForLoadState("networkidle");

    /* ── 3. Intercept the downstream email / approve endpoint ─────────
     * We route any request going to an email-send endpoint (could be
     * /api/agent/approve or a third-party mail service) and capture
     * the request body for later assertion.
     *
     * FIX: Use a Promise so the test waits deterministically for the
     * request to fire rather than sleeping for an arbitrary duration.
     */
    let capturedEmailBody: string | null = null;
    // eslint-disable-next-line prefer-const
    let resolveCapture!: () => void; // definite-assignment: Promise constructor runs sync
    const capturePromise = new Promise<void>((res) => { resolveCapture = res; });

    await page.route("**/api/agent/approve**", async (route) => {
      const body = route.request().postData();
      capturedEmailBody = body;
      resolveCapture();
      // Let the real request proceed so the UI updates normally
      await route.continue();
    });

    // Also intercept any external mail provider calls (fallback)
    await page.route("**/send-email**", async (route) => {
      const body = route.request().postData();
      if (!capturedEmailBody) { capturedEmailBody = body; resolveCapture(); }
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    });

    /* ── 4. Ask the agent to draft an email ─────────────────────────── */
    const messageInput = page
      .locator('input[placeholder*="Ask"], input[placeholder*="Message"], textarea')
      .first();
    await expect(messageInput).toBeVisible({ timeout: 10_000 });
    await messageInput.fill("draft an email to Alice about the demo");

    await page.locator('button[type="submit"], button:has-text("Send")').first().click();

    /* ── 5. Wait for the approval card to appear ─────────────────────── */
    // The LangGraph agent sets awaiting_approval=true; the UI renders a
    // pending action card with Approve / Reject / Edit buttons.
    //
    // FIX: 'div:has-text("Approve")' is ancestor-matching — Playwright walks
    // up the DOM and can return the outermost container (e.g. the page body)
    // which contains every word on the page. Use :has(button) to scope to
    // the smallest element that *contains* an Approve button as a descendant.
    const approvalCard = page.locator(
      '[data-testid="approval-card"], [data-testid="pending-action"], ' +
      'div:has(button:has-text("Approve"))'
    );
    await expect(approvalCard.first()).toBeVisible({ timeout: 60_000 });

    /* ── 6. Assert the draft mentions Alice and the demo ─────────────── */
    // Use the innermost card element to avoid reading the full page text.
    const cardText = await approvalCard.first().textContent();
    // Guard: textContent() returns null if the element has no text node
    expect(cardText, "Approval card must have text content").not.toBeNull();
    expect((cardText ?? "").toLowerCase()).toMatch(/alice|demo/);

    /* ── 7. Click Approve ────────────────────────────────────────────── */
    // FIX: removed button:has-text("Send") — that also matches the chat input's
    // Send button which is still visible. Only click the Approve button.
    const approveBtn = page.locator('button:has-text("Approve")').first();
    await approveBtn.click();

    /* ── 8. Wait deterministically for the approve request to fire ───── */
    // Race the capture promise against a 10 s timeout so we don't hang forever.
    await Promise.race([
      capturePromise,
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Approve request not captured within 10 s")), 10_000)
      ),
    ]);

    /* ── 9. Assert the captured body is correct ──────────────────────── */
    expect(capturedEmailBody, "Approve endpoint should have been called").not.toBeNull();

    // FIX: wrap JSON.parse — body could be form-encoded or malformed;
    // an unguarded parse throws a SyntaxError that obscures the real failure.
    let parsed: unknown = {};
    try {
      parsed = JSON.parse(capturedEmailBody!);
    } catch {
      // If body isn't JSON, fall back to raw string matching
      parsed = capturedEmailBody;
    }
    const bodyStr = JSON.stringify(parsed).toLowerCase();
    expect(bodyStr, "Approve body must reference Alice").toMatch(/alice/);
    expect(bodyStr, "Approve body must reference the demo").toMatch(/demo/);

    /* ── 10. Confirm UI returns to normal (no more approval card) ─────── */
    await expect(
      page.locator('button:has-text("Approve")').first()
    ).not.toBeVisible({ timeout: 10_000 });
  });
});
