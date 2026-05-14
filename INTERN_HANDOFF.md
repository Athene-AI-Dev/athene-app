# Athene — Intern Handoff & Codebase Map
**Date:** May 2026  
**Repo:** `athene-app/` (Next.js 16, TypeScript, Supabase, LangGraph, Nango, QStash)  
**Branch to work on:** `claude/production-hardening`  
**Two fixers · Two testers — assignments at the end of this document**

---

## How to use this document

Read Part 1 (The Map) to understand the full system.  
Read Part 2 (Known Issues) to know exactly what is broken or incomplete.  
Read Part 3 (Assignments) to get your specific tasks.  
Use Part 4 (LLM Prompt) to explore further with an AI assistant and the repo.

The document is written as a **maze map** — every corridor, every dead end, every locked door, every route that looks open but leads nowhere. When you find something new, add it to your own copy.

---

# PART 1 — THE FULL CODEBASE MAP

## 1.1 Directory Tree (annotated)

```
athene-app/
│
├── app/
│   ├── (auth)/                          ← Clerk sign-in / sign-up pages [REAL]
│   ├── (dashboard)/                     ← All protected pages behind Clerk auth
│   │   ├── layout.tsx                   ← Sidebar + header wrapper [REAL]
│   │   ├── chat/page.tsx                ← Main AI chat [REAL — SSE streaming]
│   │   ├── dashboard/page.tsx           ← KPI overview [REAL]
│   │   ├── briefing/page.tsx            ← Morning briefing [REAL — polls /api/briefing]
│   │   ├── insights/page.tsx            ← BI query cards [REAL — admin/super_user only]
│   │   ├── files/page.tsx               ← Document library [REAL]
│   │   ├── graph/page.tsx               ← KG canvas + mobile list [REAL]
│   │   ├── decisions/page.tsx           ← Decision timeline [REAL]
│   │   ├── builder/page.tsx             ← Workflow designer [PARTIAL — canvas works,
│   │   │                                   toolbar buttons (select/layers/settings) 
│   │   │                                   have tooltips but no actions yet]
│   │   └── admin/
│   │       ├── users/page.tsx           ← Member management [REAL]
│   │       ├── integrations/page.tsx    ← OAuth connectors [REAL]
│   │       ├── keys/page.tsx            ← BYOK LLM keys [REAL]
│   │       ├── grants/page.tsx          ← Cross-dept access grants [REAL]
│   │       ├── audit/page.tsx           ← Audit log viewer [REAL]
│   │       └── automations/page.tsx     ← Scheduled automations [REAL]
│   │
│   └── api/
│       ├── agent/route.ts               ← LangGraph entry point [REAL — SSE stream]
│       ├── threads/
│       │   ├── route.ts                 ← GET (list) + POST (create) [REAL]
│       │   └── [id]/
│       │       ├── route.ts             ← GET thread detail [REAL]
│       │       └── approve/route.ts     ← HITL approve/reject [REAL]
│       ├── briefing/route.ts            ← GET today/history + POST trigger [REAL]
│       ├── insights/route.ts            ← Full CRUD + agent run [REAL]
│       ├── files/
│       │   ├── route.ts                 ← GET list + DELETE [REAL]
│       │   ├── upload/route.ts          ← POST multipart upload [REAL]
│       │   └── download/route.ts        ← GET file download [REAL]
│       ├── connections/
│       │   ├── route.ts                 ← GET + POST connections [REAL]
│       │   └── delete/route.ts          ← DELETE connection [REAL]
│       ├── nango/
│       │   ├── session/route.ts         ← GET embed session token [REAL]
│       │   └── webhook/route.ts         ← POST Nango sync events [PARTIAL — see §2.4]
│       ├── graph/
│       │   ├── nodes/route.ts           ← GET KG node search [REAL]
│       │   ├── edges/route.ts           ← GET KG edge query [REAL]
│       │   ├── decisions/route.ts       ← GET decision records [REAL]
│       │   ├── timeline/route.ts        ← GET entity timeline [REAL]
│       │   └── build/route.ts           ← POST manual KG build [REAL]
│       ├── dashboard_stats/route.ts     ← GET system KPIs [REAL]
│       ├── whoami/route.ts              ← GET current user context [REAL]
│       ├── user/role/route.ts           ← GET current user role [REAL]
│       ├── admin/
│       │   ├── users/
│       │   │   ├── route.ts             ← GET list + POST invite [REAL]
│       │   │   └── [id]/route.ts        ← PATCH update + DELETE [REAL]
│       │   ├── integrations/
│       │   │   ├── route.ts             ← GET + POST + DELETE [REAL]
│       │   │   └── [id]/index/route.ts  ← POST manual re-index [REAL]
│       │   ├── keys/route.ts            ← CRUD BYOK keys [REAL]
│       │   ├── grants/route.ts          ← CRUD access grants [REAL]
│       │   ├── grants/[id]/route.ts     ← DELETE grant [REAL]
│       │   ├── audit-log/route.ts       ← GET admin actions [REAL]
│       │   ├── bi-audit/route.ts        ← GET BI access log [REAL]
│       │   ├── automations/route.ts     ← GET + POST automations [REAL]
│       │   └── automations/[id]/route.ts ← PATCH + DELETE [REAL]
│       └── worker/
│           ├── morning-briefing/route.ts ← QStash briefing synthesizer [REAL]
│           ├── graph-build/route.ts      ← QStash KG builder [REAL]
│           ├── index/route.ts            ← QStash delta re-indexer [REAL — uses liveDocFetch]
│           └── nango-fetch/route.ts      ← QStash Nango data fetcher [REAL]
│
├── components/
│   ├── athene-sidebar.tsx               ← Navigation sidebar [REAL]
│   ├── ui/                              ← Radix-based design system [REAL]
│   ├── briefing/section.tsx             ← Briefing section renderer [REAL]
│   ├── automation-card.tsx              ← Automation card [REAL]
│   ├── create-automation-button.tsx     ← Automation trigger button [PARTIAL — see §2.5]
│   └── knowledge-graph/                 ← React Flow canvas components [REAL]
│
├── lib/
│   ├── auth/
│   │   ├── rbac.ts                      ← Role resolver + Redis cache [REAL — fixed]
│   │   ├── clerk.ts                     ← Role mapping (Clerk ↔ internal) [REAL]
│   │   └── cached-clerk.ts              ← Cached auth() wrapper [REAL]
│   ├── supabase/
│   │   ├── server.ts                    ← supabaseAdmin (service role) [REAL]
│   │   └── rls-client.ts                ← withRLS() wrapper [REAL]
│   ├── ai/
│   │   ├── embedding-factory.ts         ← Embed single text [REAL — throws on dim mismatch]
│   │   └── embedder.ts                  ← embed() + embedBatch() wrappers [REAL]
│   ├── langgraph/
│   │   ├── graph.ts                     ← Full agent graph definition [REAL]
│   │   ├── state.ts                     ← LangGraph state annotations [REAL — fixed]
│   │   ├── llm-factory.ts               ← BYOK LLM client resolver [REAL]
│   │   ├── nodes/
│   │   │   ├── supervisor.ts            ← Intent classifier + router [REAL]
│   │   │   ├── retrieval-agent.ts       ← Vector + KG retrieval [REAL]
│   │   │   ├── synthesis-agent.ts       ← Final answer synthesis [REAL]
│   │   │   ├── email-agent.ts           ← Email composition [REAL]
│   │   │   ├── calendar-agent.ts        ← Calendar event creation [REAL]
│   │   │   ├── report-agent.ts          ← Structured report generation [REAL]
│   │   │   └── action-executor.ts       ← HITL-gated write executor [REAL]
│   │   └── tools/
│   │       ├── registry.ts              ← Tool registry [REAL]
│   │       ├── vector-search.ts         ← vectorSearchTool [REAL]
│   │       ├── graph-query.ts           ← graphQueryTool [REAL]
│   │       ├── chunker.ts               ← Token-based chunker [REAL]
│   │       └── live-doc-fetch.ts        ← Live provider fetch [REAL — used by re-index worker]
│   ├── knowledge-graph/
│   │   ├── builder.ts                   ← KG build orchestrator [REAL — fixed]
│   │   ├── extractor.ts                 ← LLM entity extraction [REAL — fixed, retry added]
│   │   ├── extractor-prompt.ts          ← Base + decision prompts [REAL]
│   │   ├── storage.ts                   ← Node/edge upsert [REAL]
│   │   ├── community.ts                 ← Union-find community detection [REAL — paginated]
│   │   ├── types.ts                     ← KG type definitions [REAL]
│   │   ├── utils.ts                     ← Helper functions [REAL]
│   │   └── modules/
│   │       ├── registry.ts              ← Vertical module definitions [REAL]
│   │       └── resolver.ts              ← Redis-cached prompt resolver [REAL]
│   ├── integrations/
│   │   ├── base.ts                      ← FetchedChunk type + base fetcher [REAL]
│   │   ├── indexing.ts                  ← Chunk → embed → upsert [REAL — fixed, dedup]
│   │   ├── providers.ts                 ← 27-provider registry [REAL]
│   │   ├── bi-chunking.ts               ← BI/schema-aware chunker [REAL]
│   │   └── fetchers/                    ← Per-provider data fetchers [REAL — all live]
│   │       ├── gmail.ts
│   │       ├── google-drive.ts
│   │       ├── google-calendar.ts
│   │       ├── outlook.ts
│   │       ├── onedrive.ts
│   │       ├── sharepoint.ts
│   │       ├── slack.ts
│   │       ├── jira.ts
│   │       ├── confluence.ts
│   │       ├── github.ts
│   │       ├── notion.ts
│   │       ├── hubspot.ts
│   │       ├── salesforce.ts
│   │       ├── zendesk.ts
│   │       └── [warehouse fetchers — snowflake, bigquery, etc.]
│   ├── nango/
│   │   └── client.ts                    ← Token fetch + connection list [REAL]
│   ├── qstash/
│   │   ├── client.ts                    ← QStash publish + dispatchThrottled [REAL]
│   │   └── verify.ts                    ← HMAC signature + idempotency [REAL]
│   ├── redis/client.ts                  ← Redis + rateLimit + cached helpers [REAL]
│   ├── logger.ts                        ← Pino structured logger [REAL]
│   └── telemetry/spans.ts               ← OpenTelemetry span wrappers [REAL]
│
└── supabase/migrations/                 ← All DB migrations (applied in order)
    ├── 001_initial_schema.sql
    ├── 002_rls_policies.sql
    ├── ...
    └── 20260515000006_kg_extend.sql     ← Latest: kg_nodes temporal_metadata
```

