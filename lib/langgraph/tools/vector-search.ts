import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { vectorSearch, crossDeptVectorSearch } from "@/lib/tools/vector-search";

const searchSchema = z.object({
  query: z.string().describe("The search query to find relevant documents"),
  topK: z.number().optional().default(5).describe("Number of results to return"),
});

export const vectorSearchTool = new DynamicStructuredTool({
  name: "vector_search",
  description: "Search the organization's indexed documents using semantic similarity. Use for answering questions about internal knowledge.",
  schema: searchSchema,
  func: async ({ query, topK }, _runManager, config) => {
    const meta = config?.metadata ?? {};
    const results = await vectorSearch({
      orgId: meta.orgId as string,
      userId: meta.userId as string,
      user_role: (meta.user_role ?? "member") as "member" | "super_user" | "admin",
      query,
      topK,
    });
    return JSON.stringify(results);
  },
});

export const crossDeptVectorSearchTool = new DynamicStructuredTool({
  name: "cross_dept_vector_search",
  description: "Search across department boundaries. Requires super_user role with active bi_accessible grants.",
  schema: searchSchema,
  func: async ({ query, topK }, _runManager, config) => {
    const meta = config?.metadata ?? {};
    const results = await crossDeptVectorSearch({
      orgId: meta.orgId as string,
      userId: meta.userId as string,
      user_role: (meta.user_role ?? "member") as "member" | "super_user" | "admin",
      query,
      topK,
    });
    return JSON.stringify(results);
  },
});
