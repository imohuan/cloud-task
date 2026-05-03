import { createDeepAgent } from "deepagents";
import { model, ContextSchema, createContextAwareMiddleware } from "../utils/init_agent";

// System prompt to steer the agent to be an expert researcher
const researchInstructions = `You are an expert researcher. Your job is to conduct thorough research and then write a polished report.

You have access to an internet search tool as your primary means of gathering information.

## \`internet_search\`

Use this to run an internet search for a given query. You can specify the max number of results to return, the topic, and whether raw content should be included.
`;

const contextAwareMiddleware = createContextAwareMiddleware(ContextSchema);

export const agent = createDeepAgent({
  model: model,
  tools: [],
  systemPrompt: researchInstructions,
  middleware: [contextAwareMiddleware],
  contextSchema: ContextSchema,
});

