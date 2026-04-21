import { DynamicStructuredTool } from "@langchain/core/tools";

export const toolsRegistry: DynamicStructuredTool[] = [];

export function registerTool(tool: DynamicStructuredTool) {
  toolsRegistry.push(tool);
}
