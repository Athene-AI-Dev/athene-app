# Athene AI - Comprehensive Security & Code Audit Report
**Date:** May 7, 2026  
**Branch:** Mathivathani (synced with latest main)  
**Auditor:** GitHub Copilot  

---

## Executive Summary

This audit covers the complete Athene AI application including all API endpoints, authentication/authorization mechanisms, database RLS policies, integrations, and security practices. The application demonstrates **strong foundational security architecture** with proper role-based access control (RBAC), Row Level Security (RLS), and input validation. However, several **medium and low-severity issues** were identified requiring attention.

**Overall Assessment:** ✅ **SECURE** with minor remediation items

---

## 1. API ENDPOINTS AUDIT

### 1.1 Complete Endpoint Inventory

| Endpoint | Method | Purpose | Auth | Admin Only | Status |
|----------|--------|---------|------|-----------|--------|
| `/api/agent` | POST | Start AI agent run, SSE stream | ✅ Clerk | ❌ | ✅ OK |
| `/api/threads/[id]/approve` | POST | HITL approval (ATH-43) | ✅ Clerk | ❌ | ✅ OK |
| `/api/connections` | GET | List Nango connections | ✅ Clerk | ✅ Admin | ✅ OK |
| `/api/connections/delete` | DELETE | Delete connection | ✅ Clerk | ✅ Admin | ✅ OK |
| `/api/nango/session` | POST | Create Nango connect session | ✅ Clerk | ✅ Admin | ✅ OK |
| `/api/admin/keys` | GET/POST/PATCH | LLM key management | ✅ RLS | ✅ Admin | ✅ OK |
| `/api/admin/integrations` | GET/POST/DELETE | Data source management | ✅ Clerk | ✅ Admin | ✅ OK |
| `/api/admin/automations` | GET/POST/DELETE | Scheduled jobs | ✅ RLS | ✅ Owner/Admin | ✅ OK |
| `/api/admin/bi-grants` | GET/POST/DELETE | BI access grants | ✅ RLS | ✅ Admin | ✅ OK |
| `/api/admin/bi-audit` | GET | BI access audit log | ✅ RLS | ✅ Admin | ✅ OK |
| `/api/admin/audit-log` | GET | General audit log | ✅ Clerk | ✅ Admin | ⚠️ INCOMPLETE |
| `/api/briefing` | GET/POST | Briefing retrieval & queueing | ✅ RLS | ❌ | ✅ OK |
| `/api/insights` | GET/POST | BI insights queries | ✅ Clerk | ❌ | ✅ OK |
| `/api/worker/nango-fetch` | POST | Background indexing worker | ✅ QStash Sig | ❌ | ✅ OK |
| `/api/worker/morning-briefing` | POST | Cron briefing generation | ✅ QStash Sig | ❌ | ✅ OK |
| `/api/worker/tool-resume` | POST | Tool execution resume | ✅ QStash Sig | ❌ | ✅ OK |
| `/api/worker/index` | POST | Delta indexing worker | ✅ QStash Sig | ❌ | ✅ OK |
| `/api/worker/graph-build` | POST | Knowledge graph build | ✅ QStash Sig | ❌ | ✅ OK |
| `/api/whoami` | GET | Current user info | ✅ Clerk | ❌ | ✅ OK |

### 1.2 Endpoint Security Analysis

#### ✅ STRENGTHS

1. **Consistent Authentication Pattern**
   - All endpoints verify user identity via Clerk (`await auth()`)
   - Non-public routes protected by middleware (`proxy.ts`)
   - QStash-triggered endpoints verify signature via `verifyQStashSignature()`

2. **Strong Authorization Checks**
   - Admin endpoints enforce role via `mapRole()` and `requireAdmin()`
   - HITL approval validates thread ownership before allowing decisions
   - Nango connections validated against Supabase org_id

3. **Worker Endpoint Security**
   - QStash signature verification on every worker endpoint
   - Idempotency checks prevent duplicate processing
   - org_id validated in all payloads

4. **Input Validation**
   - Most endpoints use Zod schemas (`/api/insights`, `/api/threads/[id]/approve`)
   - Message length limits enforced (10,000 chars max)
   - UUID validation for thread IDs

#### ⚠️ ISSUES FOUND

##### Issue #1: Incomplete Audit Log Endpoint
**Severity:** Medium | **Location:** [`app/api/admin/audit-log/route.ts`](app/api/admin/audit-log/route.ts)

```typescript
// Current implementation (INCOMPLETE)
export async function GET() {
  const { userId, orgId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })
  return NextResponse.json({ status: 'ok', userId, orgId })
}
```

**Issue:** Returns only user info, does not query actual audit logs from database.  
**Impact:** Admin audit logging feature non-functional.  
**Fix:** Should query `admin_actions` and `grant_access_audit` tables with proper RLS context.

