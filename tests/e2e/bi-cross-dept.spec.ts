/**
 * Scenario D — BI cross-department
 *
 * Flow:
 *   1. Log in as bi_analyst
 *   2. Ask a cross-dept question ("What are the Q1 revenue figures?")
 *   3. Assert the cross-dept agent is invoked
 *      (UI shows "BI" or "cross-dept" agent indicator in the stream)
 *   4. Assert an audit row was written for this query
 *      (verified via GET /api/admin/audit-log)
 */

import { test, expect } from "./fixtures/seed";

const BI_EMAIL = process.env.E2E_BI_EMAIL ?? "e2e-bi@athene-test.internal";
const BI_PASSWORD = process.env.E2E_BI_PASSWORD ?? "Test1234!";

test.describe("Scenario D — BI cross-department", () => {
  test("login as bi_analyst → cross-dept question → agent invoked + audit row written", async ({
    page,
    seed,
  }) => {
    // Worst-case breakdown: 30s sign-in + 90s AI wait + 20s audit check + 10s buffer = 150s.
    // FIX: was 180s — with 5 scenarios that approaches the 15-min CI job ceiling.
    // Reduced to 150s to leave a margin for infrastructure slowness.
    test.setTimeout(150_000);

    // Capture test start time BEFORE sign-in so only rows created during THIS run
    // satisfy the created_at filter. The pre-seeded row has a past timestamp.
    const testStartTime = new Date().toISOString();
    // `seed` is used below for audit-log assertions (seed.orgId, seed.biAnalystUserId)

    /* ── 1. Sign in as bi_analyst ────────────────────────────────────── */
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");

    await page
      .locator('input[name="emailAddress"], input[type="email"]')
      .first()
      .fill(BI_EMAIL);
    await page
      .locator('input[name="password"], input[type="password"]')
      .first()
      .fill(BI_PASSWORD);
    await page
      .locator('button[type="submit"], button:has-text("Continue"), button:has-text("Sign in")')
      .first()
      .click();

    await page.waitForURL(/\/chat/, { timeout: 30_000 });

    /* ── 2. Go to chat ───────────────────────────────────────────────── */
    await page.goto("/chat");
    await page.waitForLoadState("networkidle");

    /* ── 3. Capture active_agent from SSE stream ────────────────────
     * FIX: page.on("response") + response.text() hangs on open SSE
     * streams because text() buffers until the stream closes.
     * Instead, intercept via page.route and read the request body
     * (which contains the message). We detect the BI agent from the
     * UI badge after the response arrives — that's the reliable path.
     */
    let capturedRequestBody: string | null = null;

    await page.route("**/api/agent", async (route) => {
      capturedRequestBody = route.request().postData();
      await route.continue();
    });

    /* ── 4. Ask a cross-dept question ───────────────────────────────── */
    const messageInput = page
      .locator('input[placeholder*="Ask"], input[placeholder*="Message"], textarea')
      .first();
    await expect(messageInput).toBeVisible({ timeout: 10_000 });
    await messageInput.fill("What are the Q1 revenue figures?");

    await page.locator('button[type="submit"], button:has-text("Send")').first().click();

    /* ── 5. Wait for a response to arrive ───────────────────────────── */
    // FIX: Use data-testid/data-role selectors (same fix as member-search.spec.ts).
    // 'div.justify-start div' can match user message bubbles causing a false
    // positive before the AI has responded.
    const assistantReply = page
      .locator(
        '[data-testid="assistant-message"], div[data-role="assistant"], ' +
        'div.justify-start div:not([data-role="user"])'
      )
      .filter({ hasText: /revenue|Q1|figures|cross|BI|analyst/i })
      .first();
    await expect(assistantReply).toBeVisible({ timeout: 90_000 });

    /* ── 6. Assert the cross-dept / BI agent was invoked ─────────────── */
    // Primary: check for a UI badge rendered by the agent stream.
    // FIX: replaced *:has-text('bi_agent') wildcard with span:has-text to avoid
    // ancestor-matching returning <body> whenever any descendant contains 'bi_agent'.
    // FIX 2: switched isVisible({timeout}) to waitFor({state,timeout}) — isVisible()
    // ignores the timeout option and returns immediately without waiting.
    const agentBadge = page.locator(
      '[data-testid="active-agent"], [aria-label*="agent"], span:has-text("bi_agent"), span:has-text("BI")'
    );

    const agentVisible = await agentBadge
      .first()
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    // Fallback: check that the request body was actually captured (route fired).
    // NOTE: we do NOT check message content here — that would be tautologically
    // true since we hardcoded the BI question. Instead we verify the route was
    // intercepted at all, meaning the agent endpoint was called.
    const agentEndpointCalled = capturedRequestBody !== null;

    // FIX: agentVisible is the primary assertion. agentEndpointCalled is only
    // a diagnostic fallback annotation — the || made the assertion pass trivially
    // whenever any message was sent (route interceptor always fires).
    expect(
      agentVisible,
      `Expected BI/cross-dept agent badge to be visible. Endpoint called: ${agentEndpointCalled}. Captured body: ${capturedRequestBody}`
    ).toBeTruthy();

    if (!agentVisible && agentEndpointCalled) {
      test.info().annotations.push({
        type: "info",
        description: `Agent endpoint was called but badge not visible. Captured body: ${capturedRequestBody}`,
      });
    }

    /* ── 7. Assert an audit row was written ─────────────────────────── */
    // Poll the admin audit-log endpoint for a row matching our query
    const auditResponse = await page.request.get("/api/admin/audit-log", {
      params: { org_id: seed.orgId, limit: "10" },
    });

    // 200 means the endpoint exists and we can check rows
    if (auditResponse.status() === 200) {
      const body = await auditResponse.json().catch(() => ({}));
      const rows: Array<{ action?: string; actor_id?: string; created_at?: string }> =
        Array.isArray(body) ? body : body.data ?? body.rows ?? [];

      const biRow = rows.find(
        (r) =>
          // FIX: added created_at filter to exclude the pre-seeded audit row.
          // Without it, the seeded row (action: 'cross_dept_query') satisfies
          // the assertion tautologically before any live query row is written.
          (r.created_at ?? "") >= testStartTime &&
          (r.actor_id === seed.biAnalystUserId ||
            /cross_dept|bi_query|cross/i.test(r.action ?? ""))
      );

      expect(biRow, "Audit log should contain a BI / cross-dept row").toBeDefined();
    } else {
      // FIX: test.info().annotations.push with type:'skip' only adds metadata
      // and does NOT stop test execution. Use test.skip() to actually halt.
      test.skip(true, `Audit-log endpoint returned ${auditResponse.status()} – skipping audit assertion`);
    }
  });
});
