import { dirname, basename } from 'path';

function getExecName(): string {
  return basename(process.execPath).toLowerCase();
}

/**
 * 判断当前是否为编译后的可执行文件环境
 * - bun / bun.exe → 开发环境，返回 false
 * - 其他（如 cloud-task.exe）→ 打包环境，返回 true
 */
export function isCompiledApp(): boolean {
  const execName = getExecName();
  return !(execName.startsWith('bun') || execName === 'bun.exe');
}

/**
 * 获取应用根目录
 * - 开发环境 (bun run): 返回 process.cwd()
 * - 编译为 exe 后: 返回 exe 所在目录
 */
export function getAppRoot(): string {
  if (!isCompiledApp()) {
    return process.cwd();
  }
  return dirname(process.execPath);
}