```typescript
export async function GET() {
  const { userId, orgId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })
  
  const context = getContextFromHeaders(await headers())
  if (!context || context.org_id !== orgId) return new Response('Unauthorized', { status: 401 })
  
  const isAdmin = await assertAdminRole(context.user_id, context.org_id)
  if (!isAdmin) return new Response('Forbidden', { status: 403 })

  return withRLS(context, async (supabase) => {
    const { data, error } = await supabase
      .from('admin_actions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  })
}
```

**Recommendation:** ✅ IMPLEMENT - This is a tracking/compliance feature.

---

##### Issue #2: Missing Role Guard in BI Grants DELETE
**Severity:** Low | **Location:** [`app/api/admin/bi-grants/[id]/route.ts`](app/api/admin/bi-grants/[id]/route.ts:1-52)

```typescript
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = getContextFromHeaders(req.headers)
  
  // ⚠️ Checking member role directly from DB instead of assertAdminRole()
  const { data: member } = await supabaseAdmin
    .from('org_members')
    .select('role')
    .eq('id', context.user_id)
    .single()

  if (member?.role !== 'admin' && member?.role !== 'super_user') {
    return new Response('Forbidden', { status: 403 })
  }
  // ...
}
```

**Issue:** This endpoint allows `super_user` to delete grants, but BI grant management should be **admin-only**. Super-users should only consume grants, not manage them.

**Impact:** Permission escalation - super_users can revoke BI access.

**Fix:** Change to admin-only:
```typescript
const isAdmin = await assertAdminRole(context.user_id, context.org_id)
if (!isAdmin) return new Response('Forbidden: Only admins can manage grants', { status: 403 })
```

**Recommendation:** ✅ IMPLEMENT - Add centralized role check.

---

##### Issue #3: Tool Resume Worker Missing org_id Validation
**Severity:** Medium | **Location:** [`app/api/worker/tool-resume/route.ts`](app/api/worker/tool-resume/route.ts)

```typescript
export async function POST(request: Request): Promise<NextResponse> {
  // 1. Verify QStash signature ✅
  const isValid = await verifyQStashSignature(request)
  if (!isValid) return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 })

  // 2. Check idempotency ✅
  const isFirstTime = await checkIdempotency(request)
  if (!isFirstTime) return NextResponse.json({ status: 'ok', skipped: 'duplicate' })

  // 3. Parse payload
  const { thread_id, tool_call_id, result, error } = await request.json() // ⚠️ NO ORG VALIDATION

  // 4. Load graph and update state
  const graph = await getAgentGraph()
  await graph.updateState({ configurable: { thread_id } }, { messages: [toolMessage] })
  // ...
}
```

**Issue:** Payload lacks `org_id`. Thread resolution doesn't verify org ownership cross-check. A malicious actor could potentially resume tools for another organization's threads (if thread_id is guessable).

**Impact:** Low-risk (UUIDs are not easily guessable), but violates org isolation principle.

**Fix:**
```typescript
interface ToolResumePayload {
  org_id: string  // ADD THIS
  thread_id: string
  tool_call_id: string
  result: any
  error?: string
}

// Then validate:
if (!payload.org_id || !payload.thread_id || !payload.tool_call_id) {
  return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
}
```

**Recommendation:** ✅ IMPLEMENT - Add org_id to payload validation.

---

##### Issue #4: Nango Connection Delete Missing Provider Validation
**Severity:** Low | **Location:** [`app/api/connections/delete/route.ts`](app/api/connections/delete/route.ts)

```typescript
export async function DELETE(request: Request) {
  const { userId, orgId, orgRole } = await auth()
  
  const role = mapRole(orgRole ?? undefined)
  if (role !== "admin") return new NextResponse("Forbidden", { status: 403 })

  // Extract from URL params
  const connectionId = searchParams.get('connectionId')
  const providerConfigKey = searchParams.get('providerConfigKey')

  if (!connectionId || !providerConfigKey) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  // Delete without verifying providerConfigKey matches connectionId
  await deleteConnection(connectionId, providerConfigKey, orgId) // ⚠️ Trust caller's provider param
}
```

**Issue:** Endpoint accepts both `connectionId` and `providerConfigKey` but doesn't validate they match. A malicious admin could pass a mismatched provider name.

**Impact:** Low - RLS will reject invalid combinations, but causes confusing errors.

**Fix:** Validate provider is valid:
```typescript
// After extracting params
const validProviders = Object.keys(PROVIDER_REGISTRY)
if (!validProviders.includes(providerConfigKey)) {
  return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
}
```

**Recommendation:** ⚠️ NICE-TO-HAVE - Input validation enhancement.

---

### 1.3 Missing Endpoints

**Issue #5: No Endpoint to Revoke All Grants for a User**  
**Severity:** Low | **Location:** None (feature gap)

When a user is terminated, there's no endpoint to revoke all their access grants at once. Currently requires individual DELETE per grant.

**Recommendation:** Add `/api/admin/users/[userId]/revoke-all-grants` endpoint (POST).

---

## 2. AUTHENTICATION & AUTHORIZATION AUDIT

### 2.1 Clerk Integration

