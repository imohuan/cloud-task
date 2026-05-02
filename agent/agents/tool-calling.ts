import { createAgent, initChatModel } from "langchain";
import { searchTool, createLoadSkillTool } from "../tools/index"

// if (!process.env.ANTHROPIC_API_KEY) {
//   throw new Error("ANTHROPIC_API_KEY is not set");
// }

// export const agent = createAgent({
//   model: "anthropic:claude-haiku-4-5",
//   tools: [weatherTool, calculatorTool, searchWebTool],
// });

if (!process.env.OPENAI_MODEL) {
  throw new Error("OPENAI_MODEL is not set");
}

const model = await initChatModel(
  process.env.OPENAI_MODEL,
  {
    outputVersion: "v1",
    modelProvider: "openai",
    baseUrl: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY,
    thinking: { type: "enabled", budget_tokens: 10000 },
    reasoning_effort: "high",
  }
)

export const agent = createAgent({ model: model, tools: [createLoadSkillTool(), searchTool] });