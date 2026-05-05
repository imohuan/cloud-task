const MODEL_BRAND_MAP: Record<string, string> = {
  deepseek: "DeepSeek",
  gpt: "GPT",
  glm: "GLM",
  claude: "Claude",
  kimi: "Kimi",
};

export function formatModelName(id: string): string {
  return id
    .split("-")
    .map((word) => {
      const lower = word.toLowerCase();
      return MODEL_BRAND_MAP[lower] ?? (word.charAt(0).toUpperCase() + word.slice(1));
    })
    .join(" ");
}
