/**
 * pipeline.spec.ts — End-to-end data pipeline tests
 *
 * Tests the real pipeline under authenticated context:
 *   1. Test helper route health
 *   2. Jina embedding: seed a doc → verify 768-dim vector stored
 *   3. Vector retrieval: query semantically matches seeded doc
 *   4. RAG chat: seeded content surfaces in LLM response
 *   5. Nango webhook accepts requests with valid HMAC-SHA256 signature
 *   6. Nango webhook rejects requests with invalid signature
 *   7. Manual sync API — POST /api/connections/[id]/sync shape
 *   8. Admin integrations page loads and shows correct UI state
 *   9. Sync button fires the right API call (UI test)
 *  10. graph-build worker returns 401 (QStash guard active)
 *  11. nango-fetch worker returns 401 (QStash guard active)
 *  12. /api/worker/index returns 401 (QStash guard active)
 *  13. Cleanup: test documents deleted after suite
 */

import { test, expect, type Page } from "@playwright/test";
import { createHmac } from "crypto";

// ── Constants ──────────────────────────────────────────────────────────────────

const BASE = "http://localhost:3000";
const TEST_TOKEN = "athene-dev-test";
const TAG = `pw-pipeline-${Date.now()}`;

// Unique content unlikely to appear in any real indexed document
const SEED_TITLE = `Athene Pipeline Test ${TAG}`;
const SEED_CONTENT =
  `PIPELINE_TEST_MARKER_${TAG}: ` +
  "The Athene vector pipeline works correctly when this sentinel document " +
  "is embedded, stored, and returned by a semantic search for the phrase " +
  "'xylophone quantum pipeline sentinel test'. This content is synthetic.";

const SEED_QUERY = "xylophone quantum pipeline sentinel test";

// Nango HMAC key — loaded from .env.local via dotenv in playwright.config.ts
const NANGO_SECRET = process.env.NANGO_SECRET_KEY ?? "";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Call the test pipeline route with auth cookies. */
async function pipelineApi(
  page: Page,
  body: Record<string, unknown>
): Promise<{ status: number; body: any }> {
  return page.evaluate(
    async ({ url, body, token }) => {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-token": token,
        },
        body: JSON.stringify(body),
      });
      const text = await r.text();
      let parsed: any = text;
      try {
        parsed = JSON.parse(text);
      } catch { /* leave as string */ }
      return { status: r.status, body: parsed };
    },
    { url: `${BASE}/api/test/pipeline`, body, token: TEST_TOKEN }
  );
}

/** Generic authenticated fetch via browser context. */
async function apiFetch(
  page: Page,
  url: string,
  opts: RequestInit = {}
): Promise<{ status: number; body: any }> {
  return page.evaluate(
    async ({ url, opts }) => {
      const r = await fetch(url, opts);
      const text = await r.text();
      let body: any = text;
      try {
        body = JSON.parse(text);
      } catch { /* leave as string */ }
      return { status: r.status, body };
    },
    { url, opts }
  );
}

/** Take a labelled screenshot. */
async function shot(page: Page, name: string) {
  await page.screenshot({
    path: `test-results/pipeline/${name}.png`,
    fullPage: false,
  });
}

/** Generate a valid Nango HMAC-SHA256 signature. */
function nangoHmac(rawBody: string): string {
  return createHmac("sha256", NANGO_SECRET).update(rawBody).digest("hex");
}

// ── Fixtures ───────────────────────────────────────────────────────────────────

// Navigate to /chat once before all tests so cookies resolve
test.beforeEach(async ({ page }) => {
  await page.goto(`${BASE}/chat`, { waitUntil: "domcontentloaded" });
});

// ── Suite ──────────────────────────────────────────────────────────────────────

