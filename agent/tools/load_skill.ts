import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../skills");

interface SkillMeta {
  dirName: string;
  name: string;
  description: string;
}

/** 解析 SKILL.md 顶部 YAML frontmatter，返回键值对 */
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let val = line.slice(colonIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

/** 扫描 skills 目录，返回包含 SKILL.md 的子目录元信息列表 */
function getAvailableSkills(): SkillMeta[] {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(join(SKILLS_DIR, d.name, "SKILL.md")))
    .map(d => {
      const content = readFileSync(join(SKILLS_DIR, d.name, "SKILL.md"), "utf-8");
      const fm = parseFrontmatter(content);
      return {
        dirName: d.name,
        name: fm.name ?? d.name,
        description: fm.description ?? "",
      };
    });
}

/** 动态创建 load_skill 工具，描述中自动列出当前可用技能 */
export function createLoadSkillTool() {
  const available = getAvailableSkills();

  return tool(
    async ({ skillName }) => {
      const skillPath = join(SKILLS_DIR, skillName, "SKILL.md");
      if (!existsSync(skillPath)) {
        return `技能 "${skillName}" 不存在。可用技能: ${available.map(s => s.dirName).join(", ")}`;
      }
      return readFileSync(skillPath, "utf-8");
    },
    {
      name: "load_skill",
      description: [
        "加载专项技能的提示词和上下文，调用后按返回内容的规范执行任务。",
        "",
        "可用技能:",
        ...available.map(s => `- ${s.dirName} (${s.name}): ${s.description}`),
      ].join("\n"),
      schema: z.object({
        skillName: z.string().describe("技能名称，例如 weather"),
      }),
    }
  );
}