---

## 1.2 Data Pipeline Map A — Document Indexing

```
TRIGGER (one of):
  Admin adds integration → POST /api/connections
  Manual sync → POST /api/admin/integrations/[id]/index
  Nango webhook → POST /api/nango/webhook

        │
        ▼
QStash enqueues /api/worker/index
        │
        ▼
worker/index/route.ts
  ├── Query documents table for doc IDs + connection info
  ├── liveDocFetch(source_type, connection_id, org_id)
  │       │
  │       └── lib/integrations/fetchers/{provider}.ts
  │               └── Nango.getToken(connectionId) → OAuth token
  │               └── Provider API call → raw content
  │               └── Returns FetchedChunk[]
  │
  ├── indexDocuments(chunks, orgId, connectionId, deptId, visibility)
  │       │
  │       ├── upsertDocumentRecord()
  │       │       ├── Compute SHA-256 of full content
  │       │       ├── Compare with documents.content_hash
  │       │       └── IF MATCH: skip → return { contentChanged: false }  ◄ DEDUP GATE
  │       │
  │       ├── chunkContent() → sentence-boundary splits (~2000 chars each)
  │       │
  │       ├── embedBatch(texts, orgId)
  │       │       └── org BYOK key → embedding provider (Jina/Nomic/OpenAI)
  │       │       └── assertDims() → throws if not exactly 768 dims
  │       │
  │       └── supabase.upsert(document_embeddings)
  │               └── onConflict: document_id, chunk_index
  │               └── metadata.chunk_text = full chunk text (zero-copy)
  │               └── content_preview = first 200 chars
  │
  └── QStash enqueues /api/worker/graph-build

RESULT: documents row + document_embeddings rows
        chunk_text available for KG extraction without re-fetching provider
```

