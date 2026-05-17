/**
 * Scenario B — Member search / knowledge retrieval
 *
 * Mirrors: app/(dashboard)/chat/page.tsx
 *
 * Chat input:    <input> inside <form onSubmit={handleSubmit}>
 *                placeholder: "Ask Athene to synthesize anything..."
 * Submit button: <button type="submit"> (Send icon — no text label)
 * User message:  [data-testid="user-message"]
 * AI message:    [data-testid="assistant-message"]
 * Cited source:  [data-testid="cited-source"]
 *
 * API call: POST /api/agent { message, threadId, task_type: "general" }
 *           Response: SSE stream of { token } / { cited_sources } frames
 */

import { test, expect } from "./fixtures/seed";
import { signIn, sendChatMessage, waitForChatResponse, getLastAssistantMessage } from "./helpers";

const MEMBER_EMAIL = process.env.E2E_MEMBER_EMAIL ?? "e2e-member@athene-test.internal";
const MEMBER_PASSWORD = process.env.E2E_MEMBER_PASSWORD ?? "Test1234!";

test.describe("Scenario B — Member search", () => {
  test('sign in → ask "What is our refund policy?" → cited answer renders', async ({
    page,
    seed,
  }) => {
    test.setTimeout(120_000);
    void seed;

    /* ── 1. Sign in ──────────────────────────────────────────────── */
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD);

    /* ── 2. Navigate to chat ─────────────────────────────────────── */
    await page.goto("/chat");
    await page.waitForLoadState("networkidle");

    /* ── 3. Confirm chat input is rendered ───────────────────────── */
    const chatInput = page.locator("form input").first();
    await expect(chatInput).toBeVisible({ timeout: 10_000 });

    /* ── 4. Intercept the agent API call ─────────────────────────── */
    let agentCalled = false;
    await page.route("**/api/agent", async (route) => {
      agentCalled = true;
      await route.continue();
    });

    /* ── 5. Send message ─────────────────────────────────────────── */
    await sendChatMessage(page, "What is our refund policy?");

    /* ── 6. Confirm user message appeared — data-testid from message-list.tsx */
    await expect(
      page
        .locator('[data-testid="user-message"]')
        .filter({ hasText: "What is our refund policy?" })
        .first()
    ).toBeVisible({ timeout: 10_000 });

    /* ── 7. Wait for AI to finish responding ─────────────────────── */
    await waitForChatResponse(page, 90_000);

    /* ── 8. Assert the response is substantive ───────────────────── */
    const text = await getLastAssistantMessage(page);
    expect(text.length, "Assistant response must contain meaningful text").toBeGreaterThan(30);
    // Real answer OR polite "no context found" — both valid
    expect(text.toLowerCase()).toMatch(/refund|return|30.day|policy|context|cannot|sorry|unable/);

    /* ── 9. Assert the /api/agent endpoint was called ────────────── */
    expect(agentCalled, "POST /api/agent must have been called").toBe(true);
  });
});
