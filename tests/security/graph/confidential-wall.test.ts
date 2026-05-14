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
            if (activeCtx.user_role === "admin") return true;
            if (r.visibility === "confidential") return false; // Hard block for everyone except admin
            if (r.visibility === "org_wide" || r.visibility === "public") return true;
            if (activeCtx.user_role === "super_user") {
               return activeCtx.accessible_dept_ids?.some((id: string) => r.department_ids?.includes(id));
            }
            return false;
          }
          return true;
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
            const target = nodes.find(n => n.id === e.target_node && n.org_id === activeCtx.org_id);
            const check = (n: any) => n && (activeCtx.user_role === "admin" || (n.visibility !== "confidential" && (n.visibility === "org_wide" || (activeCtx.user_role === "super_user" && activeCtx.accessible_dept_ids?.some((id: string) => n.department_ids?.includes(id))))));
            return { ...e, target: check(target) ? target : null };
          });
        }
        resolve({ data: isMaybeSingle ? (results[0] || null) : results, error: null });
      };
      return builder;
    }
  };
}

describe("Graph Security: Confidential Wall", () => {
  beforeEach(() => {
    nodes.length = 0;
    edges.length = 0;
  });

  it("Test 3 — Confidential wall: super_user with Eng grant still blocked by confidential nodes", async () => {
    nodes.push(
      { id: "eng-node", org_id: "org-1", label: "Engineering Project", department_ids: ["dept-eng"], visibility: "department" },
      { id: "conf-node", org_id: "org-1", label: "Top Secret Design", department_ids: ["dept-eng"], visibility: "confidential" }
    );
    edges.push({ id: "e1", org_id: "org-1", source_node: "eng-node", target_node: "conf-node", relation: "CONTAINS" });

    const superUserCtx = { 
      org_id: "org-1", 
      user_role: "super_user", 
      accessible_dept_ids: ["dept-eng"] 
    };
    
    // Traversal from allowed Eng node
    const res = await traverseFromNode(superUserCtx as any as RLSContext, "eng-node", { maxHops: 2 });
    
    // Result should contain eng-node but NOT conf-node
    expect(res.nodes.map(n => n.id)).toContain("eng-node");
    expect(res.nodes.map(n => n.id)).not.toContain("conf-node");
    expect(res.boundary_reached).toBe(true);
  });
});