---

## 1.3 Data Pipeline Map B — Knowledge Graph Build

```
TRIGGER: QStash /api/worker/graph-build
  Payload: { org_id, document_ids[], job_type, depth }

        │
        ▼
builder.ts → buildGraphForDocuments()
  │
  ├── Batch cap: 20 docs per job → remainder re-enqueued at depth+1
  │                                  MAX_DEPTH = 50 guard
  │
  ├── For each document:
  │   ├── Load documents row → check content_hash vs last_extracted_hash
  │   │       └── IF SAME: skip (SHA-256 dedup)
  │   │
  │   ├── Load document_embeddings rows (ordered by chunk_index)
  │   │       └── Each row: { chunk_index, content_preview, metadata.chunk_text }
  │   │
  │   ├── Map embRows → ExtractorChunk[] (NO re-chunking)  ◄ FIX: direct use
  │   │
  │   ├── extractEntitiesAndRelations(chunks, supabaseAdmin)
  │   │       │
  │   │       ├── Resolve extraction prompt:
  │   │       │       Redis cache (10 min) → resolveExtractionPrompt(orgId)
  │   │       │       Base prompt + active vertical module addenda
  │   │       │
  │   │       ├── Parallel LLM calls (Claude, concurrency=5 per batch):
  │   │       │       ├── General extraction (all docs)
  │   │       │       └── Decision extraction (Jira/Confluence/meetings only)
  │   │       │               Retry once with JSON reminder if parse fails  ◄ FIX
  │   │       │
  │   │       └── Merge by (org_id, label, entity_type)
  │   │               Union department_ids, source_documents
  │   │               Keep strongest provenance + highest confidence on edges
  │   │
  │   ├── deleteByDocument(ctx, docId)   ← wipe prior extractions for this doc
  │   │
  │   ├── upsertNodes(ctx, nodes)        ← merge with existing kg_nodes
  │   └── upsertEdges(ctx, edges, nodeIdMap)
  │
  ├── IF last batch AND processedDocs > 0:
  │       detectCommunities(orgId)
  │               Paginated load of all kg_nodes + kg_edges (5k/page)
  │               Union-Find → assign community IDs
  │
  └── markExtracted(docId, content_hash) → documents.last_extracted_hash

RESULT: kg_nodes + kg_edges populated, community IDs assigned
```

---

## 1.4 Data Pipeline Map C — Chat / Agent Request

```
User sends message
        │
        ▼
POST /api/agent
  │
  ├── cachedAuth() → Clerk userId, orgId, orgRole
  ├── Rate limit: 10 req/60s per user  +  100 req/60s per org
  ├── Redis SET NX lock (8s) on thread_lock:{threadId}  ◄ Concurrency gate
  │       └── IF locked: 429 "Previous message still processing"
  │
  ├── Resolve orgRow (cached 5 min in Redis)
  │       └── Auto-sync if missing: INSERT organizations
  ├── Resolve memberRow (cached 5 min)
  │       └── Auto-sync if missing: INSERT org_members
  │
  ├── Upsert threads row (id, org_id, user_id, updated_at)
  │
  ├── getAgentGraph() [singleton, lazy-init]
  │
  ├── Check state for pending_write_action (HITL gate)
  │       └── IF pending AND expired (>24h): auto-reject, clear state, continue
  │       └── IF pending AND not expired: 409 "Approval required"
  │
  ├── graph.stream(input, { thread_id, checkpoint_ns }) → AsyncGenerator
  │
  ├── Release Redis lock  ◄ Released at stream START, not end
  │
  └── SSE stream loop:
          for await chunk of stream:
            ├── Supervisor events → route decision
            ├── Retrieval events → chunk count
            ├── Tool events → tool_start / tool_end
            ├── Token events → { type: "token", content }
            └── Final state → { type: "done", threadId, cited_sources }

LANGGRAPH INTERNAL FLOW:
  supervisor → classify intent → next_node
      │
      ├─► retrieval → vectorSearchTool + graphQueryTool (parallel)
      │       └── vector_search RPC → document_embeddings (768-dim cosine)
      │       └── graph_query → kg_nodes BFS traversal
      │
      ├─► cross_dept_retrieval → same tools, broader RLS scope
      │
      ├─► email_agent → compose email → pending_write_action
      │       └── INTERRUPT BEFORE action_executor
      │
      ├─► calendar_agent → compose event → pending_write_action
      │       └── INTERRUPT BEFORE action_executor
      │
      ├─► report_agent → structured multi-section report
      │
      └─► synthesis → build final answer → cite sources → END
```

