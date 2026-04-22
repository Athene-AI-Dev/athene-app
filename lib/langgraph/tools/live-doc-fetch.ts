import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getProvider, FetchedChunk } from "../../integrations";
import { registerTool } from "./registry";

/**
 * live_doc_fetch
 * Ephemeral content fetcher that bypasses indexed storage to get current state (Notion, Snowflake, Github, Linear, etc.)
 */
export const liveDocFetchTool = new DynamicStructuredTool({
  name: "live_doc_fetch",
  description: "Fetches live, ephemeral content from an external integration given a provider and connectionId. Use this when you need the most up-to-date data that might not be indexed yet.",
  schema: z.object({
    provider: z.string().describe("The integration provider (e.g., 'notion', 'snowflake', 'github', 'linear')"),
    connectionId: z.string().describe("The Nango connection ID for the user's integration"),
    orgId: z.string().optional().describe("The Organization ID"),
    owner: z.string().optional().describe("The repository owner (for github)"),
    repo: z.string().optional().describe("The repository name (for github)")
  }),
  func: async ({ provider, connectionId, orgId, owner, repo }) => {
    const fetcher = getProvider(provider);
    if (!fetcher) {
      return `Error: No fetcher registered for provider '${provider}'`;
    }

    try {
      const chunks: FetchedChunk[] = await fetcher(connectionId, orgId || 'unknown', owner, repo);
      if (chunks.length === 0) {
        return "No content found for this connection.";
      }

      return JSON.stringify(chunks.map((c: FetchedChunk) => ({
        title: c.title,
        content: c.content,
        url: c.source_url
      })), null, 2);
    } catch (error) {
      return `Error fetching content: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
});

// Register the tool
registerTool(liveDocFetchTool);
