import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { vectorSearch, crossDeptVectorSearch } from "../../tools/vector-search";

export const vectorSearchTool = new DynamicStructuredTool({
  name: "vector_search",
  description: "Search documents using semantic similarity within your organization.",
  schema: z.object({
    query: z.string(),
    topK: z.number().optional(),
  }),
  func: async ({ query, topK }, runManager, config) => {
    // Extract RLS context from metadata
    const { orgId, userId, role } = config.metadata as {
      orgId: string;
      userId: string;
      role: any;
    };

    if (!orgId || !userId || !role) {
      throw new Error("Missing RLS security context in tool call");
    }

    return JSON.stringify(
      await vectorSearch({
        orgId,
        userId,
        role,
        query,
        topK,
      })
    );
  },
});

export const crossDeptVectorSearchTool = new DynamicStructuredTool({
  name: "cross_dept_vector_search",
  description:
    "Advanced search for cross-department insights (BI context). Requires bi_analyst role.",
  schema: z.object({
    query: z.string(),
    topK: z.number().optional(),
  }),
  func: async ({ query, topK }, runManager, config) => {
    const { orgId, userId, role } = config.metadata as {
      orgId: string;
      userId: string;
      role: any;
    };

    if (!orgId || !userId || !role) {
      throw new Error("Missing RLS security context in tool call");
    }

    return JSON.stringify(
      await crossDeptVectorSearch({
        orgId,
        userId,
        role,
        query,
        topK,
      })
    );
  },
});
