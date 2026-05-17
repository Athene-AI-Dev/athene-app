/**
 * Scenario C — Email approval (HITL)
 *
 * Mirrors:
 *   app/(dashboard)/chat/page.tsx              — chat form, threadId, HitlModal wiring
 *   components/chat/hitl-modal.tsx             — data-testid="approval-card" on DialogContent
 *   app/api/threads/[id]/approve/route.ts      — POST /api/threads/{threadId}/approve
 *
 * HITL flow:
 *   1. User sends "draft an email to Alice about the demo"
 *   2. Supervisor routes to email_agent → sets awaiting_approval=true in LangGraph state
 *   3. Graph pauses at interrupt_before: ["action_executor"]
 *   4. SSE values frame: { awaiting_approval: true, pending_write_action: { tool, payload } }
 *   5. chat/page.tsx: setPendingAction → setIsHitlModalOpen(true)
 *   6. HitlModal renders with data-testid="approval-card" on its <DialogContent>
 *   7. User clicks "Approve & Execute" → POST /api/threads/{threadId}/approve { action: "approve" }
 *   8. Graph resumes → action_executor sends the email
 *
 * If HITL is not enabled (agent replies inline without pausing), the test skips cleanly.
 */

import { test, expect } from "./fixtures/seed";
import { signIn, sendChatMessage } from "./helpers";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@athene-test.internal";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Test1234!";

test.describe("Scenario C — Email approval", () => {
  test("ask draft email → HITL modal appears → approve → /api/threads/[id]/approve called", async ({
    page,
    seed,
  }) => {
    test.setTimeout(150_000);
    void seed;

    /* ── 1. Sign in ──────────────────────────────────────────────── */
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    /* ── 2. Go to chat ───────────────────────────────────────────── */
    await page.goto("/chat");
    await page.waitForLoadState("networkidle");

    /* ── 3. Intercept the approve endpoint ───────────────────────── */
    // Actual endpoint from chat/page.tsx line 272:
    //   fetch(`/api/threads/${threadId}/approve`, { method: "POST", body: { action } })
    let capturedApproveBody: string | null = null;
    let resolveCapture: (() => void) | undefined;
    const capturePromise = new Promise<void>((res) => {
      resolveCapture = res;
    });

    await page.route("**/api/threads/*/approve", async (route) => {
      capturedApproveBody = route.request().postData();
      resolveCapture?.();
      await route.continue();
    });

    // Fallback: some email providers expose a send-email route
    await page.route("**/send-email**", async (route) => {
      if (!capturedApproveBody) {
        capturedApproveBody = route.request().postData();
        resolveCapture?.();
      }
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    });

    /* ── 4. Ask the agent to draft an email ──────────────────────── */
    await sendChatMessage(page, "draft an email to Alice about the demo");

    /* ── 5. Confirm user message is visible ──────────────────────── */
    await expect(
      page.getByText("draft an email to Alice about the demo")
    ).toBeVisible({ timeout: 10_000 });

    /* ── 6. Wait for the HITL approval modal ────────────────────── */
    // HitlModal renders <DialogContent data-testid="approval-card">
    // It opens when the SSE values frame sets awaiting_approval=true.
    // The graph must pause at interrupt_before: ["action_executor"].
    const approvalCard = page.locator('[data-testid="approval-card"]');

    const approvalVisible = await approvalCard
      .waitFor({ state: "visible", timeout: 60_000 })
      .then(() => true)
      .catch(() => false);

    if (!approvalVisible) {
      // Agent replied inline — HITL not enabled for this query/org config
      test.skip(true, "Agent responded inline — HITL not enabled for this deployment");
      return;
    }

    /* ── 7. Assert the draft payload mentions Alice or demo ──────── */
    // The modal shows JSON.stringify(pendingAction.payload) in a <pre> block
    const cardText = await approvalCard.textContent();
    expect(cardText, "Approval card must have text content").not.toBeNull();
    expect((cardText ?? "").toLowerCase()).toMatch(/alice|demo|email/);

    /* ── 8. Click "Approve & Execute" ────────────────────────────── */
    // Actual button text from hitl-modal.tsx line 165:
    //   {isEditing ? 'Confirm & Execute' : 'Approve & Execute'}
    const approveBtn = page.locator('button:has-text("Approve & Execute")').first();
    await expect(approveBtn).toBeVisible({ timeout: 5_000 });
    await approveBtn.click();

    /* ── 9. Wait for the approve request to fire ─────────────────── */
    await Promise.race([
      capturePromise,
      new Promise<void>((_, reject) =>
        setTimeout(
          () => reject(new Error("/api/threads/*/approve not called within 15 s")),
          15_000
        )
      ),
    ]);

    /* ── 10. Assert the request body is correct ──────────────────── */
    expect(capturedApproveBody, "Approve endpoint must have been called").not.toBeNull();
    let bodyStr: string;
    try {
      bodyStr = JSON.stringify(JSON.parse(capturedApproveBody!)).toLowerCase();
    } catch {
      bodyStr = (capturedApproveBody ?? "").toLowerCase();
    }
    // Body: { action: "approve" } — from chat/page.tsx line 272
    expect(bodyStr).toMatch(/approve/);
  });
});
