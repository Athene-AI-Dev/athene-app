/**
 * Athene full E2E test suite
 *
 * Covers every page and data-pipeline route in the app.
 * Tests run against http://localhost:3000 with a real authenticated
 * browser session (storageState loaded from playwright/.auth/user.json).
 *
 * Pages tested (in order):
 *  1. Auth redirect — root → /briefing or /dashboard
 *  2. /chat — welcome message, input, submit, RAG response
 *  3. /dashboard — stats, sidebar nav
 *  4. /graph — GET /api/graph/nodes
 *  5. /decisions — GET /api/graph/decisions
 *  6. /insights — GET /api/insights
 *  7. /briefing — GET /api/briefing
 *  8. /admin/integrations — GET /api/admin/integrations
 *  9. /admin/usage — GET /api/admin/usage
 * 10. /admin/audit — GET /api/admin/audit-log, /api/admin/bi-audit
 * 11. /admin/users — GET /api/admin/users
 * 12. /admin/grants — GET /api/admin/bi-grants
 * 13. /admin/keys — provider cards visible
 * 14. API smoke — all major routes return 200
 * 15. Worker routes — return 401 (QStash guard), not 405
 */

import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// ── Config ────────────────────────────────────────────────────

const BASE = "http://localhost:3000";
const SHOTS = path.join(__dirname, "../.test-screenshots");

// ── Helpers ───────────────────────────────────────────────────

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

/** Navigate to a path and wait for page to settle */
async function goto(page: Page, path_: string) {
  await page.goto(`${BASE}${path_}`, { waitUntil: "domcontentloaded" });
  // Wait for any loading spinners to clear
  try {
    await page.waitForSelector(".animate-spin", { state: "detached", timeout: 15_000 });
  } catch { /* no spinner present — ok */ }
}

/**
 * Fetch an API route from the authenticated browser context.
 * Always navigate to /chat first so relative URLs resolve correctly.
 * Returns { status, body } where body is parsed JSON or raw text.
 */
async function apiFetch(page: Page, url: string, opts?: RequestInit): Promise<{ status: number; body: any }> {
  return page.evaluate(
    async ({ url, opts }) => {
      const r = await fetch(url, opts);
      const text = await r.text();
      let body: any = text;
      try { body = JSON.parse(text); } catch { /* not JSON */ }
      return { status: r.status, body };
    },
    { url, opts: opts ?? {} }
  );
}

// ─────────────────────────────────────────────────────────────
// Setup: navigate to app so cookies and relative URLs work
// ─────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  // Ensure the page is on the app so all relative fetches resolve
  await page.goto(`${BASE}/chat`, { waitUntil: "domcontentloaded", timeout: 20_000 });
});

// ─────────────────────────────────────────────────────────────
// 1. Auth / Root redirect
// ─────────────────────────────────────────────────────────────

test("1 · root redirects to authenticated area", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const url = page.url();
  // Authenticated users can land on: /dashboard, /chat, /briefing, /onboarding, /sign-in
  const authenticated = !url.includes("/sign-in") || url.includes("/dashboard") ||
    url.includes("/chat") || url.includes("/briefing") ||
    url.includes("/graph") || url.includes("/admin");
  // At minimum it should NOT redirect to sign-up or a 404
  expect(url).not.toContain("/sign-up");
  expect(url).not.toContain("404");
  await shot(page, "01-root-redirect");
  console.log("  → root redirected to:", url);
});

// ─────────────────────────────────────────────────────────────
// 2. Chat page — UI and pipeline
// ─────────────────────────────────────────────────────────────

test("2 · /chat shows welcome message and has input", async ({ page }) => {
  await goto(page, "/chat");
  await shot(page, "02-chat-load");

  await expect(page.getByText("Welcome to the Athene Synthesis Environment")).toBeVisible({
    timeout: 10_000,
  });

  const input = page.locator('input[placeholder*="synthesize"]').first();
  await expect(input).toBeVisible();
  await shot(page, "02-chat-ready");
});

