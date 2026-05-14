/**
 * Scenario F — Graph citations
 *
 * Flow:
 *   1. Log in as a regular member
 *   2. Navigate to /chat
 *   3. Ask about component dependencies: "What does the Payment Gateway depend on?"
 *   4. Assert the AI response mentions "Stripe" (the dependency in our seed)
 *   5. Assert a graph citation is rendered in the source list.
 */

import { test, expect } from "./fixtures/seed";

const MEMBER_EMAIL = process.env.E2E_MEMBER_EMAIL ?? "e2e-member@athene-test.internal";
const MEMBER_PASSWORD = process.env.E2E_MEMBER_PASSWORD ?? "Test1234!";

test.describe("Scenario F — Graph citations", () => {
  test('login → ask about dependencies → graph relationship citation appears', async ({
    page,
    seed,
  }) => {
    test.setTimeout(120_000);
    void seed;

    /* ── 1. Sign in as member ─────────────────────────────────────────── */
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");

    await page
      .locator('input[name="emailAddress"], input[type="email"]')
      .first()
      .fill(MEMBER_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(MEMBER_PASSWORD);
    await page
      .locator('button[type="submit"], button:has-text("Continue"), button:has-text("Sign in")')
      .first()
      .click();

    await page.waitForURL(/\/chat/, { timeout: 30_000 });

    /* ── 2. Navigate to chat ─────────────────────────────────────────── */
    await page.goto("/chat");
    await page.waitForLoadState("networkidle");

    /* ── 3. Type the question ────────────────────────────────────────── */
    const messageInput = page.locator(
      'input[placeholder*="Ask"], input[placeholder*="Message"], ' +
      'textarea[placeholder*="Ask"], textarea[placeholder*="Message"], textarea'
    ).first();
    await expect(messageInput).toBeVisible({ timeout: 10_000 });
    await messageInput.fill("What does the Payment Gateway depend on?");

    /* ── 4. Submit ───────────────────────────────────────────────────── */
    const sendBtn = page.locator('button[type="submit"], button:has-text("Send")').first();
    await sendBtn.click();

    /* ── 5. Wait for assistant response ─────────────────────────────── */
    const assistantBubble = page
      .locator(
        '[data-testid="assistant-message"], div[data-role="assistant"], ' +
        'div.justify-start div:not([data-role="user"])'
      )
      .filter({ hasText: /stripe|depends/i })
      .first();

    await expect(assistantBubble).toBeVisible({ timeout: 60_000 });

    /* ── 6. Assert graph relationship citation rendered ────────────── */
    // Graph citations often have a unique icon or label like "Graph" or "Relationship"
    const citedSource = page.locator(
      '[data-testid="cited-source"], .cited-source, .source-link'
    ).filter({ hasText: /stripe|payment gateway|relationship|graph/i });
    
    await expect(citedSource.first()).toBeVisible({ timeout: 15_000 });
  });
});