---

## 1.5 Data Pipeline Map D — HITL (Human-in-the-Loop) Flow

```
Agent proposes a write action (email or calendar)
        │
        ▼
action_executor is INTERRUPT_BEFORE in graph
State: pending_write_action = { tool, payload, requested_at }
State: awaiting_approval = true
        │
        ▼
SSE stream ends with { type: "awaiting_approval", pending_write_action }
        │
        ▼
Frontend shows HITL modal (components/chat/hitl-modal.tsx)
User sees: proposed email/event + approve / edit / reject buttons
        │
        ├── APPROVE → POST /api/threads/[id]/approve { decision: "approved" }
        ├── EDIT → POST /api/threads/[id]/approve { decision: "edited", edited_payload }
        └── REJECT → POST /api/threads/[id]/approve { decision: "rejected" }
                │
                ▼
        approve/route.ts:
          ├── Load checkpoint from DB
          ├── Update state: decision recorded, hitl_decisions row inserted
          ├── IF approved/edited: graph.stream(resume) → action_executor runs
          └── IF rejected: graph.stream(resume) → action cleared, synthesis "action cancelled"
```

---

## 1.6 Auth & RLS Flow

```
Request arrives
        │
        ▼
Clerk middleware (built-in, not custom middleware.ts)
  └── Attaches Clerk session to request

        │
        ▼
API route: auth() → { userId (Clerk), orgId (Clerk org_XXXX), orgRole }

        │
        ▼
resolveUserAccess(userId, orgId, orgRole)  [lib/auth/rbac.ts]
  ├── Check Redis cache (5 min TTL)
  ├── Query organizations.clerk_org_id = orgId → internal UUID
  ├── Query org_members WHERE clerk_user_id=userId AND org_id=UUID AND active=true
  │       └── IF active=false: return { role: null }  ◄ FIX: deactivated denied
  ├── Query access_grants (for super_user cross-dept access)
  └── Return UserAccess { internal_user_id, internal_org_id, role, dept_id, accessible_dept_ids }

        │
        ▼
withRLS(context, callback)  [lib/supabase/rls-client.ts]
  ├── Validate org_id is UUID (not Clerk org_ string)
  ├── Create Supabase client with x-app-org-id, x-app-role, x-app-dept-id headers
  ├── Call set_app_context() RPC → SET LOCAL session vars
  ├── IF super_user: call set_session_grants() → temp table for RLS policies
  └── Run callback with RLS-enforced client

RLS POLICIES (002_rls_policies.sql):
  document_embeddings:
    member → org_id match AND (visibility='org_wide' OR dept=user_dept)
    super_user → org_id match AND (visibility IN ('org_wide','department','bi_accessible'))
                 AND dept IN (user_dept UNION grant_dept_ids)
    admin → org_id match only (all visibility levels)
```

---

## 1.7 Morning Briefing Pipeline

```
TRIGGER (one of):
  Manual → POST /api/briefing
  Cron → QStash scheduled job (per automations table cron_expression)

        │
        ▼
QStash → /api/worker/morning-briefing
  │
  ├── Verify QStash HMAC signature
  ├── Resolve org + user UUIDs
  ├── Query connections: Gmail, Calendar, Drive for this org
  │
  ├── Parallel fetch (Promise.all):
  │       ├── Gmail: last 24h important emails
  │       ├── Google Calendar: next 7 days events
  │       ├── Google Drive: recently modified docs
  │       └── KG query: entities relevant to user's dept
  │
  ├── For each section (calendar, emails, docs, knowledge):
  │       └── Claude synthesize → string (empty string on LLM failure)  ◄ SILENT FAILURE
  │
  ├── INSERT briefings row { content: {calendar,emails,docs,knowledge}, summary }
  │
  └── IF delivery = 'email': send via email provider (stub — see §2.6)

RESULT: briefings row available for /api/briefing?type=today
```

---

# PART 2 — KNOWN ISSUES, STUBS & DEAD ENDS

## 2.1 STUBS (appear to work, actually don't)

| Location | Description | Severity |
|----------|-------------|----------|
| `builder/page.tsx` toolbar buttons (MousePointer2, Layers, Settings2) | Have tooltips "coming soon" — no functionality | LOW |
| `components/create-automation-button.tsx` | Button exists, modal may open but "Save" may not POST to `/api/admin/automations` — **verify this is wired** | MEDIUM |
| Builder "Deploy Fleet" button | Calls `handleDeployFleet` — check if this actually creates/activates a QStash schedule or just shows a toast | HIGH |
| `app/api/nango/webhook/route.ts` | Receives Nango sync.completed events — **verify it actually triggers re-indexing or just logs** | HIGH |

## 2.2 DEAD GATEWAYS (routes that exist but lead nowhere useful)

| Route | Issue |
|-------|-------|
| `POST /api/agent` (non-streaming) | Exists but unused — all UI uses streaming. Can be deleted or documented as internal-only. |
| `GET /api/agent/status` | May not be connected to real job tracking — check if it reads anything from DB or just returns static shape |
| `lib/langgraph/tools/chunker.ts` | Previously called from builder.ts — now unused there after double-chunking fix. Verify it's still used elsewhere (insights runAgentQuery?) before deleting. |
| `lib/integrations/indexing.ts → generateChunkId()` (bottom of file) | Exported helper that generates a chunk ID but is never imported anywhere in the codebase — dead code |

## 2.3 SILENT FAILURES (errors swallowed, user sees nothing)