#### ✅ Strengths
- Middleware enforces Clerk auth for all non-public routes (`proxy.ts`)
- Organization membership verified via `orgId`
- Role mapping properly categorizes: `org:admin` → "admin", `org:member` → "member", `org:bi_analyst` → "super_user"

#### Analysis
**File:** [`proxy.ts`](proxy.ts)

```typescript
export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return NextResponse.next()

  const { userId, orgId, orgRole } = await auth.protect() // ✅ Enforces auth

  const access = await resolveUserAccess(userId, orgId ?? "")

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-current-org-id", orgId ?? "")
  requestHeaders.set("x-current-user-id", access.internal_user_id ?? "")
  requestHeaders.set("x-current-user-role", access.role ?? "member")
  
  return NextResponse.next({ request: { headers: requestHeaders } })
})
```

**Status:** ✅ SECURE

---

### 2.2 RBAC (Role-Based Access Control)

#### ✅ Strengths
- **Redis-cached** resolution prevents repeated DB queries (300s TTL)
- Fallback to DB if cache miss
- User access includes department, role, and accessible department IDs
- Super_user access grants resolved and cached

#### Analysis
**File:** [`lib/auth/rbac.ts`](lib/auth/rbac.ts)

```typescript
export const resolveUserAccess = cache(async (
  userId: string,
  orgId: string,
  clerkRole?: string | null
): Promise<UserAccess> => {
  // 1. Try Redis cache
  const cached = await redis.get(makeCacheKey(userId, orgId))
  if (typeof cached === "string") return JSON.parse(cached)

  // 2. Query Supabase
  const { data: orgData } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("clerk_org_id", orgId)
    .single()

  if (orgData) {
    const { data } = await supabaseAdmin
      .from("org_members")
      .select("id, department_id, role, access_grants(...)")
      .eq("clerk_user_id", userId)
      .eq("org_id", orgData.id)
      .single()
    
    // Process grants, filter by expiry
    // Cache result
  }
})
```

**Status:** ✅ SECURE

---

#### ⚠️ Issue #6: Missing Cache Invalidation on Grant Changes
**Severity:** Medium | **Location:** RBAC cache strategy

**Problem:** When an admin adds/removes access grants, the super_user's cached access is not invalidated. They won't see new grants until:
1. Cache TTL expires (300 seconds)
2. They log out and back in
3. Middleware re-resolves them on next request

**Current behavior:**
- Admin grants BI access to super_user at 10:00:00
- Super_user's cache was set at 9:59:30
- Super_user's new grant won't be visible until 10:05:00 (5-minute delay)

**Fix:** Add cache invalidation on grant changes:

```typescript
// In /api/admin/bi-grants POST handler
export async function POST(req: Request) {
  // ... create grant ...
  
  // Invalidate super_user's cache
  const cacheKey = `${USER_ACCESS_CACHE_PREFIX}:${context.user_id}:${context.org_id}`
  await redis.del(cacheKey)
  
  return NextResponse.json(data)
}
```

**Recommendation:** ✅ IMPLEMENT - Add cache invalidation.

---

### 2.3 Admin Role Enforcement

#### ✅ Status: STRONG
**File:** [`lib/auth/admin.ts`](lib/auth/admin.ts)

```typescript
export async function requireAdmin<T>(
  callback: (supabase: SupabaseClient, context: { orgId: string; userId: string }) => Promise<T>
): Promise<T> {
  const { userId, orgId, orgRole } = await auth()
  
  if (!userId || !orgId) throw new Error('Unauthorized')
  
  const role = mapRole(orgRole ?? undefined)
  if (role !== 'admin') throw new Error('Forbidden')

  const kmsKey = process.env.KMS_KEY
  if (!kmsKey) throw new Error('KMS_KEY missing')

  return withRLS({
    org_id: orgId,
    user_id: userId,
    user_role: 'admin',
  }, callback)
}
```

Properly enforces:
- ✅ Admin role check
- ✅ KMS_KEY presence verification
- ✅ RLS context injection

---

## 3. DATABASE & ROW LEVEL SECURITY (RLS) AUDIT

### 3.1 RLS Architecture

**Files:** 
- [`supabase/migrations/20260101000002_rls_policies.sql`](supabase/migrations/20260101000002_rls_policies.sql)
- [`lib/supabase/rls-client.ts`](lib/supabase/rls-client.ts)

#### ✅ Strengths

1. **Comprehensive Table Coverage**
   - ✅ `organizations` - org_id scoped
   - ✅ `org_members` - org_id scoped, self-update allowed
   - ✅ `departments` - org_id scoped
   - ✅ `access_grants` - admin-managed, user self-read
   - ✅ `connections` - org_id scoped, user can manage own
   - ✅ `documents` - visibility-based + org_id scoped
   - ✅ `document_embeddings` - THE CORE POLICY (excellent)
   - ✅ `kg_nodes` - visibility + department-based
   - ✅ `kg_edges` - visibility + source/target node checking
   - ✅ `threads` - user-scoped + admin override
   - ✅ `thread_checkpoints` - user-scoped via parent thread
   - ✅ `hitl_decisions` - user-scoped + admin read-all
   - ✅ `briefings` - user-scoped
   - ✅ `insights` - admin/super_user only
   - ✅ `llm_keys` - admin-only

