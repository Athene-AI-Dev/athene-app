import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { registerTool } from "./registry";
import { traverseFromNode, findNodes, getNeighbors } from "../../knowledge-graph/query";
import { RLSContext } from "../../supabase/rls-client";

/**
 * Tool for performing deep graph traversal to discover relationships and insights (ATH-35).
 */
export const graphTraversalTool = new DynamicStructuredTool({
  name: "graph_traversal",
  description: "Performs a multi-hop traversal from a specific node to discover its relationships and the surrounding subgraph.",
  schema: z.object({
    nodeId: z.string().describe("The UUID of the starting node"),
    maxHops: z.number().optional().default(3).describe("Number of hops to traverse"),
    relationFilter: z.array(z.string()).optional().describe("Optional list of relations to follow"),
  }),
  func: async ({ nodeId, maxHops, relationFilter }, config) => {
    const { orgId, userId, role, departmentId } = config.metadata || {};

    const ctx: RLSContext = {
      org_id: orgId,
      user_id: userId,
      user_role: role || "member",
      department_id: departmentId,
    };

    const result = await traverseFromNode(ctx, nodeId, { maxHops, relationFilter });
    return JSON.stringify(result, null, 2);
  },
});

/**
 * Tool for finding specific nodes in the knowledge graph.
 */
export const findNodesTool = new DynamicStructuredTool({
  name: "find_graph_nodes",
  description: "Finds specific nodes in the knowledge graph using labels, entity types, or fuzzy text matching.",
  schema: z.object({
    query: z.string().optional().describe("Fuzzy search query for node labels"),
    entityTypes: z.array(z.string()).optional().describe("Filter by entity types (e.g. 'project', 'service')"),
    limit: z.number().optional().default(20).describe("Max results"),
  }),
  func: async ({ query, entityTypes, limit }, config) => {
    const { orgId, userId, role, departmentId } = config.metadata || {};

    const ctx: RLSContext = {
      org_id: orgId,
      user_id: userId,
      user_role: role || "member",
      department_id: departmentId,
    };

    const result = await findNodes(ctx, { query, entityTypes }, limit);
    return JSON.stringify(result, null, 2);
  },
});

// Auto-register
registerTool(graphTraversalTool);
registerTool(findNodesTool);
