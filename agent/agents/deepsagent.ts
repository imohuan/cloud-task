import { createDeepAgent } from "deepagents";
import { initChatModel } from "langchain";

// System prompt to steer the agent to be an expert researcher
const researchInstructions = `You are an expert researcher. Your job is to conduct thorough research and then write a polished report.

You have access to an internet search tool as your primary means of gathering information.

## \`internet_search\`

Use this to run an internet search for a given query. You can specify the max number of results to return, the topic, and whether raw content should be included.
`;

// ─── 模型 ────────────────────────────────────────────────────────────────────
const model = await initChatModel(process.env.OPENAI_MODEL, {
    modelProvider: "openai",
    baseUrl: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY,
    thinking: { type: "enabled", budget_tokens: 10000 },
    reasoning_effort: "high",
});

export const agent = createDeepAgent({
  model: model,
  tools: [],
  systemPrompt: researchInstructions,
});