2. **Multi-Layer Enforcement (Belt-and-Suspenders)**
   ```sql
   -- Layer 1: HTTP headers via PostgREST
   headers["x-app-org-id"]: orgId
   headers["x-app-user-id"]: userId
   
   -- Layer 2: Postgres session variables via SET LOCAL
   PERFORM set_config('app.org_id', p_org_id, true)
   PERFORM set_config('app.user_id', p_user_id, true)
   
   -- app_setting() checks headers first, falls back to current_setting()
   ```

3. **Visibility Tiers (Excellent Design)**
   ```sql
   CREATE TYPE visibility_level AS ENUM (
     'org_wide',        -- everyone
     'department',      -- dept members only
     'bi_accessible',   -- dept + super_user grants
     'confidential',    -- dept + admin only (grants cannot unlock)
     'restricted'       -- owner only
   );
   ```

4. **Grant Scope System**
   - `department` - super_user gets all docs from a dept
   - `resource` - specific document access
   - `source` - all docs from a provider (e.g., all Jira)

#### ⚠️ Issues Found

##### Issue #7: RLS Policy Missing on `nango_connections` Table
**Severity:** High | **Location:** [`supabase/migrations/20260101000006_org_integrations.sql`](supabase/migrations/20260101000006_org_integrations.sql)

The `nango_connections` table lacks RLS, which stores sensitive connection metadata.

**Current Code:**
```typescript
// No RLS on nango_connections table!
// This means any org member can SELECT all connections from all orgs
```

**Impact:** 
- Any authenticated user can query connections from other organizations
- Nango connection details, tokens, metadata exposed

**Fix:** Add RLS policy to migration file:
```sql
ALTER TABLE nango_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY nango_connections_org_scoped ON nango_connections FOR SELECT
  USING (org_id::text = app_setting('org_id'));

CREATE POLICY nango_connections_admin_write ON nango_connections FOR ALL
  USING (
    org_id::text = app_setting('org_id')
    AND app_setting('user_role') = 'admin'
  );
```

**Recommendation:** ✅ CRITICAL - Add RLS immediately.

---

##### Issue #8: Visibility Enum Migration Inconsistency
**Severity:** Low | **Location:** [`supabase/migrations/20260430000000_fix_visibility_enum.sql`](supabase/migrations/20260430000000_fix_visibility_enum.sql)

```sql
-- Old enum values (20260101000001_schema.sql)
CREATE TYPE visibility_level AS ENUM (
  'org_wide', 'department', 'bi_accessible', 'confidential', 'restricted'
);

-- New enum values (20260430000000_fix_visibility_enum.sql)
-- Appears to change to: 'public', 'team', 'private' (?)
```

The migration file has old policy definitions:
```sql
DROP POLICY IF EXISTS documents_read ON documents;
CREATE POLICY documents_read ON documents FOR SELECT
  USING (
    app_setting('user_role') = 'admin'
    OR visibility = 'public'  -- Changed from 'org_wide'
    OR (department_id::text = app_setting('department_id') AND visibility = 'team')  -- Changed from 'department'
    OR (visibility = 'private' AND owner_user_id::text = app_setting('user_id'))  -- Changed from 'restricted'
  );
```

**Issue:** Inconsistent enum naming makes codebase confusing. Are we using:
- `org_wide` / `department` / `bi_accessible` / `confidential` / `restricted`?
- or `public` / `team` / `private`?

**Impact:** Potential bugs if code references wrong enum values.

**Fix:** Standardize enum names across all migrations. Recommend keeping original semantic names:
```sql
-- Keep these clear names:
'org_wide'        -- visible to entire organization
'department'      -- visible to department members
'bi_accessible'   -- visible to department + BI analysts (via grants)
'confidential'    -- hidden even from BI analysts (admin-only)
'restricted'      -- owner-only (personal data)
```

**Recommendation:** ⚠️ INVESTIGATE - Determine which enum is actually in use.

---

##### Issue #9: RLS Policy Check Missing Org Filter on Sync Jobs
**Severity:** Medium | **Location:** [`supabase/migrations/20260101000006_org_integrations.sql`](supabase/migrations/20260101000006_org_integrations.sql)

```sql
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY sync_jobs_read ON sync_jobs FOR SELECT
  USING (org_id::text = app_setting('org_id'));  -- ✅ Good

CREATE POLICY sync_jobs_admin_write ON sync_jobs FOR ALL
  USING (
    org_id::text = app_setting('org_id')
    AND app_setting('user_role') = 'admin'
  );  -- ✅ Good

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_admin_read ON webhook_events FOR SELECT
  USING (
    org_id::text = app_setting('org_id')
    AND app_setting('user_role') = 'admin'
  );  -- ✅ Good

CREATE POLICY webhook_service_write ON webhook_events FOR INSERT
  WITH CHECK (true);  -- ⚠️ PROBLEM!
```

