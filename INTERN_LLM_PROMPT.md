# Athene Repo Exploration Prompt
# Give this file + INTERN_HANDOFF.md + the repo to any LLM to assign and debug 1/4 of the work.

---

## INSTRUCTIONS FOR THE LLM

You are being onboarded as an engineering intern assistant for the **Athene** AI platform — a Next.js 16 + LangGraph + Supabase product that lets organizations query their connected data sources via a multi-agent pipeline.

You have been given:
1. This prompt (defines your scope and rules)
2. `INTERN_HANDOFF.md` (the full codebase map — read it completely before doing anything)
3. Access to the repository at `athene-app/` (read every file in your assigned section before proposing changes)

---

## STEP 1 — Read the handoff document fully

Before touching any code, read `INTERN_HANDOFF.md` from top to bottom. Pay attention to:

- **Part 1** — the annotated directory tree. Every file is marked REAL, PARTIAL, or STUB. Know which files are live before you try to test them.
- **Part 2** — the five data pipeline diagrams. Understand the full flow before you touch any single node in it.
- **Part 3** — the known issues list. These are confirmed bugs, not guesses.
- **Part 4** — your assigned section (determined in Step 2 below).

---

## STEP 2 — Claim your quarter

The work is divided into four quarters. Read all four descriptions, then pick exactly one. Do not overlap with another session that has already claimed a quarter.

### Quarter A — Auth, RLS & User Management
**Files in scope:**
```
lib/auth/rbac.ts
lib/supabase/rls-client.ts
app/api/admin/users/route.ts
app/api/admin/users/[id]/route.ts
app/(dashboard)/admin/users/page.tsx
supabase/migrations/ (all auth-related migrations)
```
**Your job:**
1. Trace every request path from HTTP header → Clerk token → internal org_id → RLS policy. Draw the full chain as a numbered list.
2. Find where the chain can be broken: missing `.eq('org_id', ...)` guards, missing `active` checks, routes that call `supabaseAdmin` when they should use `withRLS()`.
3. Verify the Clerk role sync in `app/api/admin/users/[id]/route.ts` — does it call `clerkClient().organizations.updateOrganizationMembership`? If not, implement it.
4. Check every `console.log` / `console.warn` call in auth files — convert to `logger.warn` / `logger.error` from `@/lib/logger`.
5. Look for any route that reads user data without first verifying `context.role === 'admin'` for admin-only operations.
6. Report: for each file, list (a) what works, (b) what is broken or missing, (c) exact line numbers.

---

### Quarter B — Knowledge Graph Pipeline
**Files in scope:**
```
lib/knowledge-graph/types.ts
lib/knowledge-graph/extractor.ts
lib/knowledge-graph/extractor-prompt.ts
lib/knowledge-graph/builder.ts
lib/knowledge-graph/storage.ts
lib/knowledge-graph/community.ts
lib/knowledge-graph/modules/registry.ts
lib/knowledge-graph/modules/resolver.ts
app/api/graph/ (all routes)
supabase/migrations/ (KG-related)
```
**Your job:**
1. Walk the KG build pipeline end-to-end: `builder.ts → extractor.ts → storage.ts`. For each step, verify: (a) correct input type, (b) no silent null returns, (c) Supabase upsert uses the right conflict key.
2. In `extractor.ts` — does `llmExtract` retry on JSON parse failure? If not, add a retry with a JSON reminder in the prompt (attempt 0: normal; attempt 1: prepend "Return ONLY valid JSON").
3. In `builder.ts` — does it read chunk text from `document_embeddings.metadata->>'chunk_text'`? Or does it re-fetch from the live source? If it re-fetches, rewrite it to use the stored chunks.
4. In `storage.ts` — verify `upsertNodes` uses `onConflict: 'org_id,label,entity_type'`. Verify `upsertEdges` references node IDs from `nodeIdMap`, not raw labels.
5. In `community.ts` — verify the union-find algorithm never reads from the full org's graph in one query (it must paginate). Check for missing `.eq('org_id', orgId)` scoping.
6. Check `app/api/graph/decisions/route.ts` and `app/api/graph/timeline/route.ts` — do they exist? If not, create them (spec in INTERN_HANDOFF.md Part 2).
7. Report: list each file, status, and any specific line-level bugs found.

