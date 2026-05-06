/** 日志文件信息 */
export interface LogFile {
  name: string;
  modifiedAt: string;
  sizeFormatted: string;
  totalLines?: number;
  size?: number;
}

/** 日志级别 */
export type LogLevel = "VERBOSE" | "DEBUG" | "INFO" | "WARN" | "ERROR";

/** Toast 通知项 */
export interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error";
}

/** 日志级别选项 */
export const LOG_LEVELS: { value: LogLevel; label: string }[] = [
  { value: "VERBOSE", label: "VERBOSE" },
  { value: "DEBUG", label: "DEBUG" },
  { value: "INFO", label: "INFO" },
  { value: "WARN", label: "WARN" },
  { value: "ERROR", label: "ERROR" },
];