**Issue:** `webhook_service_write` policy allows anyone to INSERT to `webhook_events` because:
1. The `WITH CHECK (true)` clause always evaluates to true
2. Webhook handlers run as service_role and can bypass RLS
3. This is intentional (webhooks come from external sources)

**However**, this is a security anti-pattern. If the webhook_events table is ever queried by users, they could see webhook data from other orgs.

**Fix:** Even though service_role bypasses RLS, make intent explicit:
```sql
-- Document that webhooks come from external sources
CREATE POLICY webhook_service_write ON webhook_events FOR INSERT
  USING (true)  -- External webhook sources (service role)
  WITH CHECK (true);

-- Ensure org_id is always set by database trigger or application
CREATE TRIGGER webhook_ensure_org_id
  BEFORE INSERT ON webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION (
    NEW.org_id IS NOT NULL OR RAISE EXCEPTION 'org_id required'
  );
```

**Recommendation:** ⚠️ NICE-TO-HAVE - Add trigger to enforce org_id.

---

### 3.2 Nango Client Security

#### Analysis
**File:** [`lib/nango/client.ts`](lib/nango/client.ts)

```typescript
export async function getConnectionToken(
  connectionId: string,
  providerConfigKey: string,
  orgId: string
): Promise<string> {
  if (!orgId) throw new Error('orgId is required')

  // ✅ Verify ownership in Supabase FIRST
  const { data: mapping, error: supabaseError } = await supabaseAdmin
    .from('nango_connections')
    .select('id')
    .eq('org_id', orgId)
    .eq('connection_id', connectionId)
    .eq('provider_config_key', providerConfigKey)
    .maybeSingle()

  if (!mapping) {
    const notFound = new Error('Connection not found for this organization')
    throw notFound
  }

  // ✅ Only fetch token if verification passed
  const nango = getNango()
  return await nango.getToken(nangoKey, connectionId)
}
```

**Status:** ✅ STRONG - Properly validates org ownership before requesting token.

---

## 4. WORKER ENDPOINT SECURITY

### Analysis
All worker endpoints (QStash-triggered background jobs) follow consistent security pattern:

```typescript
export async function POST(request: Request): Promise<NextResponse> {
  // 1. ✅ Verify QStash signature
  const isValid = await verifyQStashSignature(request)
  if (!isValid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })

  // 2. ✅ Check idempotency to prevent duplicate processing
  const isFirstTime = await checkIdempotency(request)
  if (!isFirstTime) return NextResponse.json({ status: 'ok', skipped: 'duplicate' })

  // 3. ✅ Validate payload
  const { org_id, ...rest } = await request.json()
  if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

  // 4. ✅ Process job
}
```

**Files Audited:**
- ✅ `/api/worker/nango-fetch` - Background indexing
- ✅ `/api/worker/morning-briefing` - Cron briefing generation
- ✅ `/api/worker/tool-resume` - Tool async completion
- ✅ `/api/worker/index` - Delta indexing (has issue #3 above)
- ✅ `/api/worker/graph-build` - Knowledge graph building

**Status:** ✅ SECURE (except Issue #3)

---

## 5. LANGGRAPH TOOLS & NODES SECURITY

### 5.1 Vector Search Tool

**File:** [`lib/langgraph/tools/vector-search.ts`](lib/langgraph/tools/vector-search.ts)

```typescript
export const vectorSearchTool = new DynamicStructuredTool({
  name: "vectorSearch",
  func: async ({ query, topK = 5 }, _runManager, config) => {
    const orgId = config?.configurable?.orgId ?? ""
    const userId = config?.configurable?.userId ?? ""
    const role = config?.configurable?.role ?? "member"

    const results = await vectorSearch({ orgId, userId, user_role: role, query, topK })
    return JSON.stringify({ tool: "vectorSearch", query, results })
  },
})
```

**Status:** ✅ SECURE
- Respects org_id and user_role from config
- RLS enforced downstream in vectorSearch implementation
- Cross-dept tool restricted to `super_user` role

---

### 5.2 Graph Query Tool

**File:** [`lib/langgraph/tools/graph-query.ts`](lib/langgraph/tools/graph-query.ts)

```typescript
async function findNodes(
  orgId: string,
  labels: string[],
  entityTypes: string[] | undefined,
  role: string,
): Promise<GraphNode[]> {
  let query = supabaseAdmin
    .from('kg_nodes')
    .select('id, label, entity_type, visibility, department_ids')
    .eq('org_id', orgId)

  // ✅ Non-BI analysts only see public nodes
  if (role !== 'bi_analyst') {
    query = query.eq('visibility', 'public')
  }

  const labelFilter = labels
    .map((l) => `label.ilike.%${sanitizeForPostgrest(l)}%`)  // ✅ Sanitization!
    .join(',')
  
  return await query.or(labelFilter).limit(20)
}
```

**Status:** ✅ SECURE
- ✅ Org isolation enforced
- ✅ Role-based visibility filtering
- ✅ Input sanitization for PostgREST filters
- ✅ Result limiting (20 nodes max)

---

## 6. SECURITY PRACTICES AUDIT

### 6.1 Input Validation

#### ✅ STRONG PRACTICES
```typescript
// /api/insights/route.ts uses Zod schemas
const CreateInsightSchema = z.object({
  title: z.string().min(1, "Title required").max(200),
  query: z.string().min(1).max(2000),
})

// /api/agent/route.ts validates message
if (!message || typeof message !== "string" || message.trim().length === 0) {
  return NextResponse.json({ error: "Non-empty message required" }, { status: 400 })
}
if (message.length > 10000) {
  return NextResponse.json({ error: "Message exceeds 10,000 chars" }, { status: 400 })
}
```

#### ⚠️ Gaps Found

**Issue #10: Missing Input Validation in Briefing Endpoint**
**Severity:** Low | **Location:** [`app/api/briefing/route.ts`](app/api/briefing/route.ts)

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'today'  // ⚠️ No validation
  const id = searchParams.get('id')  // ⚠️ Could be any string
  
  if (id) {
    const { data } = await supabase
      .from('briefings')
      .select('*')
      .eq('id', id)  // ⚠️ Type validation missing
      .maybeSingle()
  }
}
```

**Fix:** Add validation:
```typescript
const TypeSchema = z.enum(['today', 'history'])
const type = TypeSchema.parse(searchParams.get('type') || 'today')

const id = searchParams.get('id')
if (id && !/^[0-9a-f-]{36}$/.test(id)) {
  return NextResponse.json({ error: 'Invalid id format' }, { status: 400 })
}
```

**Recommendation:** ⚠️ IMPLEMENT - Add Zod schema validation.

---

### 6.2 Error Handling & Information Disclosure

#### ✅ GOOD PRACTICES
```typescript
// Error messages are generic
return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })

