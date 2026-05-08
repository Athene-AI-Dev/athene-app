/**
 * Scenario B — Member search
 *
 * Flow:
 *   1. Log in as a regular member (seeded credentials)
 *   2. Navigate to /chat
 *   3. Ask "What is our refund policy?"
 *   4. Assert the AI response renders with at least one cited source
 *
 * The seed fixture pre-loads a "Refund Policy" document into the knowledge
 * store so the answer is deterministic and doesn't rely on a live LLM call.
 */

import { test, expect } from "./fixtures/seed";

const MEMBER_EMAIL = process.env.E2E_MEMBER_EMAIL ?? "e2e-member@athene-test.internal";
const MEMBER_PASSWORD = process.env.E2E_MEMBER_PASSWORD ?? "Test1234!";

test.describe("Scenario B — Member search", () => {
  test('login → ask "What is our refund policy?" → cited answer renders', async ({
    page,
    seed,
  }) => {
    // Worst-case: 30s sign-in + 60s AI wait + 15s citation = 105s.
    // Global config is 90s — override here to avoid false timeout failures.
    test.setTimeout(120_000);
    void seed; // fixture ensures seed docs are present

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

    // FIX: removed h1:has-text(/chat/i) assertion — the chat page may use a
    // logo or icon instead of a text heading. The message input being visible
    // is a sufficient and more reliable signal that the chat page is ready.

    /* ── 3. Type the question ────────────────────────────────────────── */
    const messageInput = page.locator(
      'input[placeholder*="Ask"], input[placeholder*="Message"], ' +
      'textarea[placeholder*="Ask"], textarea[placeholder*="Message"], textarea'
    ).first();
    await expect(messageInput).toBeVisible({ timeout: 10_000 });
    await messageInput.fill("What is our refund policy?");

    /* ── 4. Submit ───────────────────────────────────────────────────── */
    const sendBtn = page.locator('button[type="submit"], button:has-text("Send")').first();
    await sendBtn.click();

    /* ── 5. Wait for an assistant message to appear ───────────────── */
    // FIX: scoped to data-testid/data-role selectors to avoid matching the user's
    // own message bubble. 'div.justify-start div' can match user messages in some
    // layout variants, causing the assertion to pass before AI has responded.
    const assistantBubble = page
      .locator(
        '[data-testid="assistant-message"], div[data-role="assistant"], ' +
        'div.justify-start div:not([data-role="user"])'
      )
      .filter({ hasText: /refund|30 days|return/i })
      .first();

    await expect(assistantBubble).toBeVisible({ timeout: 60_000 });

    /* ── 6. Assert the response contains refund-related content ─────── */
    const text = await assistantBubble.textContent();
    // Guard: textContent() returns null if element has no text nodes
    expect(text, "Assistant bubble must have text content").not.toBeNull();
    expect((text ?? "").toLowerCase()).toMatch(/refund|return|30 days/);

    /* ── 7. Assert cited sources rendered ────────────────────────────── */
    // The agent streams cited_sources; the UI should render source chips or links.
    // FIX: removed *:has-text("Refund Policy") — that matched the user's own
    // question bubble and the AI answer, making this assertion always trivially pass.
    // Use only specific selectors: data-testid, CSS class, or an anchor link.
    const citedSource = page.locator(
      '[data-testid="cited-source"], .cited-source, a:has-text("Refund Policy")'
    );
    // At least one cited source element should be present
    await expect(citedSource.first()).toBeVisible({ timeout: 15_000 });
  });
});
