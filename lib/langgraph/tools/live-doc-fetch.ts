import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getProvider } from "../../integrations";
import { registerTool } from "./registry";

/**
 * live_doc_fetch
 * Ephemeral content fetcher that bypasses indexed storage to get current state (Notion, Snowflake, etc.)
 */
export const liveDocFetchTool = new DynamicStructuredTool({
  name: "live_doc_fetch",
  description: "Fetches live, ephemeral content from an external integration (Notion, Snowflake, etc.) given a provider and connectionId. Use this when you need the most up-to-date data that might not be indexed yet.",
  schema: z.object({
    provider: z.string().describe("The integration provider (e.g., 'notion', 'snowflake')"),
    connectionId: z.string().describe("The Nango connection ID for the user's integration")
  }),
  func: async ({ provider, connectionId }) => {
    const fetcher = getProvider(provider);
    if (!fetcher) {
      return `Error: No fetcher registered for provider '${provider}'`;
    }

    try {
      const chunks = await fetcher(connectionId);
      if (chunks.length === 0) {
        return "No content found for this connection.";
      }

      return JSON.stringify(chunks.map(c => ({
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