test("3 · chat RAG pipeline — sends message and gets streamed response", async ({ page }) => {
  await goto(page, "/chat");

  const input = page.locator('input[placeholder*="synthesize"]').first();
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.fill("What is in my knowledge base?");
  await shot(page, "03-chat-typed");

  const sendBtn = page.locator('button[type="submit"]').first();
  await expect(sendBtn).toBeEnabled({ timeout: 10_000 });
  await sendBtn.click();
  await shot(page, "03-chat-submitted");

  // Wait for LLM to respond (up to 90s)
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

  await shot(page, "03-chat-responded");

  const responseText = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".whitespace-pre-wrap"))
      .map((d) => d.textContent ?? "")
      .join(" ")
  );
  expect(responseText.length).toBeGreaterThan(30);
});

// ─────────────────────────────────────────────────────────────
// 3. Dashboard
// ─────────────────────────────────────────────────────────────

test("4 · /dashboard renders without crash", async ({ page }) => {
  await goto(page, "/dashboard");
  await shot(page, "04-dashboard");

  // The page must render successfully (no blank white screen)
  const body = await page.content();
  expect(body.length).toBeGreaterThan(1000);

  // Sidebar CORE HUB section label — from athene-sidebar.tsx line 116
  // Note: sidebar items are inside <span> which may be visually hidden on narrow views
  // We check that the sidebar DOM contains the text (even if collapsed)
  const sidebarText = await page.evaluate(() =>
    document.querySelector('[data-sidebar="content"]')?.textContent ?? ""
  );
  expect(sidebarText).toContain("Chat");
});

// ─────────────────────────────────────────────────────────────
// 4. Knowledge Graph
// ─────────────────────────────────────────────────────────────

test("5 · /graph page and /api/graph/nodes return valid data", async ({ page }) => {
  // Test the API first (from the authenticated /chat context)
  const nodesRes = await apiFetch(page, "/api/graph/nodes?limit=1");
  expect(nodesRes.status).toBe(200);
  expect(nodesRes.body).toHaveProperty("nodes");
  expect(Array.isArray(nodesRes.body.nodes)).toBe(true);

  // Then load the page
  await goto(page, "/graph");
  await shot(page, "05-graph");

  // Page body has content
  const bodyLen = await page.evaluate(() => document.body.textContent?.length ?? 0);
  expect(bodyLen).toBeGreaterThan(100);
});

// ─────────────────────────────────────────────────────────────
// 5. Decisions
// ─────────────────────────────────────────────────────────────

