/**
 * tests/e2e/fixtures/seed.ts
 *
 * Exports a Playwright `test` fixture that seeds:
 *   - A deterministic "seed-org" organisation row
 *   - Fixture knowledge documents (refund policy, org chart, …)
 *   - Synthetic audit rows for BI cross-dept assertions
 *
 * Uses the SUPABASE_SERVICE_ROLE_KEY so it bypasses RLS.
 * All rows are keyed with a stable UUID so re-runs are idempotent.
 */

import { test as base, expect } from "@playwright/test";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/* ─── stable IDs ────────────────────────────────────────────────────── */
export const SEED = {
  orgId: "00000000-seed-0000-0000-000000000001",
  // Member row UUIDs (for org_members.id — must be UUID type)
  adminMemberId: "00000000-seed-0000-0000-000000000010",
  memberMemberId: "00000000-seed-0000-0000-000000000011",
  biAnalystMemberId: "00000000-seed-0000-0000-000000000012",
  // Clerk user IDs (for org_members.clerk_user_id — string type)
  adminUserId: "user_seed_admin",
  memberUserId: "user_seed_member",
  biAnalystUserId: "user_seed_bi",
  orgName: "Seed Test Org",
  nangoConnectionId: "nango-sandbox-seed",
} as const;

/* ─── fixture docs injected into the knowledge store ─────────────────── */
const FIXTURE_DOCS = [
  {
    id: "doc-refund-policy",
    title: "Refund Policy",
    content:
      "Our refund policy allows customers to return products within 30 days of purchase for a full refund. " +
      "Digital goods are non-refundable once accessed. Contact support@athene.ai for assistance.",
    source: "notion",
    org_id: SEED.orgId,
  },
  {
    id: "doc-sales-handbook",
    title: "Sales Handbook",
    content:
      "The sales team follows a 3-stage pipeline: Prospecting → Qualifying → Closing. " +
      "Quota is reviewed quarterly by the VP of Sales.",
    source: "notion",
    org_id: SEED.orgId,
  },
  {
    id: "doc-bi-metrics",
    title: "BI Metrics Guide",
    content:
      "Cross-department KPIs are tracked in Snowflake. The bi_analyst role has read access to all schemas. " +
      "Revenue metrics are owned by Finance; usage metrics are owned by Product.",
    source: "snowflake",
    org_id: SEED.orgId,
  },
];

const FIXTURE_NODES = [
  { id: "node-payment-gateway", org_id: SEED.orgId, label: "Payment Gateway", entity_type: "component", visibility: "org_wide" },
  { id: "node-stripe", org_id: SEED.orgId, label: "Stripe", entity_type: "service", visibility: "org_wide" },
];

const FIXTURE_EDGES = [
  { id: "edge-gateway-stripe", org_id: SEED.orgId, source_node: "node-payment-gateway", target_node: "node-stripe", relation: "DEPENDS_ON", provenance: "FIXTURE" },
];


/* ─── helpers ──────────────────────────────────────────────────────────── */
function adminSupabase(url: string, key: string): SupabaseClient {
  // url and key are guaranteed non-null by the call-site guard
  return createClient(url, key, { auth: { persistSession: false } });
}

async function seedOrg(db: SupabaseClient) {
  // FIX: table is named 'organizations' (American spelling) per migration 0001.
  // 'organisations' caused a silent 'relation does not exist' error on every CI run.
  await db
    .from("organizations")
    .upsert(
      { id: SEED.orgId, name: SEED.orgName, nango_connection_id: SEED.nangoConnectionId },
      { onConflict: "id" }
    )
    .throwOnError();
}

async function seedMembers(db: SupabaseClient) {
  // FIX: clerk_user_id is the lookup key used by auth helpers (ensureAdminOrAnalyst,
  // resolveMemberRow). Without it every spec sign-in fails with 'Member not found'.
  // FIX 2: Use separate stable UUIDs for org_members.id (UUID column) vs
  // clerk_user_id (text column). Inserting a non-UUID string into a UUID column
  // causes a Postgres type-cast error.
  const members = [
    { id: SEED.adminMemberId, org_id: SEED.orgId, role: "admin", clerk_user_id: SEED.adminUserId },
    { id: SEED.memberMemberId, org_id: SEED.orgId, role: "member", clerk_user_id: SEED.memberUserId },
    { id: SEED.biAnalystMemberId, org_id: SEED.orgId, role: "bi_analyst", clerk_user_id: SEED.biAnalystUserId },
  ];
  await db.from("org_members").upsert(members, { onConflict: "id" }).throwOnError();
}

async function seedDocuments(db: SupabaseClient) {
  await db
    .from("documents")
    .upsert(FIXTURE_DOCS, { onConflict: "id" })
    .throwOnError();
}

async function seedAuditRows(db: SupabaseClient) {
  // Pre-seed an audit row so the BI cross-dept assertion has something to find.
  // NOTE: bi-cross-dept.spec.ts filters by created_at >= testStartTime so this
  // pre-seeded row will NOT satisfy that assertion — only the live row will.
  await db
    .from("audit_log")
    .upsert(
      [
        {
          id: "audit-bi-cross-dept-seed",
          org_id: SEED.orgId,
          actor_id: SEED.biAnalystUserId,
          action: "cross_dept_query",
          meta: { question: "What are the Q1 revenue figures?" },
          // Use a past timestamp so it's always < testStartTime captured in the spec
          created_at: new Date(Date.now() - 60_000).toISOString(),
        },
      ],
      { onConflict: "id" }
    )
    .throwOnError();
}

async function seedGraph(db: SupabaseClient) {
  await db.from("kg_nodes").upsert(FIXTURE_NODES, { onConflict: "id" }).throwOnError();
  await db.from("kg_edges").upsert(FIXTURE_EDGES, { onConflict: "id" }).throwOnError();
}


/* ─── exported fixture ─────────────────────────────────────────────────── */
export type SeedFixture = {
  seed: typeof SEED;
};

// FIX: Worker-scoped fixtures must be declared in the second type parameter
// (WorkerFixtures), not the first (TestFixtures). Using base.extend<SeedFixture>
// places seed in the test-scoped slot, which conflicts with scope:"worker" at runtime.
export const test = base.extend<object, SeedFixture>({
  seed: [
    async ({}, use: any) => {
      /* Only seed when env vars are present (skips if running against mocks) */
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (url && key) {
        const db = adminSupabase(url, key);
        await seedOrg(db);
        await seedMembers(db);
        await seedDocuments(db);
        await seedAuditRows(db);
        await seedGraph(db);
      }


      await use(SEED);

      /* Teardown is intentionally omitted – idempotent upserts mean re-runs are safe */
    },
    // FIX: scope changed from 'test' to 'worker' so the seed runs once per
    // Playwright worker process. All tests in the same worker share the
    // already-seeded state, reducing overhead from O(tests) to O(workers).
    { scope: "worker" },
  ],
});

export { expect };
