import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getSearcher } from "../../integrations";
import { registerTool } from "./registry";

/**
 * live_search
 * Real-time search across external integrations (Mode B pure live search)
 */
export const liveSearchTool = new DynamicStructuredTool({
  name: "live_search",
  description: "Performs a real-time search across an external integration (Notion search endpoint, Snowflake SQL LIKE) for a specific query.",
  schema: z.object({
    provider: z.string().describe("The integration provider (e.g., 'notion', 'snowflake')"),
    connectionId: z.string().describe("The Nango connection ID for the user's integration"),
    query: z.string().describe("The search query string")
  }),
  func: async ({ provider, connectionId, query }) => {
    const searcher = getSearcher(provider);
    if (!searcher) {
      return `Error: No searcher registered for provider '${provider}'`;
    }

    try {
      const results = await searcher(connectionId, query);
      if (results.length === 0) {
        return `No results found for query: "${query}"`;
      }

      return JSON.stringify(results.map(r => ({
        title: r.title,
        content: r.content,
        url: r.source_url
      })), null, 2);
    } catch (error) {
      return `Error performing search: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
});

// Register the tool
registerTool(liveSearchTool);
