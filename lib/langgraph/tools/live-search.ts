import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getSearcher, FetchedChunk } from "../../integrations";
import { registerTool } from "./registry";

/**
 * live_search
 * Real-time search across external integrations (Mode B pure live search)
 */
export const liveSearchTool = new DynamicStructuredTool({
  name: "live_search",
  description: "Performs a real-time search across an external integration (e.g. Github issues via +repo:owner/repo, Linear searchableContent) for a specific query.",
  schema: z.object({
    provider: z.string().describe("The integration provider (e.g., 'github', 'linear', 'notion', 'snowflake')"),
    connectionId: z.string().describe("The Nango connection ID for the user's integration"),
    query: z.string().describe("The search query string"),
    orgId: z.string().optional().describe("The Organization ID"),
    owner: z.string().optional().describe("Repository owner for scoping queries (GitHub)"),
    repo: z.string().optional().describe("Repository name for scoping queries (GitHub)")
  }),
  func: async ({ provider, connectionId, query, orgId, owner, repo }) => {
    const searcher = getSearcher(provider);
    if (!searcher) {
      return `Error: No searcher registered for provider '${provider}'`;
    }

    try {
      const results: FetchedChunk[] = await searcher(connectionId, orgId || 'unknown', query, { owner, repo });
      if (results.length === 0) {
        return `No results found for query: "${query}"`;
      }

      return JSON.stringify(results.map((r: FetchedChunk) => ({
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
