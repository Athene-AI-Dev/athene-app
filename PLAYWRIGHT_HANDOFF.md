# Playwright E2E Handoff — Athene App

## What This Is

A strategy document for writing Playwright specs that verify every module of the Athene app works end-to-end. The app is a multi-tenant enterprise AI assistant. Tests must cover auth, knowledge retrieval, the LangGraph agent, HITL approval, BI access control, knowledge graph, integrations, and admin flows.

---

## Repo Structure (test-relevant)

```
tests/e2e/
  playwright.config.ts     # runs `pnpm dev`, chromium only, 4 workers, 90s timeout
  fixtures/seed.ts         # Playwright fixture: seeds DB via service role key, exports `test`
  *.spec.ts                # one file per scenario
tests/security/graph/      # Jest isolation tests (not Playwright)
tests/load/                # k6 load scripts (not Playwright)
```

All specs import `test` from `./fixtures/seed` — NOT from `@playwright/test` directly. This ensures the seed fixture runs before every test.

---

## Auth Model

Three Clerk roles, each needs real Clerk test-mode credentials set as GitHub secrets and in `.env.local`:

| Role | Secret pair | Access |
|------|-------------|--------|
| `admin` | `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | All routes + admin panel |
| `member` | `E2E_MEMBER_EMAIL` / `E2E_MEMBER_PASSWORD` | `/chat` only, own org docs |
| `bi_analyst` / `super_user` | `E2E_BI_EMAIL` / `E2E_BI_PASSWORD` | Cross-dept retrieval |

Sign-in pattern (same in every spec):
```typescript
await page.goto("/sign-in");
await page.locator('input[name="emailAddress"], input[type="email"]').first().fill(EMAIL);
await page.locator('input[name="password"], input[type="password"]').first().fill(PASSWORD);
await page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("Sign in")').first().click();
await page.waitForURL(/\/chat/, { timeout: 30_000 });
```

---

## Seed Fixture — How It Works

`fixtures/seed.ts` creates a Supabase client with `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS) and upserts deterministic rows before each test. Stable UUIDs make re-runs idempotent.

Key seed constants:
```typescript
SEED.orgId     = "00000000-seed-0000-0000-000000000001"
SEED.adminUserId   = "user_seed_admin"    // Clerk user ID (string)
SEED.memberUserId  = "user_seed_member"
SEED.biAnalystUserId = "user_seed_bi"
```

Seeded data:
- 3 documents: `Refund Policy` (notion), `Sales Handbook` (notion), `BI Metrics Guide` (snowflake)
- 2 KG nodes: `Payment Gateway` (component) → `Stripe` (service) via `DEPENDS_ON` edge
- Synthetic audit rows for BI assertions

**To add new seeded data**: add to `FIXTURE_DOCS` / `FIXTURE_NODES` / `FIXTURE_EDGES` in `seed.ts` and bump the upsert blocks in `seedDocs()` / `seedKgNodes()`.

---

## Modules to Cover — Spec Map

| Scenario | File | Role | What It Proves |
|----------|------|------|----------------|
| A | `admin-onboarding.spec.ts` | admin | Org created, member invited, onboarding wizard completes |
| B | `member-search.spec.ts` | member | Vector search hits seeded doc, response renders with citation |
| C | `email-approval.spec.ts` | member | Agent drafts email → HITL approval UI appears → approve → action_executor runs |
| D | `bi-cross-dept.spec.ts` | bi_analyst | Cross-dept query routed to `cross_dept_retrieval`, audit row written |
| E | `briefing.spec.ts` | admin | Morning briefing endpoint returns structured summary |
| F | `graph-citations.spec.ts` | member | KG traversal: "What does Payment Gateway depend on?" → Stripe in answer |

**Missing specs to write** (not yet covered):

| Module | What to test |
|--------|-------------|
| Integrations page | Connect flow opens Nango ConnectUI; ResourceBrowser renders for google_drive/powerbi |
| Knowledge graph admin | `/admin/graph` nodes/edges visible; department filter works |
| Sync worker | POST `/api/worker/nango-fetch` with valid HMAC returns 200; document row created |
| KG build worker | POST `/api/worker/graph-build` triggers extraction; `kg_nodes` row appears |
| Causal chain | Ask "what happened to [entity]?" → causal_chain type in retrieved_chunks |
| Planner | Long cross-dept query → logs show `[planner] Query decomposed` (check SSE stream) |
| HITL reject | Agent drafts email → reject button → action_executor does NOT run |
| Role guard | Log in as `member` → ask cross-dept question → response never calls `cross_dept_retrieval` |
| RLS isolation | Two orgs seeded → member of org A cannot see org B docs in any response |

---

## Writing a New Spec — Template

