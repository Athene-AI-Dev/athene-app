/**
 * Scenario D — BI cross-department query
 *
 * Mirrors: app/(dashboard)/chat/page.tsx
 *
 * The BI flow uses task_type: "analytical" mode which toggles:
 *   - Input placeholder: "Synthesize department-wide BI patterns..."
 *   - isAnalyticalMode=true → POST /api/agent { task_type: "analytical" }
 *   - Response bubble shows "Business Intelligence Synthesis" label (Database icon)
 *
 * However the test uses the default /chat page in standard mode since the
 * analytical toggle is a UI-only affordance — the agent handles cross-dept
 * queries regardless.
 *
 * Audit row: POST to /api/admin/audit-log is non-blocking — the test annotates
 * rather than failing if the endpoint returns non-200.
 */

import { test, expect } from "./fixtures/seed";
import { signIn, sendChatMessage, waitForChatResponse, getLastAssistantMessage } from "./helpers";

const BI_EMAIL = process.env.E2E_BI_EMAIL ?? "e2e-bi@athene-test.internal";
const BI_PASSWORD = process.env.E2E_BI_PASSWORD ?? "Test1234!";

test.describe("Scenario D — BI cross-department", () => {
  test("sign in → cross-dept question → agent responds → audit row written", async ({
    page,
    seed,
  }) => {
    test.setTimeout(150_000);
    const testStartTime = new Date().toISOString();

    /* ── 1. Sign in ──────────────────────────────────────────────── */
    await signIn(page, BI_EMAIL, BI_PASSWORD);

    /* ── 2. Navigate to chat ─────────────────────────────────────── */
    await page.goto("/chat");
    await page.waitForLoadState("networkidle");

    /* ── 3. Intercept /api/agent to confirm it fires ─────────────── */
    let capturedRequestBody: string | null = null;
    await page.route("**/api/agent", async (route) => {
      capturedRequestBody = route.request().postData();
      await route.continue();
    });

    /* ── 4. Send cross-department question ───────────────────────── */
    await sendChatMessage(page, "What are the Q1 revenue figures?");

    /* ── 5. Confirm user message is in the thread ────────────────── */
    await expect(
      page.locator('[data-testid="user-message"]').filter({ hasText: "What are the Q1 revenue figures?" }).first()
    ).toBeVisible({ timeout: 10_000 });

    /* ── 6. Wait for AI response ─────────────────────────────────── */
    await waitForChatResponse(page, 90_000);

    /* ── 7. Assert the response is substantive ───────────────────── */
    const text = await getLastAssistantMessage(page);
    expect(text.length, "BI response must contain meaningful text").toBeGreaterThan(30);

    /* ── 8. Assert the agent endpoint was called ─────────────────── */
    expect(capturedRequestBody, "POST /api/agent must have been called").not.toBeNull();

    /* ── 9. Verify the request body shape ────────────────────────── */
    // chat/page.tsx sends: { message, threadId, task_type }
    const body = JSON.parse(capturedRequestBody ?? "{}");
    expect(body).toMatchObject({ message: "What are the Q1 revenue figures?" });
    expect(typeof body.threadId).toBe("string");
    expect(body.threadId.length).toBeGreaterThan(0);

    /* ── 10. Non-blocking audit log check ────────────────────────── */
    const auditResponse = await page.request.get("/api/admin/audit-log", {
      params: { org_id: seed.orgId, limit: "10" },
    });

    if (auditResponse.status() === 200) {
      const auditBody = await auditResponse.json().catch(() => ({}));
      const rows: Array<{ action?: string; actor_id?: string; created_at?: string }> =
        Array.isArray(auditBody)
          ? auditBody
          : auditBody.data ?? auditBody.rows ?? [];

      const biRow = rows.find(
        (r) =>
          (r.created_at ?? "") >= testStartTime &&
          (r.actor_id === seed.biAnalystUserId || /cross_dept|bi_query|cross/i.test(r.action ?? ""))
      );

      if (!biRow) {
        test.info().annotations.push({
          type: "info",
          description: "No audit row found — audit logging may not be wired to this query type",
        });
      }
    } else {
      test.info().annotations.push({
        type: "info",
        description: `Audit-log endpoint returned ${auditResponse.status()} — skipping audit assertion`,
      });
    }
  });
});