| Location | What fails silently | Fix needed |
|----------|--------------------|-|
| `worker/morning-briefing` | If Claude fails for one briefing section, that section becomes empty string. No retry, no status flag. | Add `section_status: {calendar: 'ok'/'failed'}` to briefings.content |
| `worker/morning-briefing` | Connections with status='error' or 'disconnected' still included in fetch loop | Filter by `status = 'active'` |
| `lib/knowledge-graph/extractor.ts` | After 2 attempts, chunk produces no graph data — logged but not surfaced to caller | Track failed_chunks count in BuildResult |
| `lib/integrations/indexing.ts` | Empty content document indexed as success — document row exists, no embeddings | Return `{ indexed: 0, skipped: 1 }` for empty content |
| `app/api/admin/users/[id]/route.ts` | Clerk role sync error is logged but non-fatal — DB and Clerk can silently diverge if Clerk API is down | Add retry or surface error to admin UI |
| `withRLS` → `set_app_context()` RPC fail | Logged but not thrown — query proceeds with only PostgREST headers. If RLS relies on current_setting(), this path may return wrong data | Alert on RPC failure in production |
| KG edge upsert: label casing mismatch | Edges with source/target that don't match nodeIdMap by exact label are silently dropped | Normalize all labels to lowercase in extractor |

## 2.4 NANGO WEBHOOK — NEEDS VERIFICATION

`app/api/nango/webhook/route.ts` receives `sync.completed` events from Nango when a provider sync finishes. **This is the automatic trigger for re-indexing.**

- Verify it calls `dispatchThrottled()` to enqueue `/api/worker/index`
- Verify it passes the correct internal org UUID (not Clerk org ID) to the worker
- Verify it handles `connection.deleted` events by cleaning up the connections table
- If the webhook isn't working, no automatic indexing happens — users must manually sync

**Test:** Connect a Gmail account. Send yourself an email. Wait 10 minutes. Check if a new document appears in /files. If not, the webhook is broken.

## 2.5 AUTOMATION MODAL — VERIFY SAVE IS WIRED

`components/create-automation-button.tsx` renders a button that should open a modal to create automations. Verify:
- The modal form POSTs to `/api/admin/automations`
- The response includes a `qstash_schedule_id` (meaning QStash was actually scheduled)
- The automation appears in `/admin/automations` after saving
- Deleting an automation also calls QStash to un-schedule the cron

## 2.6 EMAIL DELIVERY — STUB

`worker/morning-briefing` has an email delivery path when `briefing_delivery = 'email'`. This likely calls a placeholder function. **No email provider (Resend, SendGrid, Postmark) is configured.** The briefing is always available in-app regardless.

**Task:** Integrate Resend (`npm install resend`) and wire the delivery path. API key in env: `RESEND_API_KEY`.

## 2.7 REMAINING ARCHITECTURAL GAPS

| Gap | Description | Effort |
|----|-------------|--------|
| No transaction wrapping in KG storage | `upsertNodes` then `upsertEdges` — if edges fail, graph has orphaned nodes | Medium |
| `retrieved_chunks` cleared by synthesis | Synthesis sets `retrieved_chunks: []` after use — if supervisor loops back, next retrieval starts fresh | Design decision — document it |
| Nango orgId inconsistency | `nango_connections` table stores Clerk org IDs; `connections` table stores internal UUIDs | Fix by migrating nango_connections to store internal UUID, or add clerk_org_id column |
| No connection status polling | If a Nango connection expires, status is still 'connected' in UI until next sync attempt | Poll `/api/connections` and check Nango for token validity |
| KG node label casing | "Alice" and "alice" create two separate nodes — no normalization in extractor | Lowercase all labels in `normLabel()` |
| `retrievedDocs` vs `retrieved_chunks` | Two separate accumulators in LangGraph state — some nodes write to one, others to the other — should be unified | Consolidate to single field |
| No pagination in KG nodes API | `/api/graph/nodes` returns up to 50 results — hardcoded — large graphs truncate | Add cursor pagination |
| Graph canvas performance | React Flow renders all visible nodes at once — no virtualization. >500 nodes will lag | Add node clustering or viewport culling |
| Mobile graph list | Mobile fallback uses a simple list — no search debounce on slow connections | Already has 300ms debounce, but needs loading skeleton |

---

# PART 3 — INTERN ASSIGNMENTS

## Team Structure

```
FIXER 1 (F1) — Backend / Pipeline
FIXER 2 (F2) — Frontend / UI + integrations  
TESTER 1 (T1) — API + pipeline testing
TESTER 2 (T2) — UI + end-to-end testing
```

All work on branch `claude/production-hardening`.  
Create a sub-branch for each task: e.g. `fix/nango-webhook-f1`.  
Open a PR for every task — never push directly to the branch.

---

## FIXER 1 — Backend / Pipeline Tasks

### F1-01 · Verify and fix Nango webhook handler
**File:** `app/api/nango/webhook/route.ts`  
**Task:** Read the full file. Confirm it:
1. Verifies the Nango webhook signature (check Nango docs for `X-Nango-Signature` header)
2. Handles `sync.completed` → queries the connections table for org_id → dispatches to `/api/worker/index`
3. Handles `connection.deleted` → deletes the connections row + invalidates KG prompt cache
4. If any of these are missing, implement them.

**How to test:** After fixing, trigger a manual Nango sync from the Nango dashboard. Check server logs for `[webhook]` entries.

---

### F1-02 · Fix KG node label normalization
**File:** `lib/knowledge-graph/extractor.ts`, function `normLabel()`  
**Current code (line 115):**
```typescript
function normLabel(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const s = x.trim();
  return s.length === 0 || s.length > 200 ? null : s;
}
```
**Task:** Add `.toLowerCase()` so "Alice" and "alice" become the same node.  
**Warning:** This changes existing data. After deploying, run a one-time script to normalize existing `kg_nodes.label` values and merge duplicates.