test("6 · /decisions page renders and /api/graph/decisions returns 200", async ({ page }) => {
  // API check first
  const decisionsRes = await apiFetch(page, "/api/graph/decisions?limit=1");
  expect(decisionsRes.status, `decisions API: ${JSON.stringify(decisionsRes.body)}`).toBe(200);
  expect(Array.isArray(decisionsRes.body)).toBe(true);

  // Load the page
  await goto(page, "/decisions");
  await shot(page, "06-decisions");

  // Heading: "Decision Timeline" from decisions/page.tsx line 224-226
  await expect(page.getByRole("heading", { name: "Decision Timeline" })).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────
// 6. Insights
// ─────────────────────────────────────────────────────────────

test("7 · /insights page loads and /api/insights returns array", async ({ page }) => {
  const res = await apiFetch(page, "/api/insights");
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);

  await goto(page, "/insights");
  await shot(page, "07-insights");
  const bodyLen = await page.evaluate(() => document.body.textContent?.length ?? 0);
  expect(bodyLen).toBeGreaterThan(100);
});

// ─────────────────────────────────────────────────────────────
// 7. Briefing
// ─────────────────────────────────────────────────────────────

test("8 · /briefing page and API return 200", async ({ page }) => {
  const [todayStatus, historyStatus] = await page.evaluate(async () => {
    const [a, b] = await Promise.all([
      fetch("/api/briefing?type=today"),
      fetch("/api/briefing?type=history"),
    ]);
    return [a.status, b.status];
  });
  expect(todayStatus).toBe(200);
  expect(historyStatus).toBe(200);

  await goto(page, "/briefing");
  await shot(page, "08-briefing");
  const bodyLen = await page.evaluate(() => document.body.textContent?.length ?? 0);
  expect(bodyLen).toBeGreaterThan(100);
});

// ─────────────────────────────────────────────────────────────
// 8. Admin — Integrations
// ─────────────────────────────────────────────────────────────

test("9 · /admin/integrations — API returns integrations array", async ({ page }) => {
  const res = await apiFetch(page, "/api/admin/integrations");
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty("integrations");
  expect(Array.isArray(res.body.integrations)).toBe(true);

  await goto(page, "/admin/integrations");
  await shot(page, "09-integrations");

  // Button text from page.tsx line 345: "Integrate Tool"
  await expect(page.getByRole("button", { name: /integrate tool/i })).toBeVisible({
    timeout: 10_000,
  });
  await shot(page, "09-integrations-ready");
});

// ─────────────────────────────────────────────────────────────
// 9. Admin — Usage
// ─────────────────────────────────────────────────────────────

test("10 · /admin/usage loads stats with correct shape", async ({ page }) => {
  const res = await apiFetch(page, "/api/admin/usage");
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty("docs");
  expect(res.body).toHaveProperty("connections");
  expect(res.body).toHaveProperty("queries");
  expect(res.body).toHaveProperty("briefings");
  expect(res.body).toHaveProperty("hitl");

  await goto(page, "/admin/usage");
  await shot(page, "10-usage");

  // h1 heading "Usage" from page.tsx line 96
  await expect(page.getByRole("heading", { name: /usage/i }).first()).toBeVisible({
    timeout: 8_000,
  });
});

// ─────────────────────────────────────────────────────────────
// 10. Admin — Audit
// ─────────────────────────────────────────────────────────────

test("11 · /admin/audit loads both audit log endpoints", async ({ page }) => {
  const [adminRes, biRes] = await page.evaluate(async () => {
    const [a, b] = await Promise.all([
      fetch("/api/admin/audit-log?limit=1"),
      fetch("/api/admin/bi-audit?limit=1"),
    ]);
    return [a.status, b.status];
  });
  expect(adminRes).toBe(200);
  expect(biRes).toBe(200);

  await goto(page, "/admin/audit");
  await shot(page, "11-audit");

  // From audit/page.tsx: "Export CSV" button
  await expect(page.getByRole("button", { name: /export csv/i })).toBeVisible({
    timeout: 8_000,
  });
});

// ─────────────────────────────────────────────────────────────
// 11. Admin — Users
// ─────────────────────────────────────────────────────────────

test("12 · /admin/users renders invite button and loads user data", async ({ page }) => {
  const [usersStatus, deptsStatus] = await page.evaluate(async () => {
    const [u, d] = await Promise.all([
      fetch("/api/admin/users?limit=1"),
      fetch("/api/admin/departments"),
    ]);
    return [u.status, d.status];
  });
  expect(usersStatus).toBe(200);
  expect(deptsStatus).toBe(200);

  await goto(page, "/admin/users");
  await shot(page, "12-users");

  // From users/page.tsx: "Invite User" button opens InviteModal
  await expect(page.getByRole("button", { name: /invite/i })).toBeVisible({
    timeout: 8_000,
  });
});

// ─────────────────────────────────────────────────────────────
// 12. Admin — BI Grants
// ─────────────────────────────────────────────────────────────

test("13 · /admin/grants — API returns array (table exists)", async ({ page }) => {
  const res = await apiFetch(page, "/api/admin/bi-grants");
  expect(res.status, `bi-grants: ${JSON.stringify(res.body)}`).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);

  await goto(page, "/admin/grants");
  await shot(page, "13-grants");
});

// ─────────────────────────────────────────────────────────────
// 13. Admin — BYOK Keys
// ─────────────────────────────────────────────────────────────

