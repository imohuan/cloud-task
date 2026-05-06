/**
 * 图片资源下载工具
 *
 * 从远程 URL 下载图片，支持重试策略与超时控制，
 * 自动以 MD5 hash 为文件名缓存到本地，返回本地访问路径。
 *
 * 缓存策略（双层）：
 * 1. URL 级缓存：对 URL 字符串求 MD5，生成 `url-{urlHash}` marker 文件（存 contentHash + ext）
 *    → 相同 URL 再次请求直接命中，无需下载
 * 2. 内容级缓存：实际图片以 `{contentHash}{ext}` 保存，相同内容不重复写入
 *
 * - 4xx 错误不重试，5xx / 网络异常线性退避后重试
 * - 超时通过 AbortController 中断
 */

import { mkdirSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { getAppRoot } from './app-root';
import { Logger } from './logger';

const logger = new Logger('DownloadImage');

/** 图片缓存目录（与上传接口共用） */
export const DOWNLOAD_CACHE_DIR = join(getAppRoot(), 'data', 'upload');
mkdirSync(DOWNLOAD_CACHE_DIR, { recursive: true });

/** 支持的图片 MIME 类型 */
export const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  'image/avif',
]);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff',
  'image/avif': '.avif',
};

export interface DownloadImageOptions {
  /** 最大重试次数，默认 3，上限 10 */
  retries?: number;
  /** 基础重试间隔 ms（线性退避：1x, 2x, 3x…），默认 1000，上限 10000 */
  retryDelay?: number;
  /** 单次请求超时 ms，默认 30000，范围 [1000, 60000] */
  timeout?: number;
  /** 文件大小上限 bytes，默认 100MB */
  maxSize?: number;
  /** 强制重新下载，忽略 URL 缓存（适用于同一 URL 内容会变化的场景），默认 false */
  force?: boolean;
}

export interface DownloadImageResult {
  /** 本地访问路径，格式: /api/upload/{hash} */
  url: string;
  /** 文件内容 MD5 hash（不含扩展名） */
  hash: string;
  /** 缓存时间戳（ms） */
  created: number;
  /** 文件扩展名，含点号，如 .jpg */
  ext: string;
  /** 原始 MIME 类型，如 image/png */
  contentType: string;
}

const DEFAULT_MAX_SIZE = 100 * 1024 * 1024; // 100MB

/** URL marker 文件前缀，与内容文件区分（内容文件为纯 32 位 hex） */
const URL_MARKER_PREFIX = 'url-';

/**
 * 下载远程图片并缓存到本地，返回本地访问路径
 *
 * 首次请求：下载 → 保存内容文件 → 写入 URL marker → 返回路径
 * 再次请求：读取 URL marker → 直接返回，**不下载**
 *
 * @throws {DownloadImageError} 下载或校验失败时抛出，包含 HTTP 状态码
 *
 * @example
 * const result = await downloadAndCacheImage('https://example.com/photo.jpg');
 * console.log(result.url); // /api/upload/abc123...
 *
 * @example
 * const result = await downloadAndCacheImage(url, {
 *   retries: 5,
 *   retryDelay: 500,
 *   timeout: 15000,
 * });
 */