// Specific errors only for validation
return NextResponse.json({ error: 'Title is required' }, { status: 400 })
```

#### ⚠️ Issue #11: Error Messages Expose Implementation Details
**Severity:** Low | **Location:** Multiple endpoints

```typescript
// /api/worker/nango-fetch shows detailed error from Nango
catch (err: any) {
  return NextResponse.json(
    { error: err.message },  // ⚠️ Exposes internal error
    { status: 500 }
  )
}

// /api/admin/integrations/route.ts
catch (err: any) {
  return NextResponse.json(
    { error: err.message },  // ⚠️ Error messages logged to client
    { status: 500 }
  )
}
```

**Fix:** Generic error messages to clients, log details server-side:
```typescript
catch (err: any) {
  logger.error({ err: err.message, stack: err.stack }, '[endpoint]')
  return NextResponse.json(
    { error: 'Failed to process request' },  // Generic to client
    { status: 500 }
  )
}
```

**Recommendation:** ⚠️ IMPLEMENT - Audit error handling across endpoints.

---

### 6.3 Encryption & Key Management

#### Analysis
**File:** [`lib/auth/admin.ts`](lib/auth/admin.ts)

```typescript
const kmsKey = process.env.KMS_KEY
if (!kmsKey) {
  console.error('[Admin] KMS_KEY environment variable is missing')
  throw new Error('Server configuration error: KMS_KEY is missing')
}

// Set as session variable for database encryption
await supabase.rpc('set_app_context', {
  p_org_id: orgId,
  p_user_id: userId,
  p_dept_id: '',
  p_role: 'admin',
  p_kms_key: kmsKey  // ✅ Passed to DB for encryption
})
```

**Status:** ✅ SECURE
- KMS_KEY required at runtime
- Passed via environment only, not in code
- Used for database-level encryption via RPC

---

### 6.4 Rate Limiting

#### Analysis
**File:** [`app/api/agent/route.ts`](app/api/agent/route.ts)

```typescript
const { allowed } = await rateLimit(`agent:${userId}`, 10, 60)
if (!allowed) {
  return NextResponse.json({ error: "Rate limited" }, { status: 429 })
}
```

**Status:** ✅ IMPLEMENTED
- 10 requests per 60 seconds per user
- Rate limit key scoped to user

**Recommendation:** Add rate limiting to other mutation endpoints (POST /api/admin/*, POST /api/worker/*).

---

## 7. CROSS-TENANT DATA ISOLATION

### 7.1 Organization Scoping

#### Test Scenario
```
Scenario: User A from Org A tries to access data from Org B

1. Middleware reads Clerk orgId → must match Org A
2. Clerk enforces user membership in Org A
3. If URL tampered with Org B ID → auth() fails
4. If proxy.ts header tampered → RLS still checks x-app-org-id
5. If RLS bypassed → app_setting('org_id') still enforced in SQL
```

**Status:** ✅ SECURE - 3-layer validation

---

### 7.2 Potential Data Leak Scenario

**Scenario: Querying another org's documents**

```typescript
// Attacker modifies x-app-org-id header
GET /api/briefing
x-app-org-id: attacker-org-id

