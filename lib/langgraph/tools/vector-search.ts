import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { vectorSearch, crossDeptVectorSearch } from "../../tools/vector-search";

/**
 * LangGraph tool for single-department document search.
 */
export const vectorSearchTool = new DynamicStructuredTool({
  name: "vector_search",
  description: "Search for documents within the user's organization and department.",
  schema: z.object({
    query: z.string().describe("The search query"),
    topK: z.number().optional().default(5).describe("Number of results to return"),
  }),
  func: async ({ query, topK }, config) => {
    const orgId = config?.metadata?.orgId as string;
    const userId = config?.metadata?.userId as string;
    const role = config?.metadata?.role as "member" | "super_user" | "admin";

    if (!orgId || !userId || !role) {
      throw new Error("Missing security context in tool metadata");
    }
    const results = await vectorSearch({ orgId, userId, role, query, topK });
    return JSON.stringify(results);
  },
});

/**
 * LangGraph tool for cross-department document search (BI analysts only).
 */
export const crossDeptVectorSearchTool = new DynamicStructuredTool({
  name: "cross_dept_vector_search",
  description: "Search for documents across all departments (BI Specialists only).",
  schema: z.object({
    query: z.string().describe("The search query"),
    topK: z.number().optional().default(5).describe("Number of results to return"),
  }),
  func: async ({ query, topK }, config) => {
    const orgId = config?.metadata?.orgId as string;
    const userId = config?.metadata?.userId as string;
    const role = config?.metadata?.role as "member" | "super_user" | "admin";

    if (!orgId || !userId || !role) {
      throw new Error("Missing security context in tool metadata");
    }
    const results = await crossDeptVectorSearch({ orgId, userId, role, query, topK });
    return JSON.stringify(results);
  },
});

