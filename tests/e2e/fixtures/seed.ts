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

/* ─── helpers ──────────────────────────────────────────────────────────── */
function adminSupabase(url: string, key: string): SupabaseClient {
  // url and key are guaranteed non-null by the call-site guard
  return createClient(url, key, { auth: { persistSession: false } });
}

async function seedOrg(db: SupabaseClient) {
  await db
    .from("organisations")
    .upsert(
      { id: SEED.orgId, name: SEED.orgName, nango_connection_id: SEED.nangoConnectionId },
      { onConflict: "id" }
    )
    .throwOnError();
}

async function seedMembers(db: SupabaseClient) {
  const members = [
    { id: SEED.adminUserId, org_id: SEED.orgId, role: "admin" },
    { id: SEED.memberUserId, org_id: SEED.orgId, role: "member" },
    { id: SEED.biAnalystUserId, org_id: SEED.orgId, role: "bi_analyst" },
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
  // Pre-seed an audit row so the BI cross-dept assertion has something to find
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
          created_at: new Date().toISOString(),
        },
      ],
      { onConflict: "id" }
    )
    .throwOnError();
}

/* ─── exported fixture ─────────────────────────────────────────────────── */
export type SeedFixture = {
  seed: typeof SEED;
};

export const test = base.extend<SeedFixture>({
  seed: [
    async ({}, use) => {
      /* Only seed when env vars are present (skips if running against mocks) */
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (url && key) {
        const db = adminSupabase(url, key);
        await seedOrg(db);
        await seedMembers(db);
        await seedDocuments(db);
        await seedAuditRows(db);
      }

      await use(SEED);

      /* Teardown is intentionally omitted – idempotent upserts mean re-runs are safe */
    },
    { scope: "test" },
  ],
});

export { expect };