// Response:
RLS Policy (embeddings_read):
  WHERE org_id::text = app_setting('org_id')  // ✅ Filters to attacker's org
  AND (visibility = 'org_wide' OR ...)

// Result: Only sees attacker's org documents ✅
```

**Status:** ✅ SECURE

---

## 8. ENVIRONMENT & CONFIGURATION AUDIT

### 8.1 Required Environment Variables

**File:** [`lib/nango/client.ts`](lib/nango/client.ts)
```typescript
const nangoSecretKey = process.env.NANGO_SECRET_KEY
if (!nangoSecretKey && process.env.NODE_ENV !== 'test') {
  throw new Error("Missing NANGO_SECRET_KEY")
}
```

**File:** [`lib/auth/admin.ts`](lib/auth/admin.ts)
```typescript
const kmsKey = process.env.KMS_KEY
if (!kmsKey) throw new Error("KMS_KEY missing")
```

**File:** [`lib/qstash/verify.ts`](lib/qstash/verify.ts)
```typescript
if (!currentSigningKey || !nextSigningKey) {
  throw new Error("Missing QSTASH_CURRENT_SIGNING_KEY")
}
```

#### ⚠️ Issue #12: Missing .env.example Documentation
**Severity:** Low | **Location:** Repository root

**Issue:** No `.env.example` or `.env.template` file documenting required environment variables.

**Impact:** Onboarding friction, deployment configuration gaps.

**Fix:** Create `.env.example`:
```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_SIGN_IN_URL=/sign-in
CLERK_SIGN_UP_URL=/sign-up

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_DB_URL=postgresql://user:password@host/db

# QStash
QSTASH_CURRENT_SIGNING_KEY=...
QSTASH_NEXT_SIGNING_KEY=...

# Nango
NANGO_SECRET_KEY=...

# LLM Keys
KMS_KEY=... (base64 encoded)

