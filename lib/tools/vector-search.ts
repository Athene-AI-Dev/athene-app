import { withRLS, type RLSContext } from "../supabase/rls-client";
import { embed } from "../ai/embedder";
import { withVectorSearchSpan } from "../telemetry/spans";

type UserRoleValue = "member" | "super_user" | "admin";

type Params = {
  orgId: string;
  userId: string;
  departmentId?: string | null;
  user_role: UserRoleValue;
  query: string;
  topK?: number;
};

/**
 * Standard vector search for documents within the user's org and access context.
 */
export async function vectorSearch({
  orgId,
  userId,
  departmentId,
  user_role,
  query,
  topK = 5,
}: Params) {
  return withVectorSearchSpan(query, orgId, topK, async (span) => {
    const embedding = await embed(query);

    const ctx: RLSContext = {
      org_id: orgId,
      user_id: userId,
      department_id: departmentId ?? undefined,
      user_role,
    };

    const result = await withRLS(ctx, async (supabase) => {
      const { data, error } = await supabase.rpc("vector_search", {
        p_embedding: JSON.stringify(embedding),
        p_limit: topK,
      });

      if (error) throw new Error(`[vector-search] ${error.message}`);
      return data ?? [];
    });
    span.setAttribute("vector.results_count", result.length);
    return result;
  });
}

/**
 * Cross-department vector search for super_users with bi_accessible grants.
 */
export async function crossDeptVectorSearch(params: Params) {
  if (params.user_role !== "super_user") {
    throw new Error("Unauthorized: cross-department search requires super_user role");
  }

  const topK = params.topK ?? 5;
  return withVectorSearchSpan(params.query, params.orgId, topK, async (span) => {
    span.setAttribute("vector.cross_dept", true);
    const embedding = await embed(params.query);

    const ctx: RLSContext = {
      org_id: params.orgId,
      user_id: params.userId,
      department_id: params.departmentId ?? undefined,
      user_role: params.user_role,
    };

    const result = await withRLS(ctx, async (supabase) => {
      const { data, error } = await supabase.rpc("vector_search_cross_dept", {
        p_embedding: JSON.stringify(embedding),
        p_limit: topK,
      });

      if (error) throw new Error(`[vector-search] ${error.message}`);
      return data ?? [];
    });
    span.setAttribute("vector.results_count", result.length);
    return result;
  });
}
