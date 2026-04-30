import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const calculatorTool = tool(
  async ({ expression }) => {
    try {
      const result = Function(`"use strict"; return (${expression})`)();
      console.log("========== 计算中 ", expression);
      
      return `${expression} = ${result}`;
    } catch (e) {
      return `计算失败: ${String(e)}`;
    }
  },
  {
    name: "calculator",
    description: "执行数学表达式计算，例如 '2 + 3 * 4'、'Math.sqrt(16)'、'100 / 4'",
    schema: z.object({
      expression: z.string().describe("要计算的数学表达式"),
    }),
  }
);