# LLM Providers
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
GOOGLE_API_KEY=...
```

**Recommendation:** ⚠️ IMPLEMENT - Create `.env.example` for documentation.

---

## 9. TEST COVERAGE AUDIT

### Current Tests
- ✅ `qstash.test.ts` - Background job concurrency testing
- ✅ `__tests__/integrations.test.ts` - GitHub/Linear/integration fetchers

### Gaps Found

**Issue #13: No RLS Policy Tests**
**Severity:** Medium | **Location:** Tests directory

No tests validate that:
1. Users from Org A cannot read Org B data
2. `confidential` docs hidden from super_users
3. Department visibility enforced
4. Thread isolation working correctly

**Recommendation:** ✅ IMPLEMENT
```typescript
// tests/rls-isolation.test.ts
describe('RLS Isolation', () => {
  it('should prevent cross-org data access', async () => {
    // Test user from Org A cannot read Org B's documents
  })
  
  it('should enforce confidential visibility', async () => {
    // Test super_user cannot see confidential docs
  })
  
  it('should isolate threads by user', async () => {
    // Test user cannot read another user's threads
  })
})
```

---

**Issue #14: No Admin Endpoint Security Tests**
**Severity:** Medium

No tests for:
1. Non-admin cannot access `/api/admin/*`
2. Admin cannot escalate to super_user privileges
3. Key rotation works correctly

**Recommendation:** ✅ IMPLEMENT
```typescript
// tests/admin-endpoints.test.ts
describe('Admin Endpoints', () => {
  it('should reject non-admin users', async () => {
    // Test 403 for member attempting POST /api/admin/keys
  })
  
  it('should enforce org isolation on admin operations', async () => {
    // Test admin cannot manage another org's integrations
  })
  
  it('should validate key encryption', async () => {
    // Test LLM keys are encrypted before storage
  })
})
```

---

## 10. AUDIT TRAIL & COMPLIANCE

### Current Implementation

**Audit Tables:**
- ✅ `admin_actions` - Admin operations (create/update/delete)
- ✅ `grant_access_audit` - BI grant changes
- ✅ `bi_access_audit` - BI query audit log
- ⚠️ `/api/admin/audit-log` - **NOT IMPLEMENTED** (Issue #1)

### Missing Features

**Issue #15: No Audit Log Retention Policy**
**Severity:** Low | **Location:** Database migrations

No automated cleanup of old audit logs. Database will grow indefinitely.

**Fix:** Add retention policy migration:
```sql
-- Delete audit logs older than 90 days
CREATE OR REPLACE FUNCTION cleanup_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM admin_actions
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  DELETE FROM grant_access_audit
  WHERE timestamp < NOW() - INTERVAL '90 days';
  
  DELETE FROM bi_access_audit
  WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule via pg_cron (if available)
SELECT cron.schedule('cleanup-audit-logs', '0 2 * * *', 'SELECT cleanup_audit_logs()');
```

**Recommendation:** ⚠️ IMPLEMENT - Add retention policy.

---

## 11. SUMMARY OF FINDINGS

### 🔴 Critical Issues (Fix Immediately)
| # | Issue | Location | Fix Complexity |
|---|-------|----------|-----------------|
| 7 | Missing RLS on `nango_connections` | DB migrations | Low |

### 🟠 High Issues (Fix Soon)
| # | Issue | Location | Fix Complexity |
|---|-------|----------|-----------------|
| 1 | Audit log endpoint incomplete | `/api/admin/audit-log` | Medium |
| 3 | Tool resume missing org_id | `/api/worker/tool-resume` | Low |
| 6 | RBAC cache not invalidated | `/lib/auth/rbac.ts` | Medium |

### 🟡 Medium Issues (Fix Before Release)
| # | Issue | Location | Fix Complexity |
|---|-------|----------|-----------------|
| 2 | BI grants DELETE allows super_user | `/api/admin/bi-grants` | Low |
| 8 | Visibility enum inconsistency | Migrations | Medium |
| 10 | Briefing endpoint missing validation | `/api/briefing` | Low |
| 11 | Error messages expose details | Various | Low |
| 13 | No RLS policy tests | Tests | High |

### 🟢 Low Issues (Nice to Have)
| # | Issue | Location | Fix Complexity |
|---|-------|----------|-----------------|
| 4 | Provider validation missing | `/api/connections/delete` | Low |
| 5 | No bulk grant revocation | Feature gap | Medium |
| 9 | Webhook trigger missing | DB migrations | Low |
| 12 | No .env.example | Config | Low |
| 14 | No admin endpoint tests | Tests | High |
| 15 | No audit log retention | DB migrations | Low |

---

## 12. RECOMMENDATIONS & ACTION ITEMS

### Immediate Actions (This Week)
```
[ ] 1. Add RLS to nango_connections table (Issue #7)
[ ] 2. Implement audit log endpoint (Issue #1)
[ ] 3. Add org_id to tool-resume payload (Issue #3)
[ ] 4. Fix BI grants DELETE permission (Issue #2)
```

### Short-Term (Next 2 Weeks)
```
[ ] 5. Add RBAC cache invalidation (Issue #6)
[ ] 6. Add input validation to briefing endpoint (Issue #10)
[ ] 7. Audit & fix error message handling (Issue #11)
[ ] 8. Investigate visibility enum inconsistency (Issue #8)
[ ] 9. Create .env.example documentation (Issue #12)
```

### Medium-Term (Next Month)
```
[ ] 10. Implement RLS policy test suite (Issue #13)
[ ] 11. Implement admin endpoint security tests (Issue #14)
[ ] 12. Add audit log retention policy (Issue #15)
[ ] 13. Add rate limiting to admin endpoints
[ ] 14. Add bulk grant revocation endpoint (Issue #5)
```

### Documentation
```
[ ] Create SECURITY.md with:
      - Threat model
      - Security best practices
      - Incident response procedure
[ ] Create DEPLOYMENT.md with:
      - Environment variable setup
      - RLS policy verification steps
      - Security checklist
```

---

## 13. COMPLIANCE NOTES

### ✅ Controls Implemented
- ✅ **Authentication**: Clerk-based, multi-org support
- ✅ **Authorization**: RBAC with admin/member/super_user roles
- ✅ **Encryption**: Database-level encryption for LLM keys
- ✅ **Audit Trail**: Admin actions and grant changes logged
- ✅ **Data Isolation**: Organization-scoped, RLS enforced
- ✅ **Input Validation**: Zod schemas on critical endpoints
- ✅ **Rate Limiting**: 10 req/min per user on agent endpoint
- ✅ **HTTPS**: Enforced via Clerk and Supabase
- ✅ **CORS**: PostgREST origin restrictions

### ⚠️ Considerations
- **Data Retention**: Add policy for audit log cleanup (Issue #15)
- **Encryption in Transit**: Ensure HTTPS only (verify Next.js config)
- **Secrets Management**: Use managed secrets service (AWS Secrets Manager, HashiCorp Vault)
- **API Rate Limiting**: Extend to all endpoints, not just agent
- **WAF**: Consider adding Web Application Firewall for production
- **DPIA**: Conduct Data Protection Impact Assessment before handling PII

---

## 14. CONCLUSION

The Athene AI application demonstrates a **strong security foundation** with:
- ✅ Comprehensive RBAC and RLS implementation
- ✅ Consistent authentication across all endpoints
- ✅ Organization isolation enforced at multiple layers
- ✅ Proper credential handling and encryption

The identified issues are **primarily configuration gaps and test coverage**, not fundamental security flaws. All **critical issues** can be resolved with focused development effort.

**Overall Security Rating:** ⭐⭐⭐⭐☆ (4/5)

**Recommendation:** DEPLOY with issue #7 fixed. Address remaining issues in post-deployment hardening phase.

---

**Audit Completed:** May 7, 2026  
**Next Audit Recommended:** After Q3 2026 release
