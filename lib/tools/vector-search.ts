import { withRLS } from "../supabase/rls-client";
import { embed } from "../ai/embedder";

type Params = {
  orgId: string;
  userId: string;
  role: "member" | "admin" | "super_user" | "bi_analyst";
  query: string;
  topK?: number;
};

/**
 * Standard vector search for documents within the user's organization and access context.
 * Utilizes Postgres RLS via the withRLS wrapper.
 */
export async function vectorSearch({
  orgId,
  userId,
  role,
  query,
  topK = 5,
}: Params) {
  // 1️⃣ Embed query
  const embedding = await embed(query); // returns number[1536]

  return withRLS({ org_id: orgId, user_id: userId, user_role: role as any }, async (tx) => {
    // 🔍 Query the document_embeddings table via RPC.
    const { data, error } = await tx.rpc("match_documents", {
      query_embedding: embedding, // Supabase handles the numeric array
      match_threshold: 0.1, // Low threshold to get topK results
      match_count: topK,
    });

    if (error) {
      console.error("Vector search RPC failed:", error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      chunk_id: row.id,
      document_id: row.document_id,
      metadata: row.metadata,
      score: row.similarity,
      preview: row.content_preview,
    }));
  });
}

/**
 * Cross-department vector search for bi_analysts.
 * Enforces strict role checks and visibility filters.
 */
export async function crossDeptVectorSearch(params: Params) {
  const { role } = params;

  // ⚠️ STRICT Role Check
  if (role !== "super_user" && role !== "bi_analyst") {
    throw new Error("Unauthorized: requires bi_analyst/super_user role");
  }

  const embedding = await embed(params.query);

  return withRLS(
    { org_id: params.orgId, user_id: params.userId, user_role: params.role as any },
    async (tx) => {
      const { data, error } = await tx.rpc("match_documents", {
        query_embedding: embedding,
        match_threshold: 0.1,
        match_count: params.topK || 5,
      });

      if (error) {
        console.error("Cross-dept vector search RPC failed:", error);
        throw error;
      }

      // Filter for bi_accessible as in the original raw SQL
      // Note: match_documents returns metadata which should contain visibility
      return (data || [])
        .filter((row: any) => 
          row.metadata?.visibility === "bi_accessible" || 
          row.visibility === "bi_accessible"
        )
        .map((row: any) => ({
          chunk_id: row.id,
          document_id: row.document_id,
          metadata: row.metadata,
          score: row.similarity,
          preview: row.content_preview,
        }));
    }
  );
}
