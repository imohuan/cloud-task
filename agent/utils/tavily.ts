import { tavily } from "@tavily/core";

// https://docs.tavily.com/documentation/api-reference/endpoint/search

/** 搜索深度，控制延迟与相关性的权衡 */
type SearchDepth = "advanced" | "basic" | "fast" | "ultra-fast";

/** 搜索类别 */
type SearchTopic = "general" | "news" | "finance";

/** 时间范围过滤 */
type TimeRange = "day" | "week" | "month" | "year" | "d" | "w" | "m" | "y";

/** Tavily Search 请求参数 */
interface TavilySearchOptions {
  /**
   * 搜索深度，控制延迟与结果相关性的权衡
   * - `advanced`: 最高相关性，延迟较高，适合高精度查询（消耗 2 积分）
   * - `basic`: 平衡模式，适合通用搜索（消耗 1 积分）
   * - `fast`: 低延迟优先，保持较好相关性（消耗 1 积分）
   * - `ultra-fast`: 最低延迟，适合时间敏感场景（消耗 1 积分）
   * @default "basic"
   * @example "advanced"
   */
  searchDepth?: SearchDepth;

  /**
   * 每个来源返回的最大内容片段数（仅在 searchDepth 为 advanced 时有效）
   * 每个片段最长 500 字符，格式：`<chunk 1> [...] <chunk 2>`
   * @default 3
   * @example 2
   */
  chunksPerSource?: number;

  /**
   * 返回的最大搜索结果数量（0 ~ 20）
   * @default 5
   * @example 10
   */
  maxResults?: number;

  /**
   * 搜索类别
   * - `general`: 通用搜索，适合广泛查询
   * - `news`: 新闻模式，适合实时资讯（政治、体育、时事）
   * - `finance`: 金融财经相关搜索
   * @default "general"
   * @example "news"
   */
  topic?: SearchTopic;

  /**
   * 按发布/更新时间过滤结果的时间范围（往前推算）
   * @example "week"
   */
  timeRange?: TimeRange;

  /**
   * 只返回此日期之后发布/更新的结果，格式 YYYY-MM-DD
   * @example "2025-01-01"
   */
  startDate?: string;

  /**
   * 只返回此日期之前发布/更新的结果，格式 YYYY-MM-DD
   * @example "2025-12-31"
   */
  endDate?: string;

  /**
   * 是否在响应中包含 LLM 生成的摘要答案
   * - `true` / `"basic"`: 返回简短答案
   * - `"advanced"`: 返回更详细的答案
   * @default false
   * @example true
   */
  includeAnswer?: boolean | "basic" | "advanced";

  /**
   * 是否返回每个结果的原始清洗后 HTML 内容
   * - `"markdown"`: 以 Markdown 格式返回
   * - `"text"`: 纯文本格式（可能增加延迟）
   * - `false`: 不返回（默认）
   * @default false
   * @example "markdown"
   */
  includeRawContent?: false | "markdown" | "text";

  /**
   * 是否在响应中包含相关图片（顶层图片列表 + 每个结果中的图片）
   * @default false
   * @example true
   */
  includeImages?: boolean;

  /**
   * 是否为每张图片附加文字描述（需 includeImages 为 true）
   * @default false
   * @example true
   */
  includeImageDescriptions?: boolean;

  /**
   * 是否返回每个结果网站的 favicon URL
   * @default false
   * @example true
   */
  includeFavicon?: boolean;

  /**
   * 只在这些域名中搜索，最多 300 个
   * @example ["wikipedia.org", "github.com"]
   */
  includeDomains?: string[];

  /**
   * 从结果中排除这些域名，最多 150 个
   * @example ["pinterest.com", "quora.com"]
   */
  excludeDomains?: string[];

  /**
   * 优先返回指定国家/地区的内容（仅 topic 为 general 时有效）
   * @example "china"
   */
  country?: string;

  /**
   * 开启后 Tavily 自动配置搜索参数（消耗 2 积分）
   * 手动设置的参数会覆盖自动值；include_answer、include_raw_content、max_results 始终需手动设置
   * @default false
   * @example true
   */
  autoParameters?: boolean;

  /**
   * 确保结果中包含查询中引号包裹的精确短语，绕过同义词匹配
   * 用法：在 query 中用引号包裹关键词，如 `"John Smith" CEO Acme`
   * @default false
   * @example true
   */
  exactMatch?: boolean;

  /**
   * 是否在响应中包含积分使用情况
   * @default false
   * @example true
   */
  includeUsage?: boolean;
}

/** 单条搜索结果 */
interface TavilySearchResult {
  /** 网页标题 */
  title: string;
  /** 网页 URL */
  url: string;
  /** 内容摘要或片段 */
  content: string;
  /** 相关性得分（0 ~ 1） */
  score: number;
  /** 原始清洗内容（需 includeRawContent） */
  rawContent?: string;
  /** 从该来源提取的图片（需 includeImages） */
  images?: string[];
  /** 网站 favicon URL（需 includeFavicon） */
  favIcon?: string;
}

/** Tavily Search 响应 */
interface TavilySearchResponse {
  /** 执行的搜索查询 */
  query: string;
  /** LLM 生成的摘要答案（需 includeAnswer） */
  answer?: string;
  /** 查询相关的图片列表（需 includeImages） */
  images: Array<{ url: string; description?: string }>;
  /** 按相关性排序的搜索结果列表 */
  results: TavilySearchResult[];
  /** 请求耗时（秒） */
  responseTime: number;
  /** 自动参数选择结果（需 autoParameters） */
  autoParameters?: Record<string, unknown>;
  /** 积分消耗详情（需 includeUsage） */
  usage?: { credits: number };
  /** 唯一请求 ID，用于客服排查问题 */
  requestId?: string;
}

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

export async function searchWeb(
  query: string,
  options?: TavilySearchOptions,
): Promise<TavilySearchResponse> {
  return (await tvly.search(query, options)) as TavilySearchResponse;
}

// const response = await searchWeb("Who is Leo Messi?", {
//   searchDepth: "basic",
//   maxResults: 2,
//   topic: "general",
//   includeAnswer: true,
// });

// console.log(response);