---

### Quarter C — Indexing, Connections & Background Jobs
**Files in scope:**
```
lib/integrations/indexing.ts
lib/integrations/base.ts
lib/integrations/bi-chunking.ts
app/api/connections/route.ts
app/api/connections/[id]/route.ts
app/api/nango/webhook/route.ts
app/api/qstash/graph-build/route.ts
app/api/qstash/briefing/route.ts
app/api/admin/automations/route.ts
```
**Your job:**
1. Trace a document from Nango webhook → `indexDocument` → `document_embeddings` upsert. Verify: (a) the webhook verifies the Nango HMAC signature, (b) the indexing call is idempotent (content hash dedup), (c) QStash re-enqueues are guarded against infinite loops.
2. In `indexing.ts` — does `upsertDocumentRecord` compute `content_hash` before embedding and skip re-embedding if the hash matches? If not, implement it.
3. In `app/api/nango/webhook/route.ts` — does it call `verifyWebhookSignature` from the Nango SDK? If it skips verification, flag it as a critical security gap and add the check.
4. In `app/api/qstash/graph-build/route.ts` — check the `MAX_DEPTH` guard. Verify it returns HTTP 200 (not 500) when depth is exceeded, otherwise QStash will retry forever.
5. Check `app/api/admin/automations/route.ts` — does a POST create an automation in the DB? Or is it a stub? If stub, implement the DB write.
6. Check `bi-chunking.ts` — does `extractSchemaEntities` produce output that is actually consumed somewhere? Trace the caller chain.
7. Report: list each file, actual behavior vs expected, and the exact fix needed.

---

### Quarter D — Frontend, Chat & Briefing UI
**Files in scope:**
```
app/(dashboard)/chat/page.tsx
app/(dashboard)/briefing/page.tsx
app/(dashboard)/files/page.tsx
app/(dashboard)/builder/page.tsx
app/(dashboard)/graph/page.tsx
app/(dashboard)/insights/page.tsx
app/(dashboard)/decisions/page.tsx (may not exist yet)
components/athene-sidebar.tsx
app/api/agent/route.ts
app/api/threads/route.ts
app/api/briefing/route.ts
```
**Your job:**
1. In `chat/page.tsx` — does the thread sidebar load previous threads via `GET /api/threads`? Does sending a message create a new thread or always use a hardcoded ID? Trace the full message → SSE → state update flow.
2. In `briefing/page.tsx` — does the polling loop have a timeout? What happens at 90 seconds if no response? Add a `pollingTimedOut` state that shows a retry button.
3. In `files/page.tsx` — is the delete action wired to an API call? Does it optimistically remove the file from UI, then confirm on success? Check for incorrect toast messages (e.g. `toast.error` on success).
4. In `builder/page.tsx` — which toolbar buttons are stubs? Wrap them in `<Tooltip>` with "coming soon" rather than calling `toast.success` for fake actions.
5. In `graph/page.tsx` and `insights/page.tsx` — do they render real data? Or are they entirely hardcoded placeholders? If placeholder, document exactly what API call they should make.
6. In `app/api/agent/route.ts` — is there an org-level rate limit (separate from per-user)? If not, add one at 100 req/min using the Redis rate limiter at `lib/redis/rate-limit.ts`.
7. For `decisions/page.tsx` — does it exist? If not, create a basic page that fetches from `/api/graph/decisions` and renders a timeline list.
8. Report: list each file, working vs stub, and exact line numbers for any broken UI interactions.

---

## STEP 3 — Exploration rules (apply to all quarters)

