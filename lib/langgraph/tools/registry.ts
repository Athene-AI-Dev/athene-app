import { StructuredTool } from "@langchain/core/tools";

const tools: Record<string, StructuredTool> = {};

export function registerTool(tool: StructuredTool) {
  tools[tool.name] = tool;
}

export function getTool(name: string): StructuredTool | undefined {
  return tools[name];
}

export function getAllTools(): StructuredTool[] {
  return Object.values(tools);
}
