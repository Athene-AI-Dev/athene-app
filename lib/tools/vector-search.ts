import { withRLS } from "../supabase/rls-client";
import { embed } from "../ai/embedder";

type Params = {
  orgId: string;
  userId: string;
  role: "member" | "admin" | "bi_analyst";
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

  return withRLS(orgId, userId, role, async (tx) => {
    // 🔍 Query the document_embeddings table. 
    // The <=> operator is used for cosine distance in pgvector.
    const res = await tx.query(
      `
      SELECT 
        chunk_id,
        document_id,
        metadata,
        1 - (embedding <=> $1) AS score
      FROM document_embeddings
      ORDER BY embedding <=> $1
      LIMIT $2;
      `,
      [JSON.stringify(embedding), topK]
    );

    return res.rows;
  });
}

/**
 * Cross-department vector search for bi_analysts.
 * Enforces strict role checks and visibility filters.
 */
export async function crossDeptVectorSearch(params: Params) {
  const { role } = params;

  // ⚠️ STRICT Role Check
  if (role !== "bi_analyst") {
    throw new Error("Unauthorized: requires bi_analyst role");
  }

  const embedding = await embed(params.query);

  return withRLS(
    params.orgId,
    params.userId,
    params.role,
    async (tx) => {
      const res = await tx.query(
        `
        SELECT 
          chunk_id,
          document_id,
          metadata,
          1 - (embedding <=> $1) AS score
        FROM document_embeddings
        WHERE visibility = 'bi_accessible'
        ORDER BY embedding <=> $1
        LIMIT $2;
        `,
        [JSON.stringify(embedding), params.topK || 5]
      );

      return res.rows;
    }
  );
}