export async function downloadAndCacheImage(
  url: string,
  options: DownloadImageOptions = {},
): Promise<DownloadImageResult> {
  const {
    retries = 3,
    retryDelay = 1000,
    timeout = 30000,
    maxSize = DEFAULT_MAX_SIZE,
  } = options;

  // ── 第一步：URL 验证 ──────────────────────────────────────────────────
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new DownloadImageError('无效的 URL', 'INVALID_URL', 400);
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new DownloadImageError('仅支持 http/https 协议', 'INVALID_PROTOCOL', 400);
  }

  // ── 第二步：URL 级缓存命中检查（跳过下载）────────────────────────────
  const { force = false } = options;
  const urlHash = createHash('md5').update(url).digest('hex');
  const urlMarkerPath = join(DOWNLOAD_CACHE_DIR, `${URL_MARKER_PREFIX}${urlHash}`);

  if (!force && existsSync(urlMarkerPath)) {
    const marker = await Bun.file(urlMarkerPath).text();
    // marker 格式: "{contentHash} {ext}"，例如 "abc123... .jpg"
    const spaceIdx = marker.indexOf(' ');
    const contentHash = spaceIdx !== -1 ? marker.slice(0, spaceIdx) : marker;
    const ext = spaceIdx !== -1 ? marker.slice(spaceIdx + 1) : '';
    const contentFilePath = join(DOWNLOAD_CACHE_DIR, `${contentHash}${ext}`);

    if (existsSync(contentFilePath)) {
      logger.debug(`URL 缓存命中: ${urlHash} -> ${contentHash}${ext}`);
      const cachedExt = ext;
      const cachedContentType = Object.entries(MIME_TO_EXT).find(([, e]) => e === cachedExt)?.[0] ?? 'application/octet-stream';
      return { url: `/api/upload/${contentHash}`, hash: contentHash, created: Date.now(), ext: cachedExt, contentType: cachedContentType };
    }
    // marker 存在但内容文件丢失，继续走下载流程（重新写入）
    logger.warn(`URL marker 存在但内容文件丢失，重新下载: ${contentHash}${ext}`);
  }

  // ── 第三步：下载（含重试）────────────────────────────────────────────
  const maxRetriesVal = Math.min(Math.max(retries, 0), 10);
  const baseDelay = Math.min(Math.max(retryDelay, 0), 10000);
  const reqTimeout = Math.min(Math.max(timeout, 1000), 60000);

  const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

  let res: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetriesVal; attempt++) {
    if (attempt > 0) {
      const waitMs = baseDelay * attempt; // 线性退避: 1x, 2x, 3x ...
      logger.debug(`下载重试 ${attempt}/${maxRetriesVal}，等待 ${waitMs}ms: ${url}`);
      await sleep(waitMs);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), reqTimeout);

    try {
      res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) break;

      // 4xx 客户端错误，不重试
      if (res.status >= 400 && res.status < 500) {
        lastError = new Error(`HTTP ${res.status}`);
        break;
      }

      // 5xx 服务端错误，继续重试
      lastError = new Error(`HTTP ${res.status}`);
      res = null;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      res = null;
    }
  }

  if (!res || !res.ok) {
    const msg = lastError instanceof Error ? lastError.message : '未知错误';
    logger.error(`下载失败 (重试 ${maxRetriesVal} 次): ${url} — ${msg}`);
    throw new DownloadImageError(`下载失败: ${msg}`, 'DOWNLOAD_FAILED', 502);
  }

  // ── 第四步：校验响应 ──────────────────────────────────────────────────
  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
  // if (!SUPPORTED_IMAGE_MIME_TYPES.has(contentType)) {
  //   throw new DownloadImageError(`不支持的资源格式: ${contentType}`, 'UNSUPPORTED_MIME', 415);
  // }

  // 通过 Content-Length 提前拦截超大文件，避免无效下载
  const contentLength = res.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > maxSize) {
    throw new DownloadImageError(`文件过大，超过 ${maxSize} bytes`, 'FILE_TOO_LARGE', 413);
  }

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > maxSize) {
    throw new DownloadImageError(`文件过大，超过 ${maxSize} bytes`, 'FILE_TOO_LARGE', 413);
  }

  // ── 第五步：保存内容文件 + 写 URL marker ─────────────────────────────
  const contentHash = createHash('md5').update(Buffer.from(buffer)).digest('hex');
  const ext = MIME_TO_EXT[contentType] || extname(parsedUrl.pathname) || '';
  const filename = `${contentHash}${ext}`;
  const filePath = join(DOWNLOAD_CACHE_DIR, filename);

  if (!existsSync(filePath)) {
    await Bun.write(filePath, buffer);
    logger.info(`已缓存内容: ${filename} (${buffer.byteLength} bytes) <- ${url}`);
  } else {
    logger.debug(`内容已存在，跳过写入: ${filename}`);
  }

  // 写入 URL marker，格式: "{contentHash} {ext}"
  await Bun.write(urlMarkerPath, `${contentHash} ${ext}`);
  logger.debug(`URL marker 已写入: ${URL_MARKER_PREFIX}${urlHash} -> ${contentHash}${ext}`);

  return {
    url: `/api/upload/${contentHash}`,
    hash: contentHash,
    created: Date.now(),
    ext,
    contentType,
  };
}

/** 下载图片失败时抛出的错误 */
export class DownloadImageError extends Error {
  constructor(
    message: string,
    /** 错误码 */
    public readonly code: string,
    /** 对应的 HTTP 状态码 */
    public readonly status: number,
  ) {
    super(message);
    this.name = 'DownloadImageError';
  }
}
