import { withRLS, type RLSContext } from "../supabase/rls-client";
import { embed } from "../ai/embedder";
import { searchNodes } from "../knowledge-graph/query";

type Params = {
import { withRLS, type RLSContext } from "../supabase/rls-client";
import { embed } from "../ai/embedder";
import { searchNodes } from "../knowledge-graph/query";

type Params = {
  ctx: RLSContext;
  query: string;
  topK?: number;
  includeGraph?: boolean;
};

/**
 * Standard vector search for documents.
 * Integrates knowledge graph results as a secondary context source (ATH-33).
 */
export async function vectorSearch({
  ctx,
  query,
  topK = 5,
  includeGraph = true,
}: Params) {
  const embedding = await embed(query);

  return withRLS(ctx, async (supabase) => {
    // match_documents is the correct RPC name from 008_rls_helpers.sql
    const { data: vectorResults, error: vectorErr } = await supabase.rpc(
      "match_documents",
      {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: topK,
      }
    );

    if (vectorErr) throw new Error(`Vector search failed: ${vectorErr.message}`);

    let graphContext: any[] = [];
    if (includeGraph) {
      const graphRes = await searchNodes(ctx, query, 10);
      graphContext = graphRes.nodes;
    }

    return {
      documents: vectorResults ?? [],
      graph: graphContext,
    };
  });
}

/**
 * Cross-department vector search for privileged users.
 * Enforces strict role checks and relies on RLS to handle broader visibility.
 */
export async function crossDeptVectorSearch(params: Params) {
  const { ctx, query, topK = 5, includeGraph = true } = params;

  // Strict local check for cross-dept capability
  if (ctx.user_role !== "super_user" && ctx.user_role !== "admin") {
    throw new Error("Unauthorized: requires admin or super_user role");
  }

  const embedding = await embed(query);

  return withRLS(ctx, async (supabase) => {
    // We use the same match_documents function; RLS policies for admins
    // and super_users automatically grant wider visibility.
    const { data: vectorResults, error: vectorErr } = await supabase.rpc(
      "match_documents",
      {
        query_embedding: embedding,
        match_threshold: 0.3, // Lower threshold for exploratory cross-dept search
        match_count: topK,
      }
    );

    if (vectorErr)
      throw new Error(`Cross-dept search failed: ${vectorErr.message}`);

    let graphContext: any[] = [];
    if (includeGraph) {
      const graphRes = await searchNodes(ctx, query, 20);
      graphContext = graphRes.nodes;
    }

    return {
      documents: vectorResults ?? [],
      graph: graphContext,
    };
  });
}
