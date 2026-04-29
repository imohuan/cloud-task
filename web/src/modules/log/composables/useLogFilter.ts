import { ref } from "vue";
import type { LogLevel } from "../types";

/** 日志筛选状态管理 + URL 同步 */
export function useLogFilter() {
  const searchList = ref<string[]>([]);
  const excludeList = ref<string[]>([]);
  const searchInput = ref("");
  const excludeInput = ref("");
  const activeLevelFilters = ref<LogLevel[]>(["DEBUG", "INFO", "WARN", "ERROR"]);
  const isSearchPanelOpen = ref(false);

  /** 构建筛选参数（用于 API 请求 & SSE URL） */
  function buildFilterParams(): string {
    const params = new URLSearchParams();
    if (searchList.value.length > 0) {
      params.append("search", searchList.value.join(","));
    }
    if (excludeList.value.length > 0) {
      params.append("exclude", excludeList.value.join(","));
    }
    if (activeLevelFilters.value.length < 4) {
      params.append("levels", activeLevelFilters.value.join(","));
    }
    return params.toString();
  }

  /** 构建筛选参数对象（用于 axios params） */
  function buildFilterParamsObject(): Record<string, string> {
    const params: Record<string, string> = {};
    if (searchList.value.length > 0) {
      params.search = searchList.value.join(",");
    }
    if (excludeList.value.length > 0) {
      params.exclude = excludeList.value.join(",");
    }
    if (activeLevelFilters.value.length < 4) {
      params.levels = activeLevelFilters.value.join(",");
    }
    return params;
  }

  /** 切换日志级别筛选 */
  function toggleLevelFilter(level: LogLevel) {
    const idx = activeLevelFilters.value.indexOf(level);
    if (idx > -1) {
      if (activeLevelFilters.value.length > 1) {
        activeLevelFilters.value.splice(idx, 1);
      }
    } else {
      activeLevelFilters.value.push(level);
    }
  }

  /** 添加搜索词 */
  function addSearchTerm() {
    const term = searchInput.value.trim();
    if (term && !searchList.value.includes(term)) {
      searchList.value.push(term);
      searchInput.value = "";
    }
  }

  /** 移除搜索词 */
  function removeSearchTerm(index: number) {
    searchList.value.splice(index, 1);
  }

  /** 添加排除词 */
  function addExcludeTerm() {
    const term = excludeInput.value.trim();
    if (term && !excludeList.value.includes(term)) {
      excludeList.value.push(term);
      excludeInput.value = "";
    }
  }

  /** 移除排除词 */
  function removeExcludeTerm(index: number) {
    excludeList.value.splice(index, 1);
  }

  /** 将当前筛选状态同步到 URL query */
  function updateUrlQuery(selectedFileName?: string) {
    const params = new URLSearchParams();
    if (selectedFileName) {
      params.set("file", selectedFileName);
    }
    if (searchList.value.length > 0) {
      params.set("search", searchList.value.join(","));
    }
    if (excludeList.value.length > 0) {
      params.set("exclude", excludeList.value.join(","));
    }
    if (activeLevelFilters.value.length < 4) {
      params.set("levels", activeLevelFilters.value.join(","));
    }
    const queryString = params.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
  }

  /** 从 URL query 解析筛选状态 */
  function parseUrlQuery() {
    const params = new URLSearchParams(window.location.search);
    const search = params.get("search");
    if (search) {
      searchList.value = search
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    const exclude = params.get("exclude");
    if (exclude) {
      excludeList.value = exclude
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    const levels = params.get("levels");
    if (levels) {
      const levelArr = levels
        .split(",")
        .map((l) => l.trim().toUpperCase())
        .filter(Boolean) as LogLevel[];
      if (levelArr.length > 0) {
        activeLevelFilters.value = levelArr.filter((l) => ["DEBUG", "INFO", "WARN", "ERROR"].includes(l));
      }
    }
  }

  return {
    searchList,
    excludeList,
    searchInput,
    excludeInput,
    activeLevelFilters,
    isSearchPanelOpen,
    buildFilterParams,
    buildFilterParamsObject,
    toggleLevelFilter,
    addSearchTerm,
    removeSearchTerm,
    addExcludeTerm,
    removeExcludeTerm,
    updateUrlQuery,
    parseUrlQuery,
  };
}
