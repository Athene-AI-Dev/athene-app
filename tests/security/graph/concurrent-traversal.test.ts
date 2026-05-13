import { beforeEach, describe, expect, it, vi } from "vitest";
import { withRLS, type RLSContext } from "@/lib/supabase/rls-client";
import { traverseFromNode } from "@/lib/knowledge-graph/query";

const nodes: any[] = [];
const edges: any[] = [];

vi.mock("@/lib/supabase/rls-client", () => ({
  withRLS: async <T,>(ctx: any, cb: (sb: any) => Promise<T>): Promise<T> => cb(makeStub(ctx)),
}));

function makeStub(activeCtx: any) {
  return {
    from(table: any) {
      const filters: any[] = [];
      let isMaybeSingle = false;
      const builder: any = {};
      builder.select = () => builder;
      builder.eq = (col: string, val: any) => { filters.push({ kind: "eq", col, val }); return builder; };
      builder.or = (query: string) => { filters.push({ kind: "or", query }); return builder; };
      builder.limit = () => builder;
      builder.maybeSingle = () => { isMaybeSingle = true; return builder; };
      builder.then = (resolve: any) => {
        // Strict org isolation based on activeCtx
        let results = (table === "kg_nodes" ? nodes : edges).filter(r => r.org_id === activeCtx.org_id);
        
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
  };
}

describe("Graph Security: Concurrent Traversals", () => {
  beforeEach(() => {
    nodes.length = 0;
    edges.length = 0;
    
    // Seed 2 orgs with identical structure but unique node IDs
    for (const org of ["org-1", "org-2"]) {
      nodes.push({ id: `${org}-root`, org_id: org, label: "Root", visibility: "org_wide" });
      nodes.push({ id: `${org}-leaf`, org_id: org, label: "Leaf", visibility: "org_wide" });
      edges.push({ id: `${org}-edge`, org_id: org, source_node: `${org}-root`, target_node: `${org}-leaf`, relation: "HAS" });
    }
  });

  it("Test 5 — Concurrent traversals: 20 simultaneous sessions remain isolated", async () => {
    const totalUsers = 20;
    const promises = [];

    for (let i = 0; i < totalUsers; i++) {
      const orgId = i % 2 === 0 ? "org-1" : "org-2";
      const ctx = { org_id: orgId, user_id: `user-${i}` };
      
      promises.push(
        traverseFromNode(ctx as RLSContext, `${orgId}-root`, { maxHops: 2 })
          .then(res => {
            // Assert no data from the other org leaked in
            res.nodes.forEach(n => {
              expect(n.org_id, `Leak detected for user ${i} from ${orgId}`).toBe(orgId);
            });
            expect(res.nodes).toHaveLength(2);
            expect(res.boundary_reached).toBe(false);
          })
      );
    }

    await Promise.all(promises);
  });
});
