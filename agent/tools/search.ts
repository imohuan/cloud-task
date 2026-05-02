import { tool } from "langchain";
import { z } from "zod";
import { searchWeb } from "../utils/tavily";

export const searchTool = tool(
  async ({ query, maxResults }) => {
    const response = await searchWeb(query, { maxResults });
    return JSON.stringify(response);
  },
  {
    name: "search_web",
    description: "Search the web for up-to-date information on any topic",
    schema: z.object({
      query: z.string().describe("The search query"),
      maxResults: z.number().optional().describe("Maximum number of results to return (default 5)"),
    }),
  },
);