---

### F1-03 · Fix nango_connections orgId consistency
**File:** `lib/nango/client.ts`  
**Problem:** `nango_connections.org_id` stores Clerk org IDs (e.g. `org_2abc...`) while all other tables store internal UUIDs. Workers that resolve internal UUID and pass it to `getConnectionToken()` get a 404.  
**Task:**
1. Add a migration: `ALTER TABLE nango_connections ADD COLUMN IF NOT EXISTS internal_org_id uuid REFERENCES organizations(id);`
2. Update `saveConnectionMapping()` to also accept and store `internal_org_id`
3. Update `getConnectionToken()` to check both `org_id` (Clerk) and `internal_org_id` (UUID)
4. Update the index worker to also pass `internalOrgId` in the payload

---

### F1-04 · Email delivery via Resend
**File:** `app/api/worker/morning-briefing/route.ts`  
**Task:**
1. `npm install resend`
2. Add `RESEND_API_KEY` to `.env.local`
3. Find the delivery block (search for `briefing_delivery === 'email'`)
4. Replace stub with:
```typescript
import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)
await resend.emails.send({
  from: 'briefing@athene.ai',
  to: userEmail,
  subject: `Your Athene Briefing — ${new Date().toLocaleDateString()}`,
  html: renderBriefingEmail(briefing.content),
})
```
5. Create `renderBriefingEmail()` that converts the 4-section content object to HTML.

---

### F1-05 · Add section-level status to briefings
**File:** `app/api/worker/morning-briefing/route.ts`  
**Task:** Track which sections succeeded vs failed. Change the briefings INSERT to:
```typescript
content: {
  calendar: calendarResult,
  emails: emailsResult,
  docs: docsResult,
  knowledge: knowledgeResult,
},
section_status: {
  calendar: calendarResult ? 'ok' : 'failed',
  emails: emailsResult ? 'ok' : 'failed',
  docs: docsResult ? 'ok' : 'failed',
  knowledge: knowledgeResult ? 'ok' : 'failed',
},
```
Update `app/(dashboard)/briefing/page.tsx` to show a warning badge on sections that failed.

---

### F1-06 · Verify Builder "Deploy Fleet" 
**File:** `app/(dashboard)/builder/page.tsx`, `handleDeployFleet()`  
**Task:** Trace the full flow. Does it:
1. Call `/api/admin/automations` with the canvas config?
2. Get back a `qstash_schedule_id`?
3. Update the UI to show "Active"?
If any step is missing, implement it.

---

## FIXER 2 — Frontend / UI Tasks

### F2-01 · Verify Create Automation modal
**File:** `components/create-automation-button.tsx`  
**Task:**
1. Open the file. Find the form submit handler.
2. Verify it calls `POST /api/admin/automations` with `{ type, cron_expression, config }`.
3. Verify the response includes `qstash_schedule_id`.
4. If the modal just closes without persisting, wire it to the API.
5. After saving, the automations list on `/admin/automations` should refresh.

---

### F2-02 · Active connection status check
**File:** `app/(dashboard)/admin/integrations/page.tsx`  
**Task:** Currently shows whatever status is stored in the DB. Add a "Check Status" button per connection that calls `GET /api/connections` and compares last_synced_at against "now - 24h". If the connection hasn't synced recently, show a yellow "Stale" badge instead of "Connected".

---

### F2-03 · Graph canvas pagination
**File:** `app/(dashboard)/graph/page.tsx`  
**Task:** The current search loads 50 nodes max. Add an "Load more" button that calls `/api/graph/nodes?search=...&limit=50&offset=50`. Append results to the canvas.

---

### F2-04 · Knowledge Modules section in Admin Integrations
**File:** `app/(dashboard)/admin/integrations/page.tsx`  
**Task:** Below the connections grid, add a "Knowledge Modules" card. For each module in `VERTICAL_MODULES` (from `lib/knowledge-graph/modules/registry.ts`):
- Show module name + description
- Show a badge: **Active** (green) if any `activating_sources` appear in the org's connections, **Inactive** (gray) if not
- No API call needed — read from the connections list the page already fetches

---

### F2-05 · Briefing section failure UI
**After F1-05 is deployed:**  
**File:** `app/(dashboard)/briefing/page.tsx`  
**Task:** If `section_status.{section} === 'failed'`, show a small warning inside that BriefingSection:
```tsx
{sectionFailed && (
  <p className="text-xs text-yellow-500 mt-2">
    This section could not be synthesized — data may be unavailable.
  </p>
)}
```

---

### F2-06 · Builder toolbar — implement or remove
**File:** `app/(dashboard)/builder/page.tsx`  
**Task:** The three toolbar buttons (MousePointer2, Layers, Settings2) currently show "coming soon" tooltips. Either:
- Implement: MousePointer2 → selection mode toggle (disable drag on canvas), Layers → show/hide node type groups, Settings2 → open config panel
- Or remove them from the UI if not planned

---

## TESTER 1 — API & Pipeline Testing

### T1-01 · Full indexing pipeline test
1. Connect a fresh Gmail account via `/admin/integrations`
2. Send yourself 3 emails with distinct topics
3. Wait for Nango sync (or manually trigger via "Sync" button)
4. Check `/api/files` — do the emails appear?
5. Check `/api/graph/nodes` — are entities extracted from them?
6. If step 4 or 5 fails, check the QStash console for failed jobs and report the error

---

