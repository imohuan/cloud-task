import { defineComarkPlugin } from "comark/parse";
import { visit } from "comark/utils";
import type { ComarkNode } from "comark";

/**
 * 自定义代码块插件
 * 把 markdown 中的 code block (pre > code) 替换为 CodeEditor 组件节点
 * 这样 Vue 渲染时就会走 components 中映射的 CodeEditor 组件
 */
export const codeBlockPlugin = defineComarkPlugin(() => ({
  name: "code-block-editor",
  post(state) {
    visit(
      state.tree,
      (node: ComarkNode) => {
        // 匹配 pre 元素且带有 language 属性（即代码块）
        return (
          Array.isArray(node) &&
          node[0] === "pre" &&
          typeof node[1] === "object" &&
          node[1] !== null &&
          "language" in node[1]
        );
      },
      (node: ComarkNode) => {
        const el = node as [string, Record<string, unknown>, ...ComarkNode[]];
        const attrs = el[1];
        const codeEl = el[2];

        // 提取语言、文件名、高亮行数
        const lang = (attrs.language as string) || "";
        const filename = (attrs.filename as string) || "";
        const highlights = (attrs.highlights as number[]) || [];

        // 提取代码文本：pre > code > text
        let code = "";
        if (
          Array.isArray(codeEl) &&
          codeEl[0] === "code" &&
          typeof codeEl[2] === "string"
        ) {
          code = codeEl[2];
        }

        // 替换为 CodeEditor 组件节点
        // 组件名用 PascalCase，方便 Vue 端通过 components 映射
        return [
          "CodeEditor",
          {
            lang,
            code,
            filename,
            highlights: JSON.stringify(highlights),
          },
        ] as ComarkNode;
      }
    );
  },
}));
