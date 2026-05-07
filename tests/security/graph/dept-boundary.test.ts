import { beforeEach, describe, expect, it, vi } from "vitest";
import { withRLS, type RLSContext } from "@/lib/supabase/rls-client";
import { traverseFromNode } from "@/lib/knowledge-graph/query";

const nodes: any[] = [];
const edges: any[] = [];

vi.mock("@/lib/supabase/rls-client", () => ({
  withRLS: async <T,>(_ctx: any, cb: (sb: any) => Promise<T>): Promise<T> => cb(makeStub(_ctx)),
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
        let results = (table === "kg_nodes" ? nodes : edges).filter(r => {
          if (r.org_id !== activeCtx.org_id) return false;
          if (table === "kg_nodes") {
            if (r.visibility === "org_wide" || r.visibility === "public") return true;
            if (activeCtx.department_id && r.department_ids?.includes(activeCtx.department_id)) return true;
            return false;
          }
          return true; // Edge filtering is simplified for this test
        });
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
            // Re-apply RLS to joined nodes
            const check = (n: any) => n && (n.visibility === "org_wide" || (activeCtx.department_id && n.department_ids?.includes(activeCtx.department_id)));
            return { ...e, source: check(source) ? source : null, target: check(target) ? target : null };
          });
        }
        resolve({ data: isMaybeSingle ? (results[0] || null) : results, error: null });
      };
      return builder;
    }
  };
}

describe("Graph Security: Department Boundary", () => {
  beforeEach(() => {
    nodes.length = 0;
    edges.length = 0;
  });

  it("Test 2 — Department boundary: Traversal stops at department boundary", async () => {
    nodes.push(
      { id: "sales-1", org_id: "org-1", label: "Sales Node", department_ids: ["dept-sales"], visibility: "department" },
      { id: "eng-1", org_id: "org-1", label: "Eng Node", department_ids: ["dept-eng"], visibility: "department" }
    );
    edges.push({ id: "e1", org_id: "org-1", source_node: "sales-1", target_node: "eng-1", relation: "CONNECTS" });

    const salesCtx = { org_id: "org-1", department_id: "dept-sales" };
    
    const res = await traverseFromNode(salesCtx as RLSContext, "sales-1", { maxHops: 2 });
    
    // Result should contain sales-1 but NOT eng-1
    expect(res.nodes.map(n => n.id)).toContain("sales-1");
    expect(res.nodes.map(n => n.id)).not.toContain("eng-1");
    
    // The edge is visible but the target node is null in the results, triggering boundary_reached
    expect(res.edges).toHaveLength(1);
    expect(res.boundary_reached).toBe(true);
  });

  it("Test 6 — boundary_reached accuracy: Forbidden node is reachable by structure but hidden", async () => {
    nodes.push(
      { id: "root", org_id: "org-1", label: "Root", visibility: "org_wide" },
      { id: "forbidden", org_id: "org-1", label: "Forbidden Secret", department_ids: ["dept-admin"], visibility: "department" }
    );
    edges.push({ id: "e1", org_id: "org-1", source_node: "root", target_node: "forbidden", relation: "PROTECTS" });

    const memberCtx = { org_id: "org-1", department_id: "dept-sales" }; // Sales member
    
    const res = await traverseFromNode(memberCtx as RLSContext, "root", { maxHops: 2 });
    
    expect(res.nodes.map(n => n.id)).toEqual(["root"]);
    expect(res.nodes.map(n => n.label)).not.toContain("Forbidden Secret");
    expect(res.boundary_reached).toBe(true);
  });
});
