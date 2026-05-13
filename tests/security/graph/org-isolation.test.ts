import { beforeEach, describe, expect, it, vi } from "vitest";
import { withRLS, type RLSContext } from "@/lib/supabase/rls-client";
import { traverseFromNode } from "@/lib/knowledge-graph/query";

// ---- In-memory tables -----------------------------------------
const nodes: any[] = [];
const edges: any[] = [];

// ---- Mock withRLS to call directly with the stub --------------
vi.mock("@/lib/supabase/rls-client", () => {
  return {
    withRLS: async <T,>(
      _ctx: any,
      cb: (sb: any) => Promise<T>
    ): Promise<T> => cb(makeStub(_ctx)),
  };
});

function makeStub(activeCtx: any) {
  return {
    from(table: "kg_nodes" | "kg_edges") {
      return queryBuilder(table, activeCtx);
    },
  };
}

function queryBuilder(table: "kg_nodes" | "kg_edges", activeCtx: any) {
  const filters: any[] = [];
  let isMaybeSingle = false;

  const builder: any = {};
  builder.select = () => builder;
  builder.eq = (col: string, val: any) => { filters.push({ kind: "eq", col, val }); return builder; };
  builder.or = (query: string) => { filters.push({ kind: "or", query }); return builder; };
  builder.limit = () => builder;
  builder.maybeSingle = () => { isMaybeSingle = true; return builder; };

  builder.then = (resolve: any, reject: any) => {
    const dataset = table === "kg_nodes" ? nodes : edges;
    let results = dataset.filter(r => r.org_id === activeCtx.org_id);

    // Apply filters
    for (const f of filters) {
      if (f.kind === "eq") results = results.filter(r => r[f.col] === f.val);
      if (f.kind === "or") {
        const terms = f.query.split(/,(?![^()]*\))/);
        results = results.filter(r => terms.some(term => {
          const match = term.match(/^([^.]+)\.([^.]+)\.(.*)$/);
          if (!match) return false;
          const [, col, op, rawVal] = match;
          const val = rawVal.replace(/^"(.*)"$/, "$1");
          if (op === "eq") return String(r[col]) === val;
          if (op === "in") return val.replace(/^\((.*)\)$/, "$1").split(",").map(v => v.replace(/^"(.*)"$/, "$1")).includes(String(r[col]));
          return false;
        }));
      }
    }

    if (table === "kg_edges") {
      results = results.map(e => {
        const source = nodes.find(n => n.id === e.source_node && n.org_id === activeCtx.org_id);
        const target = nodes.find(n => n.id === e.target_node && n.org_id === activeCtx.org_id);
        return { ...e, source: source || null, target: target || null };
      });
    }

    resolve({ data: isMaybeSingle ? (results[0] || null) : results, error: null });
  };
  return builder;
}

describe("Graph Security: Org Isolation", () => {
  beforeEach(() => {
    nodes.length = 0;
    edges.length = 0;
  });

  it("Test 1 — Org isolation: Two orgs with matching labels never cross", async () => {
    // Org A data
    nodes.push({ id: "a1", org_id: "org-A", label: "Payment Gateway", visibility: "org_wide" });
    nodes.push({ id: "a2", org_id: "org-A", label: "Stripe API", visibility: "org_wide" });
    edges.push({ id: "ea", org_id: "org-A", source_node: "a1", target_node: "a2", relation: "USES" });

    // Org B data (Matching label)
    nodes.push({ id: "b1", org_id: "org-B", label: "Payment Gateway", visibility: "org_wide" });
    nodes.push({ id: "b2", org_id: "org-B", label: "PayPal API", visibility: "org_wide" });
    edges.push({ id: "eb", org_id: "org-B", source_node: "b1", target_node: "b2", relation: "USES" });

    const ctxA = { org_id: "org-A", user_id: "u1" };
    
    // Traversal from Org A's Payment Gateway
    const res = await traverseFromNode(ctxA as RLSContext, "a1", { maxHops: 2 });
    
    // Should ONLY see Org A's nodes
    expect(res.nodes.map(n => n.id)).toContain("a1");
    expect(res.nodes.map(n => n.id)).toContain("a2");
    expect(res.nodes.map(n => n.id)).not.toContain("b1");
    expect(res.nodes.map(n => n.id)).not.toContain("b2");
    expect(res.boundary_reached).toBe(false);
  });

  it("Test 4 — org_wide hop doesn't leak: Even with shared label, subgraphs remain isolated", async () => {
    // Shared label node "Shared Infrastructure" in both orgs
    nodes.push({ id: "infra-A", org_id: "org-A", label: "Shared Infrastructure", visibility: "org_wide" });
    nodes.push({ id: "infra-B", org_id: "org-B", label: "Shared Infrastructure", visibility: "org_wide" });
    
    // Org A specific node
    nodes.push({ id: "secret-A", org_id: "org-A", label: "Internal Key A", visibility: "org_wide" });
    edges.push({ id: "ea", org_id: "org-A", source_node: "infra-A", target_node: "secret-A", relation: "CONTAINS" });

    const ctxB = { org_id: "org-B", user_id: "u2" };
    
    // Traversal from Org B's infra node
    const res = await traverseFromNode(ctxB as RLSContext, "infra-B", { maxHops: 2 });
    
    expect(res.nodes.map(n => n.id)).toEqual(["infra-B"]);
    expect(res.nodes.map(n => n.id)).not.toContain("secret-A");
    expect(res.boundary_reached).toBe(false);
  });
});