**Before writing any code, read first.** For each file in your scope:
```
1. Read the full file
2. Identify: imports, exported functions, any TODO/FIXME/STUB comments
3. Trace every function call to its definition — don't assume a function does what its name suggests
4. Check the Supabase query: does it have .eq('org_id', ...) scope? Does it handle the error case?
5. Check the return type: does the caller handle null / empty array?
```

**Stub detection pattern.** A function is a stub if any of these are true:
- It always returns a hardcoded value
- It calls `toast.success` without making an API call
- It has a `// TODO` comment
- It `console.log`s "not implemented"
- It exists in the file system but its route handler returns HTTP 200 with `{ message: "ok" }` and no DB operation

**Dead gateway detection pattern.** A route is a dead gateway if:
- The frontend calls it, but the handler does nothing with the body
- It reads from a table that has no rows (check with a Supabase query)
- It returns data but no UI component renders it

**Silent failure detection pattern.** A silent failure is:
- A `catch (err) {}` block with no logging
- A Supabase query where `error` is destructured but never checked
- A `Promise.all` where one rejection would kill the others without being caught individually

---

## STEP 4 — Output format

After your exploration, produce a report in this exact format:

```
## QUARTER [A/B/C/D] REPORT

### Files Audited
| File | Status | Issues Found |
|------|--------|--------------|
| path/to/file.ts | REAL/PARTIAL/STUB | brief summary |

### Confirmed Bugs (fix these)
For each bug:
- **File:** path + line number
- **Type:** stub / dead gateway / silent failure / security gap / logic error
- **Current behavior:** what it does now
- **Expected behavior:** what it should do
- **Fix:** exact code change or clear description

### Stubs (document but don't fix)
List stubs that are out of your quarter's scope.

### Questions / Blockers
List anything you couldn't determine from reading the code alone.
```

---

## STEP 5 — After reporting, fix what you can

Fix bugs that are:
- Entirely within your quarter's files
- Self-contained (don't require schema changes or new API routes to be useful)
- TypeScript-safe (run `npx tsc --noEmit` before and after — zero errors required)

For each fix, write a commit message in this format:
```
Fix [brief description] in [file]

[one sentence explaining the root cause]
[one sentence explaining the fix]
```

Do NOT fix bugs in other quarters' files. Flag them as cross-quarter and leave them for the other intern.

---

## IMPORTANT CONSTRAINTS

- **Never use `supabaseAdmin` in user-facing routes** unless the handoff document explicitly notes the route uses service-role. Use `withRLS(context)` instead.
- **Never log sensitive data** — no JWT tokens, no raw user content, no Nango connection secrets.
- **Never commit `.env` changes** — environment variables are set in Vercel, not in code.
- **TypeScript strict mode is on** — no `any` unless the existing code already used it there.
- **The DB schema is in `supabase/migrations/`** — read the migrations before assuming a column exists.
- **QStash routes must return HTTP 200 even on handled errors** — returning 500 causes infinite retries.

---

## Quick reference: key files every quarter needs to know

| Concept | File |
|---------|------|
| Auth context extraction | `lib/supabase/rls-client.ts` → `getContextFromHeaders()` |
| RLS-scoped Supabase client | `lib/supabase/rls-client.ts` → `withRLS(context)` |
| Logger (use this, not console) | `lib/logger.ts` |
| Rate limiter | `lib/redis/rate-limit.ts` → `rateLimit(key, limit, windowSecs)` |
| Redis client | `lib/redis/client.ts` |
| LLM factory | `lib/langgraph/llm-factory.ts` → `resolveModelClient('fast'|'medium'|'large', orgId)` |
| Embedding factory | `lib/ai/embedding-factory.ts` → `embedBatch(texts, orgId)` |
| KG types | `lib/knowledge-graph/types.ts` |
| LangGraph state | `lib/langgraph/state.ts` |
| QStash publisher | `lib/qstash/publisher.ts` |

---

*Generated 2026-05-14. Repository: `athene-app/` on branch `claude/production-hardening`.*
*Handoff document: `INTERN_HANDOFF.md` (1064 lines). Full audit covered commits up to `881527c`.*
