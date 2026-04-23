import { AtheneStateType, AtheneStateUpdate } from "../langgraph/state";
import { model } from "../langgraph/llm-factory";
import { vectorSearch } from "../tools/vector-search";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import * as fs from "fs";
import * as path from "path";

// Load the prompt template
const promptPath = path.join(process.cwd(), "lib/agents/prompts/report-plan.md");
let planPromptTemplate = "";
try {
  planPromptTemplate = fs.readFileSync(promptPath, "utf-8");
} catch (e) {
  // Fallback if file isn't found during tests
  planPromptTemplate = `
# Report Planning Prompt
Return a JSON array containing 3 to 6 section titles.
Query: {{query}}
  `;
}

export async function reportAgent(
  state: AtheneStateType,
  config: any
): Promise<AtheneStateUpdate> {
  const { orgId, userId, role, messages } = state;

  // Extract the latest query
  const lastMessage = messages && messages.length > 0 ? messages[messages.length - 1] : null;
  const query = lastMessage?.content || "Generate a report";

  // 1. Plan sections using LLM
  const planPrompt = planPromptTemplate.replace("{{query}}", query.toString());
  
  const planResponse = await model.invoke([
    new SystemMessage(planPrompt),
  ]);

  let sections: string[] = [];
  try {
    // Attempt to parse the content as JSON.
    let content = planResponse.content.toString();
    if (content.startsWith("\`\`\`json")) {
      content = content.replace(/^\`\`\`json\n?/, "").replace(/\n?\`\`\`$/, "");
    }
    sections = JSON.parse(content);
    if (!Array.isArray(sections)) {
      sections = ["Introduction", "Key Findings", "Conclusion"];
    }
  } catch (error) {
    console.error("Failed to parse report plan:", error);
    sections = ["Introduction", "Key Findings", "Conclusion"];
  }

  const compiledSections: string[] = [];

  // 2. For each section, search and synthesize
  for (const section of sections) {
    // Vector search
    const results = await vectorSearch({
      orgId,
      userId,
      role: role as "member" | "admin" | "bi_analyst",
      query: `${query} - ${section}`,
      topK: 5,
    });

    const context = results.map(r => JSON.stringify(r.metadata)).join("\n\n");

    // Synthesize
    const synthesizePrompt = `You are a helpful analyst writing a section for a report.
Section Title: ${section}

Context documents:
${context}

Write the section content in markdown format. Do not include the section title as a heading, just write the content. Use citations if possible based on the context.`;

    const synthesizeResponse = await model.invoke([
      new SystemMessage(synthesizePrompt),
      new HumanMessage("Write the section now."),
    ]);

    compiledSections.push(`## ${section}\n\n${synthesizeResponse.content}`);
  }

  // Combine into final report
  const finalReport = compiledSections.join("\n\n");

  return {
    final_answer: finalReport,
  };
}
