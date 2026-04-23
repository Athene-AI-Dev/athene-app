import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { registerTool } from "./registry";
import { vectorSearch, crossDeptVectorSearch } from "../../tools/vector-search";
import { RLSContext } from "../../supabase/rls-client";

/**
 * Standard vector search tool with knowledge graph integration.
 * Used by the retrieval agent to find both documents and entities.
 */
export const vectorSearchTool = new DynamicStructuredTool({
  name: "vector_search",
  description: "Searches for relevant document snippets and knowledge graph entities related to a query.",
  schema: z.object({
    query: z.string().describe("The search query"),
    limit: z.number().optional().default(5).describe("Max number of results"),
  }),
  func: async ({ query, limit }, config) => {
    // Extract RLS context from config metadata (injected by the agent node)
    const { orgId, userId, role, departmentId } = config.metadata || {};
    
    if (!orgId || !userId) {
      throw new Error("Missing RLS context in tool configuration");
    }

    const ctx: RLSContext = {
      org_id: orgId,
      user_id: userId,
      user_role: role || "member",
      department_id: departmentId,
    };

    const results = await vectorSearch({ ctx, query, topK: limit });
    return JSON.stringify(results, null, 2);
  },
});

/**
 * Cross-department search tool for privileged users.
 * Uses graph traversal and cross-dept vector search for broader context.
 */
export const crossDeptVectorSearchTool = new DynamicStructuredTool({
  name: "cross_dept_search",
  description: "Privileged search that retrieves documents and entities across the entire organization, ignoring department boundaries.",
  schema: z.object({
    query: z.string().describe("The search query"),
    limit: z.number().optional().default(10).describe("Max number of results"),
  }),
  func: async ({ query, limit }, config) => {
    const { orgId, userId, role, departmentId } = config.metadata || {};

    if (role !== "admin" && role !== "super_user") {
      return "Access Denied: You do not have permission to perform cross-department searches.";
    }

    const ctx: RLSContext = {
      org_id: orgId,
      user_id: userId,
      user_role: role,
      department_id: departmentId,
    };

    const results = await crossDeptVectorSearch({ ctx, query, topK: limit });
    return JSON.stringify(results, null, 2);
  },
});

// Auto-register
registerTool(vectorSearchTool);
registerTool(crossDeptVectorSearchTool);