```typescript
import { test, expect } from "./fixtures/seed";

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "fallback@athene-test.internal";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Test1234!";

test.describe("Scenario X — <name>", () => {
  test("<what it asserts>", async ({ page, seed }) => {
    test.setTimeout(120_000); // always override — default 90s is tight with AI calls
    void seed;                // ensures seed fixture ran

    // 1. Sign in
    await page.goto("/sign-in");
    // ... sign-in pattern above ...

    // 2. Navigate
    await page.goto("/target-route");
    await page.waitForLoadState("networkidle");

    // 3. Trigger action
    // ...

    // 4. Assert
    // For AI responses: wait up to 60s, match semantic content not exact strings
    const bubble = page.locator('[data-testid="assistant-message"]')
      .filter({ hasText: /keyword/i }).first();
    await expect(bubble).toBeVisible({ timeout: 60_000 });
  });
});
```

**Rules:**
- Always `test.setTimeout(120_000)` — AI calls take 10–40s
- Always `void seed` — marks fixture as intentionally used
- Match AI responses with `/regex/i` not exact strings — LLM output varies
- Use `data-testid` selectors first, fall back to semantic HTML only if missing
- Never assert on text that appears in the user's own message bubble — scope to `[data-role="assistant"]`
- Worker/API tests: call via `page.request.post()` with `SUPABASE_SERVICE_ROLE_KEY` in header, assert response status + DB row via supabaseAdmin

---

## Worker / API Spec Pattern

For background workers that don't have a UI, use Playwright's `request` context:

```typescript
test("graph-build worker processes seeded doc", async ({ request, seed }) => {
  void seed;
  const res = await request.post("/api/worker/graph-build", {
    headers: {
      "x-qstash-signature": "test-bypass", // only works in test mode
      "Content-Type": "application/json",
    },
    data: { orgId: SEED.orgId, documentIds: ["doc-refund-policy"] },
  });
  expect(res.status()).toBe(200);

  // Verify side-effect in DB
  const { data } = await supabaseAdmin
    .from("kg_nodes")
    .select("id")
    .eq("org_id", SEED.orgId)
    .limit(1);
  expect(data?.length).toBeGreaterThan(0);
});
```

---

## CI / Environment

**GitHub Actions** (`.github/workflows/e2e.yml`):
- Node 22 (required — Supabase realtime needs native WebSocket)
- `pnpm dev` starts as webServer; tests hit `http://localhost:3000`
- Secrets that must be set in `Athene-AI-Dev/athene-app` → Settings → Secrets:
  - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
  - `SUPABASE_DB_URL` (direct Postgres URL for LangGraph checkpointer)
  - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - `QSTASH_TOKEN`, `NANGO_SECRET_KEY`, `OPENAI_API_KEY`
  - `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`
  - `E2E_MEMBER_EMAIL`, `E2E_MEMBER_PASSWORD`
  - `E2E_BI_EMAIL`, `E2E_BI_PASSWORD`

**Local**: copy `.env.local`, run `pnpm exec playwright test --config=tests/e2e/playwright.config.ts`

---

## Key Pitfalls (already hit)

| Pitfall | Fix |
|---------|-----|
| `createClient` crashes with "Node 20 WebSocket" | CI must use Node 22 (already fixed in workflow) |
| `statusConfig[integration.status]` crashes on `'active'` status | `?? statusConfig['connected']` fallback (already fixed) |
| Test matches user's own message bubble | Scope assertions to `[data-role="assistant"]` or `data-testid="assistant-message"` |
| AI response timing out at 90s | Override to `120_000` per spec |
| Seeded Clerk users don't exist in Clerk | Must create them manually in Clerk dashboard test mode, then set secrets |
| `E2E_CLERK_OTP` empty | `admin-onboarding.spec.ts` skips the OTP branch gracefully if absent — leave it |

---

## Data Flow to Understand Before Writing Specs

```
User message → POST /api/agent/stream (SSE)
  → getAgentGraph() [LangGraph]
    → supervisor → planner? → retrieval → synthesis → END
      retrieval: vectorSearchTool + graphQueryTool + findNodesTool + graphTraversalTool + causalChainTool
      synthesis: dept-aware prompt (VERTICAL_MODULES)
  → chunks streamed as SSE events: type="chunk"|"cited_sources"|"done"

Indexing: POST /api/worker/nango-fetch (QStash)
  → fetchChunks() [integration fetcher]
  → indexDocument() → document_embeddings rows
  → POST /api/worker/graph-build (QStash)
    → extractEntitiesAndRelations() → upsertGraph()
    → extractAndUpsertEvents() [fire-and-forget]
```

The SSE stream is the most important assertion surface. Specs that want to verify agent routing can intercept SSE via `page.on('response', ...)` and parse the event stream.