### T1-02 · HITL approval flow test
1. Open chat, ask: "Draft an email to alice@example.com saying hi"
2. Verify the HITL modal appears with a proposed email
3. Test APPROVE path: click Approve → verify the email action is logged in hitl_decisions
4. Test EDIT path: change the email body → approve → verify edited_payload is stored
5. Test REJECT path: click Reject → verify action is cancelled and chat continues
6. Test EXPIRY: find a thread with a pending action >24h old, send a new message — it should auto-reject

---

### T1-03 · Rate limit test
```bash
# Run this from terminal — replace TOKEN and THREAD_ID
for i in {1..12}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://your-app.vercel.app/api/agent \
    -H "Authorization: Bearer TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"message":"test","threadId":"THREAD_ID"}'
done
```
Expected: First 10 return 200, next ones return 429.

---

### T1-04 · RBAC access control test
1. Create a member user (role=member) and an admin user
2. As member: call `GET /api/insights` — should return 403
3. As member: call `POST /api/agent` with a BI query — should route to regular retrieval, not cross_dept
4. Deactivate the member via `/admin/users`
5. As the deactivated user: try any API call — should return 401/403
6. Re-activate and verify access returns

---

### T1-05 · Content hash dedup test
1. Upload a PDF to /files
2. Note the document ID
3. Wait for indexing to complete
4. Upload the EXACT SAME PDF again
5. Check the document_embeddings table — should NOT have duplicate rows
6. Check server logs — should see `[indexing] contentChanged: false` for the second upload

---

### T1-06 · Knowledge graph extraction test
1. Upload a document containing clear entities (e.g. "Alice manages the Phoenix project which depends on AWS EKS")
2. Wait for graph-build to complete (check QStash console)
3. Visit `/graph` and search for "Alice" — verify node exists
4. Click Alice → verify edges to Phoenix and AWS EKS appear
5. Check `kg_nodes.department_ids` is not null — verify department scoping was applied

---

## TESTER 2 — UI & End-to-End Testing

### T2-01 · Full user journey test
Complete this flow as a fresh user:
1. Sign up with a new Clerk account
2. Create an org
3. Connect Gmail via `/admin/integrations`
4. Upload a PDF via `/files`
5. Ask a question in chat about the PDF content
6. Verify the answer cites the PDF

Document each step: what worked, what had an error, what was confusing.

---

### T2-02 · Morning briefing test
1. Navigate to `/briefing`
2. Click "Trigger Neural Synthesis"
3. Verify the page polls (spinner appears)
4. After briefing generates, verify all 4 sections show content
5. Verify history works: generate a second briefing → click History → select previous briefing → verify it loads
6. Test 90s timeout: disconnect all integrations → trigger briefing → wait → verify the retry hint appears after 90s

---

### T2-03 · Mobile responsiveness test
Test every page on iPhone 14 viewport (390×844):
- `/chat` — is the composer usable? does the thread sidebar work?
- `/graph` — does the mobile list render? does search work?
- `/files` — is the table scrollable?
- `/admin/integrations` — do the cards stack correctly?
- `/briefing` — does the header collapse correctly?

Report: screenshot of any broken layout.

---

### T2-04 · Builder workflow test
1. Navigate to `/builder`
2. Add a Trigger node and an Action node
3. Connect them
4. Click "Store Config" → verify toast appears and config saves
5. Click "Deploy Fleet" → document what happens
6. Navigate to `/admin/automations` → does the new automation appear?

---

### T2-05 · Dark mode + theme consistency
Check every page for:
- Any element that's white-on-white or dark-on-dark
- Any hardcoded color that doesn't respond to theme
- Any component that flashes unstyled on load (FOUC)

---

### T2-06 · Error state coverage
Intentionally trigger errors to verify the UI handles them gracefully:
- `/chat` with no integrations connected → should show helpful empty state, not blank
- `/briefing` with no connections → synthesis should fail gracefully with a message
- `/graph` with empty KG → should show "No entities yet" empty state
- `/files/upload` with a 50MB file → should show a size limit error
- `/admin/keys` with an invalid API key → should validate before saving

---

# PART 4 — LLM PROMPT FOR FURTHER EXPLORATION

Give this prompt to Claude or GPT-4 along with the repo:

---

```
You are a senior software engineer reviewing the Athene codebase.
The repo is a Next.js 16 app at /athene-app.

I'm an intern and I need your help exploring the codebase systematically.

The system has these main pipelines:
1. Document indexing (Nango → fetchers → embeddings → Supabase)
2. Knowledge graph extraction (LLM → kg_nodes/kg_edges)
3. AI chat agent (LangGraph with HITL)
4. Morning briefing synthesis (QStash worker)

Known issues already fixed:
- RBAC missing active check (rbac.ts)
- KG builder used wrong column name dept_id vs department_id (builder.ts)
- Extractor had no retry on JSON parse failure (extractor.ts)
- retrieved_chunks accumulated unboundedly in LangGraph state (state.ts)
- Double-chunking: builder re-chunked already-chunked content (builder.ts)
- Content hash dedup only at KG build time, not at index time (indexing.ts)

Things that need investigation:
1. Is app/api/nango/webhook/route.ts fully implemented? Does it trigger re-indexing?
2. Does components/create-automation-button.tsx POST to /api/admin/automations?
3. Does builder/page.tsx handleDeployFleet() actually schedule a QStash cron?
4. Is email delivery in morning-briefing worker implemented or stubbed?
5. Are there any routes that exist but are never called by the frontend?
6. Are there any frontend actions that call an API that doesn't exist?
7. What tables have RLS policies and which don't? (check migrations/)
8. What environment variables are required but not validated at startup?

For each question, read the relevant files and tell me:
- What's actually implemented
- What's a stub or dead end
- What would break in production
- What's the minimum fix needed

Start with question 1.
```

