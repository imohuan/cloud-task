/**
 * 日志过滤工具
 *
 * 抽象日志级别检测和通用过滤逻辑，供路由和 SSE 使用
 */

export interface LogFilterOptions {
  /** 逗号分隔的日志级别，如 "ERROR,WARN" */
  levels?: string;
  /** 逗号分隔的搜索关键词，如 "keyword1,keyword2" */
  search?: string;
  /** 逗号分隔的排除关键词，如 "keyword1,keyword2" */
  exclude?: string;
}

/** 检测日志等级 */
export function detectLogLevel(line: string): string {
  if (line.includes('[ERROR]') || line.includes(' ERROR ')) return 'ERROR';
  if (line.includes('[WARN]') || line.includes(' WARN ')) return 'WARN';
  if (line.includes('[DEBUG]') || line.includes(' DEBUG ')) return 'DEBUG';
  return 'INFO';
}

/** 判断单行日志是否匹配过滤条件 */
export function matchesLogFilter(line: string, options: LogFilterOptions): boolean {
  const { levels, search, exclude } = options;

  // 等级过滤
  if (levels) {
    const levelList = levels.split(',').map(l => l.trim().toUpperCase()).filter(Boolean);
    if (levelList.length > 0 && !levelList.includes(detectLogLevel(line))) {
      return false;
    }
  }

  // 搜索列表过滤（some 逻辑）
  if (search) {
    const searchList = search.split(',').map(s => s.trim()).filter(Boolean);
    if (searchList.length > 0 && !searchList.some(s => line.includes(s))) {
      return false;
    }
  }

  // 排除列表过滤（some 逻辑）
  if (exclude) {
    const excludeList = exclude.split(',').map(s => s.trim()).filter(Boolean);
    if (excludeList.length > 0 && excludeList.some(s => line.includes(s))) {
      return false;
    }
  }

  return true;
}
