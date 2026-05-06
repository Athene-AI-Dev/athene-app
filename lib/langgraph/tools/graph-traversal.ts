import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { traverseFromNode, findNodes } from "../../knowledge-graph/query";
import type { RLSContext } from "../../supabase/rls-client";

/**
 * Extract and validate RLSContext from LangGraph config.
 * Throws if orgId or userId are missing to prevent RLS bypass.
 */
function getRLSContextFromConfig(config: unknown): RLSContext {
  const meta = (config as any)?.metadata ?? {};

  const orgId = meta.orgId;
  const userId = meta.userId;

  if (!orgId || !userId) {
    throw new Error("Missing RLS context: orgId and userId are required in config.metadata");
  }

  return {
    org_id: orgId as string,
    user_id: userId as string,
    user_role: (meta.user_role ?? "member") as RLSContext["user_role"],
    department_id: meta.departmentId as string | undefined,
  };
}

export const graphTraversalTool = new DynamicStructuredTool({
  name: "graph_traversal",
  description: "Performs a multi-hop traversal from a specific node to discover its relationships and the surrounding subgraph.",
  schema: z.object({
    nodeId: z.string().describe("The UUID of the starting node"),
    maxHops: z.number().optional().default(3).describe("Number of hops to traverse"),
    relationFilter: z.array(z.string()).optional().describe("Optional list of relations to follow"),
  }),
  func: async ({ nodeId, maxHops, relationFilter }, config) => {
    try {
      const ctx = getRLSContextFromConfig(config);
      const result = await traverseFromNode(ctx, nodeId, { maxHops, relationFilter });
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error during graph traversal",
      });
    }
  },
});

export const findNodesTool = new DynamicStructuredTool({
  name: "find_graph_nodes",
  description: "Finds specific nodes in the knowledge graph using labels, entity types, or fuzzy text matching.",
  schema: z.object({
    query: z.string().optional().describe("Fuzzy search query for node labels"),
    entityTypes: z.array(z.string()).optional().describe("Filter by entity types (e.g. 'project', 'service')"),
    limit: z.number().optional().default(20).describe("Max results"),
  }),
  func: async ({ query, entityTypes, limit }, config) => {
    try {
      const ctx = getRLSContextFromConfig(config);
      const result = await findNodes(ctx, { query, entityTypes }, limit);
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error while finding nodes",
      });
    }
  },
});