---

# PART 5 — DEPLOYMENT GUIDE

## Environment Variables (required before deploying)

```bash
# Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...

# Database
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Background jobs
QSTASH_TOKEN=...
QSTASH_CURRENT_SIGNING_KEY=v1:...
QSTASH_NEXT_SIGNING_KEY=v1:...

# Integrations
NANGO_SECRET_KEY=...
NANGO_PUBLIC_KEY=...

# LLM (system defaults — orgs can override with BYOK)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# KMS — encrypts BYOK keys at rest
KMS_SECRET=a-long-random-secret-minimum-32-chars

# Cache
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# App URL (used for QStash callback URLs)
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Email (after F1-04)
RESEND_API_KEY=re_...

# Observability (optional)
OTEL_EXPORTER_OTLP_ENDPOINT=https://...
```

## Database Setup

1. Run all migrations in `supabase/migrations/` in order
2. Verify pgvector extension is enabled: `CREATE EXTENSION IF NOT EXISTS vector;`
3. Verify app_setting() function exists (from early migrations)
4. Verify RLS is enabled on all tables
5. Run: `supabase db push` (or apply via Supabase dashboard)

## Deployment Steps (Vercel)

```bash
# 1. Install dependencies
npm install

# 2. TypeScript check — must be 0 errors
npx tsc --noEmit

# 3. Build
npm run build

# 4. Deploy
vercel --prod
```

## QStash Configuration

After deploy, configure QStash schedules for each active automation:
- Morning briefing: `POST https://your-domain.com/api/worker/morning-briefing`
- Cron: per user's `automations.cron_expression`

Nango webhook URL: `https://your-domain.com/api/nango/webhook`
Configure this in Nango dashboard → Settings → Webhooks.

---

# PART 6 — QUICK REFERENCE

## Key TypeScript types

```typescript
// Who the user is
interface UserAccess {
  internal_user_id: string | null;
  internal_org_id: string | null;
  role: 'admin' | 'super_user' | 'member' | null;
  dept_id: string | null;
  accessible_dept_ids: string[] | null;
}

// A document chunk fetched from a provider
interface FetchedChunk {
  chunk_id: string;        // provider's document ID (external_id)
  title: string;
  content: string;         // full text — never stored directly
  source_url: string;
  metadata: { provider: string; [key: string]: any };
}

// A KG node
interface KGNode {
  org_id: string;
  label: string;           // entity name
  entity_type: string;     // person|project|service|concept|team|technology|process|decision
  department_ids: string[];
  visibility: string;
  source_documents: string[];
  description?: string | null;
}

// A KG edge
interface KGEdge {
  org_id: string;
  source_label: string;
  source_entity_type: string;
  target_label: string;
  target_entity_type: string;
  relation: string;        // DEPENDS_ON|OWNS|FEEDS|MENTIONS|USES|RELATED_TO|DECIDES|APPLIED_TO
  provenance: 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS';
  confidence: number;      // 0.0–1.0
}

// LangGraph state
interface AtheneState {
  orgId: string;
  userId: string;
  role: string;
  messages: BaseMessage[];
  retrieved_chunks: any[];    // last-write-wins (replaced each retrieval hop)
  awaiting_approval: boolean;
  pending_write_action: { tool: string; payload: any; requested_at: string } | null;
  final_answer: any | null;
  cited_sources: any[];
  task_type: string | null;
  is_cross_dept_query: boolean;
  hop_count: number;
}
```

## Useful DB queries for debugging

```sql
-- Check recently indexed documents
SELECT title, source_type, created_at, content_hash
FROM documents
ORDER BY created_at DESC LIMIT 20;

-- Check KG node count by entity type
SELECT entity_type, COUNT(*) FROM kg_nodes
WHERE org_id = 'YOUR_ORG_UUID'
GROUP BY entity_type;

-- Find documents with no embeddings (indexing failed)
SELECT d.id, d.title FROM documents d
LEFT JOIN document_embeddings de ON de.document_id = d.id
WHERE de.id IS NULL AND d.org_id = 'YOUR_ORG_UUID';

-- Find documents never extracted into KG
SELECT id, title, content_hash, last_extracted_hash
FROM documents
WHERE content_hash IS NOT NULL
AND last_extracted_hash IS NULL
AND org_id = 'YOUR_ORG_UUID';

-- Check active grants for a user
SELECT ag.scope_type, ag.scope_id, ag.expires_at, om.email
FROM access_grants ag
JOIN org_members om ON om.id = ag.user_id
WHERE ag.org_id = 'YOUR_ORG_UUID'
AND (ag.expires_at IS NULL OR ag.expires_at > NOW());

-- Check recent HITL decisions
SELECT hd.action_type, hd.decision, hd.decided_at, om.email
FROM hitl_decisions hd
JOIN org_members om ON om.id = hd.user_id
WHERE hd.org_id = 'YOUR_ORG_UUID'
ORDER BY hd.decided_at DESC LIMIT 10;
```

## File change checklist (before every PR)

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] No `console.log` or `console.error` — use `logger.info` / `logger.error`
- [ ] No hardcoded org IDs or user IDs
- [ ] No raw SQL string concatenation (use parameterized Supabase queries)
- [ ] New API routes verify auth via `auth()` and check role before proceeding
- [ ] New DB writes go through `supabaseAdmin` only in workers/server actions
- [ ] New frontend fetches have loading + error states

---

*Document generated May 2026 — Athene codebase at commit `1be2b5b`*  
*Branch: `claude/production-hardening`*
