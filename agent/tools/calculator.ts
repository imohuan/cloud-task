import { tool } from "langchain";
import { z } from "zod";

function safeEvaluate(expression: string): number {
  const sanitized = expression.replace(/\s/g, "");
  if (!/^[\d+\-*/().]+$/.test(sanitized)) {
    throw new Error(
      `Invalid expression: "${expression}". Only numbers and +, -, *, /, (, ) are allowed.`,
    );
  }
  return new Function(`"use strict"; return (${sanitized});`)() as number;
}

export const calculatorTool = tool(
  async ({ expression }) => {
    try {
      const result = safeEvaluate(expression);
      return JSON.stringify({ expression, result });
    } catch (err) {
      return JSON.stringify({
        expression,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  {
    name: "calculate",
    description: "Evaluate a mathematical expression. Supports +, -, *, /, and parentheses.",
    schema: z.object({
      expression: z.string().describe("The math expression to evaluate, e.g. '2 + 3 * 4'"),
    }),
  },
);