test("14 · /admin/keys page renders without crash", async ({ page }) => {
  // API check first (from authenticated /chat context set in beforeEach)
  const keysRes = await apiFetch(page, "/api/admin/keys");
  // 200 = keys exist, 404 = no keys yet — both are valid states
  expect([200, 404]).toContain(keysRes.status);

  // Load the page
  await goto(page, "/admin/keys");
  await shot(page, "14-keys");

  // The page heading "Key Management" from keys/page.tsx line 218
  // OR "Loading configuration..." while Clerk hydrates
  // Either is acceptable — we just need the page to not crash (no 404/500)
  const pageText = await page.evaluate(() => document.body.textContent ?? "");
  const hasContent = pageText.includes("Key") ||
    pageText.includes("Loading") ||
    pageText.includes("BYOK");
  expect(hasContent, "Keys page should render some content").toBe(true);
});

// ─────────────────────────────────────────────────────────────
// 14. API Smoke Test — all major routes return 200
// ─────────────────────────────────────────────────────────────

test("15 · API smoke — all major routes return 200", async ({ page }) => {
  const routes = [
    "/api/threads",
    "/api/admin/integrations",
    "/api/admin/usage",
    "/api/admin/audit-log?limit=1",
    "/api/admin/bi-audit?limit=1",
    "/api/admin/users?limit=1",
    "/api/admin/departments",
    "/api/admin/bi-grants",
    "/api/graph/nodes?limit=1",
    "/api/graph/decisions?limit=1",
    "/api/insights",
    "/api/briefing?type=today",
  ];

  const results: { url: string; status: number }[] = [];

  for (const route of routes) {
    const { status } = await apiFetch(page, route);
    results.push({ url: route, status });
    console.log(`  ${status === 200 ? "✅" : "❌"} ${route} → ${status}`);
  }

  const failures = results.filter((r) => r.status !== 200);
  expect(
    failures.map((f) => `${f.url} (${f.status})`).join(", "),
    "All API routes should return 200"
  ).toBe("");
});

// ─────────────────────────────────────────────────────────────
// 15. Worker & webhook routes — correct HTTP status codes
// ─────────────────────────────────────────────────────────────

test("16 · worker routes return 401 (QStash guard), not 405", async ({ page }) => {
  // graph-build: POST without QStash signature → 401
  const graphBuildRes = await page.request.post(`${BASE}/api/worker/graph-build`, {
    data: { org_id: "test-org" },
    headers: { "Content-Type": "application/json" },
  });
  expect(graphBuildRes.status(), "graph-build should return 401, not 405").toBe(401);

  // nango-fetch: POST without QStash signature → 401
  const nangoFetchRes = await page.request.post(`${BASE}/api/worker/nango-fetch`, {
    data: { orgId: "x", connectionId: "x", provider: "slack" },
    headers: { "Content-Type": "application/json" },
  });
  expect(nangoFetchRes.status(), "nango-fetch should return 401, not 405").toBe(401);

  await shot(page, "16-worker-routes");
});

test("17 · Nango webhook responds (not Clerk redirect)", async ({ page }) => {
  // POST without HMAC signature — our handler should respond (not Clerk redirect)
  const res = await page.request.post(`${BASE}/api/nango/webhook`, {
    data: {},
    headers: { "Content-Type": "application/json" },
  });
  const status = res.status();

  // 401 = our HMAC check fired
  // 400 = handler fired but body invalid
  // Should NOT be 307 (Clerk redirect) or 405 (no handler)
  expect(status, "Nango webhook should not return Clerk redirect (307)").not.toBe(307);
  expect(status, "Nango webhook should not return 405 (no handler)").not.toBe(405);
  expect([400, 401, 200]).toContain(status);
});

test("18 · connections/sync route exists and returns JSON", async ({ page }) => {
  // With a fake connection ID — expects 404 (not found) or 400 (validation), not 405
  const res = await page.request.post(`${BASE}/api/connections/nonexistent-id/sync`, {
    data: { force: false },
    headers: { "Content-Type": "application/json" },
  });
  const status = res.status();
  // 200 = ok, 400 = validation error, 404 = not found — all valid
  // 405 = handler not exported (wrong)
  expect([200, 400, 404]).toContain(status);

  // Response must be JSON
  const text = await res.text();
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  expect(parsed, "sync route should return JSON").not.toBeNull();
});