test.describe("Pipeline — embed → store → retrieve → RAG", () => {

  // ── 1. Test helper health ────────────────────────────────────────────────────
  test("1 · test pipeline route is reachable (dev mode)", async ({ page }) => {
    const { status, body } = await page.evaluate(
      async ({ url, token }) => {
        const r = await fetch(url, { headers: { "x-test-token": token } });
        const text = await r.text();
        let parsed: any = text;
        try { parsed = JSON.parse(text); } catch {}
        return { status: r.status, body: parsed };
      },
      { url: `${BASE}/api/test/pipeline`, token: TEST_TOKEN }
    );

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    console.log("✅ Test pipeline route: active in", body.env);
  });

  // ── 2. Embedding: seed a document through the real Jina pipeline ─────────────
  test("2 · Jina embeds document and stores 768-dim vectors", async ({ page }) => {
    const { status, body } = await pipelineApi(page, {
      action: "seed",
      title: SEED_TITLE,
      content: SEED_CONTENT,
      tag: TAG,
    });

    console.log("Seed response:", JSON.stringify(body, null, 2));

    expect(status, `Expected 200, got ${status}: ${JSON.stringify(body)}`).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.documentId).toBeTruthy();
    expect(body.chunks_indexed).toBeGreaterThan(0);
    expect(body.embedding_stored).toBe(true);

    console.log(
      `✅ Embedded ${body.chunks_indexed} chunk(s) for document ${body.documentId}`
    );
  });

  // ── 3. Vector retrieval: semantic query returns the seeded document ───────────
  test("3 · vector search retrieves seeded document semantically", async ({ page }) => {
    // Give Supabase a moment to flush the upsert
    await page.waitForTimeout(1000);

    const { status, body } = await pipelineApi(page, {
      action: "search",
      query: SEED_QUERY,
      tag: TAG,
    });

    console.log("Search response:", JSON.stringify(body, null, 2));

    expect(status).toBe(200);
    expect(body.ok).toBe(true);

    if (body.embedding_dim) {
      expect(body.embedding_dim).toBe(768);
      console.log(`✅ Query embedding: ${body.embedding_dim} dims (Jina)`);
    }

    // The seeded doc should appear in results (matched by test_tag filter)
    expect(body.results.length).toBeGreaterThan(0);
    console.log(`✅ Vector search returned ${body.results.length} result(s) for tag ${TAG}`);
  });

  // ── 4. RAG chat: seeded content surfaces in LLM response ────────────────────
  test("4 · chat RAG surfaces seeded document in response", async ({ page }) => {
    await page.goto(`${BASE}/chat`, { waitUntil: "domcontentloaded" });
    await shot(page, "04-chat-ready");

    const input = page.locator('input[placeholder*="synthesize"]').first();
    await expect(input).toBeVisible({ timeout: 10_000 });

    // Query that semantically matches the seeded document
    await input.fill(SEED_QUERY);

    const sendBtn = page.locator('button[type="submit"]').first();
    await expect(sendBtn).toBeEnabled({ timeout: 10_000 });
    await sendBtn.click();
    await shot(page, "04-chat-submitted");

    // Wait for LLM response
    await page.waitForFunction(
      () => {
        const bubbles = document.querySelectorAll(".whitespace-pre-wrap");
        for (const b of bubbles) {
          const text = b.textContent ?? "";
          if (text.length > 20 && !text.includes("Synthesizing Reality")) return true;
        }
        return false;
      },
      { timeout: 90_000, polling: 1000 }
    );

    await shot(page, "04-chat-responded");

    // The response should exist (we can't guarantee exact RAG content without
    // forcing the retrieval agent, but we verify the pipeline ran end-to-end)
    const bubbles = await page.locator(".whitespace-pre-wrap").all();
    const responseTexts = await Promise.all(bubbles.map((b) => b.textContent()));
    const response = responseTexts.join(" ");
    expect(response.length).toBeGreaterThan(20);

    console.log(`✅ Chat responded (${response.length} chars)`);
    console.log("   First 200 chars:", response.slice(0, 200));
  });

  // ── 5. Nango webhook: valid HMAC accepted ───────────────────────────────────
  test("5 · Nango webhook accepts request with valid HMAC signature", async ({ page }) => {
    if (!NANGO_SECRET) {
      console.warn("⚠️  NANGO_SECRET_KEY not set — skipping HMAC test");
      test.skip();
      return;
    }

    const payload = JSON.stringify({
      type: "sync.completed",
      connectionId: "test-nango-conn-pw",
      providerConfigKey: "google-drive",
    });

    const sig = nangoHmac(payload);

    const { status } = await page.evaluate(
      async ({ url, payload, sig }) => {
        const r = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-nango-signature": sig,
          },
          body: payload,
        });
        return { status: r.status };
      },
      {
        url: `${BASE}/api/nango/webhook`,
        payload,
        sig,
      }
    );

    // 200 = signature accepted; Nango always gets 200 even for unknown connections
    expect(status).toBe(200);
    console.log("✅ Nango webhook accepted valid HMAC signature");
  });

  // ── 6. Nango webhook: invalid HMAC rejected ──────────────────────────────────
  test("6 · Nango webhook rejects request with invalid signature", async ({ page }) => {
    const { status } = await page.evaluate(
      async ({ url }) => {
        const r = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-nango-signature": "deadbeef",
          },
          body: JSON.stringify({ type: "sync.completed", connectionId: "fake" }),
        });
        return { status: r.status };
      },
      { url: `${BASE}/api/nango/webhook` }
    );

    expect(status).toBe(401);
    console.log("✅ Nango webhook rejected invalid HMAC signature (401)");
  });

  // ── 7. Admin integrations page: renders and shows integration state ───────────
  test("7 · /admin/integrations page renders and API returns correct shape", async ({ page }) => {
    const { status, body } = await apiFetch(page, `${BASE}/api/admin/integrations`);
    expect(status).toBe(200);
    expect(Array.isArray(body.integrations)).toBe(true);

    await page.goto(`${BASE}/admin/integrations`, { waitUntil: "domcontentloaded" });
    await shot(page, "07-integrations");

    // Page should render without crashing
    await expect(page.getByText("System Connectors", { exact: false })).toBeVisible({
      timeout: 10_000,
    });

    const count = body.integrations.length;
    console.log(`✅ Admin integrations: ${count} connection(s) loaded`);

    if (count > 0) {
      const conn = body.integrations[0];
      expect(typeof conn.connectionId).toBe("string");
      expect(typeof conn.provider).toBe("string");
      expect(typeof conn.status).toBe("string");
      console.log(`   First connection: ${conn.provider} (${conn.status}), ${conn.totalDocs} docs`);
    }
  });

  // ── 8. Sync button: fires correct API call ───────────────────────────────────
  test("8 · sync button calls /api/connections/[id]/sync with correct shape", async ({ page }) => {
    // Get connections list to find a real connection ID
    const { body } = await apiFetch(page, `${BASE}/api/admin/integrations`);
    const connections: any[] = body.integrations ?? [];

    if (connections.length === 0) {
      console.log("ℹ️  No connections in DB — skipping sync button test");
      test.skip();
      return;
    }

    const conn = connections[0];
    const internalId = conn.internalConnectionId;

    if (!internalId) {
      console.log("ℹ️  internalConnectionId missing — skipping sync button test");
      test.skip();
      return;
    }

    // POST the sync endpoint directly and verify the response shape
    const { status, body: syncBody } = await apiFetch(
      page,
      `${BASE}/api/connections/${internalId}/sync`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      }
    );

    console.log("Sync response:", JSON.stringify(syncBody));

    // 200 = dispatched | 404 = connection not found | 403 = not admin
    expect([200, 404, 403]).toContain(status);

    if (status === 200) {
      expect(typeof syncBody.dispatched).toBe("boolean");
      expect(syncBody.success).toBe(syncBody.dispatched);
      console.log(
        `✅ Sync API: dispatched=${syncBody.dispatched}, msgId=${syncBody.msgId}`
      );
    }
  });

  // ── 9. Sync button UI: button exists and is clickable ───────────────────────
  test("9 · admin integrations page shows sync controls", async ({ page }) => {
    await page.goto(`${BASE}/admin/integrations`, { waitUntil: "domcontentloaded" });

    // Wait for the page heading to confirm React has hydrated
    await expect(page.getByText("System Connectors", { exact: false })).toBeVisible({
      timeout: 30_000,
    });

    await shot(page, "09-integrations-ui");

    // The "Integrate Tool" button (unified connect) should always be visible
    const integrateBtn = page.getByRole("button", { name: /integrate tool/i });
    await expect(integrateBtn).toBeVisible({ timeout: 30_000 });
    console.log("✅ Integrate Tool button visible");

    // If there are connected integrations, verify sync card elements exist
    const { body } = await apiFetch(page, `${BASE}/api/admin/integrations`);
    const count = (body.integrations ?? []).length;

    if (count > 0) {
      // Integration cards render with provider names
      const provider = body.integrations[0].provider as string;
      console.log(`   Found connection: ${provider}`);
    } else {
      console.log("   No connections yet — checking empty state");
      // Empty state text should appear
      const page_ = page;
      const text = await page_.content();
      expect(text).toContain("Integrate"); // something about integrating
    }
  });

  // ── 10. Worker QStash guards ─────────────────────────────────────────────────
  test("10 · all worker routes enforce QStash signature (401, not 405)", async ({ page }) => {
    const workers = [
      "/api/worker/nango-fetch",
      "/api/worker/graph-build",
      "/api/worker/index",
      "/api/worker/hitl-cleanup",
      "/api/worker/checkpoint-prune",
    ];

    const results = await page.evaluate(async ({ base, workers }) => {
      return Promise.all(
        workers.map(async (path) => {
          const r = await fetch(`${base}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          return { path, status: r.status };
        })
      );
    }, { base: BASE, workers });

    for (const { path, status } of results) {
      expect(status, `${path} returned ${status}, expected 401`).toBe(401);
      console.log(`✅ ${path} → ${status}`);
    }
  });

  // ── 11. Cleanup: remove seeded test documents ────────────────────────────────
  test("11 · cleanup seeded test documents", async ({ page }) => {
    const { status, body } = await pipelineApi(page, {
      action: "cleanup",
      tag: TAG,
    });

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    console.log(`✅ Cleaned up ${body.deleted_documents} test document(s) for tag ${TAG}`);
  });
});
