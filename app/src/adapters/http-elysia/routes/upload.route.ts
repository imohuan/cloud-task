/**
 * 文件上传路由
 *
 * POST /api/upload       上传文件，以 MD5 hash 作为文件名去重
 * GET  /api/upload/:hash 获取已上传的文件
 */

import { Elysia, t } from 'elysia';
import { mkdirSync, existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { getAppRoot } from '@/utils/app-root';
import { Logger } from '../../../utils/logger';

const logger = new Logger('UploadRoute');

const UPLOAD_DIR = join(getAppRoot(), 'data', 'upload');
mkdirSync(UPLOAD_DIR, { recursive: true });

const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  'image/avif',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const PROXY_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

const PROXY_DEFAULT_RETRIES = 3;       // 默认重试次数，可通过 query.retries 覆盖
const PROXY_MAX_RETRIES = 10;          // 绝对上限，可通过 query.maxRetries 覆盖（不超过此值）
const PROXY_DEFAULT_RETRY_DELAY = 1000; // ms，基础重试间隔（线性退避：1x, 2x, 3x…），可通过 query.retryDelay 覆盖
const PROXY_MAX_RETRY_DELAY = 10000;   // ms，重试间隔绝对上限，可通过 query.maxRetryDelay 覆盖（不超过此值）
const PROXY_DEFAULT_TIMEOUT = 30000;   // ms，单次请求超时默认值，可通过 query.timeout 覆盖
const PROXY_MIN_TIMEOUT = 1000;        // ms，超时绝对下限，可通过 query.minTimeout 覆盖（不低于此值）
const PROXY_MAX_TIMEOUT = 60000;       // ms，超时绝对上限，可通过 query.maxTimeout 覆盖（不超过此值）

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

export const uploadRoutes = new Elysia({ prefix: '/api/upload' })

  // 上传文件
  .post(
    '/',
    async ({ body, request }) => {
      const file = (body as any).file as File | undefined;

      if (!file) {
        return new Response(
          JSON.stringify({ error: '未提供文件', code: 400 }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (!SUPPORTED_MIME_TYPES.has(file.type)) {
        return new Response(
          JSON.stringify({ error: '不支持的文件格式', code: 415 }),
          { status: 415, headers: { 'Content-Type': 'application/json' } },
        );
      }

      const buffer = await file.arrayBuffer();

      if (buffer.byteLength > MAX_FILE_SIZE) {
        return new Response(
          JSON.stringify({ error: '文件过大，最大支持 10MB', code: 413 }),
          { status: 413, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // 以 MD5 hash 作为文件名，实现同一文件去重
      const hash = createHash('md5').update(Buffer.from(buffer)).digest('hex');
      const ext = extname(file.name) || '';
      const filename = `${hash}${ext}`;
      const filePath = join(UPLOAD_DIR, filename);

      if (!existsSync(filePath)) {
        await Bun.write(filePath, buffer);
        logger.info(`文件已上传: ${filename} (${buffer.byteLength} bytes)`);
      } else {
        logger.debug(`文件已存在，跳过写入: ${filename}`);
      }

      return {
        url: `/api/upload/${hash}`,
        created: Date.now(),
      };
    },
    {
      body: t.Object({
        file: t.File(),
      }),
      detail: {
        summary: '上传文件',
        description: '上传图片文件，以 MD5 hash 去重，重复文件无需重复上传',
        tags: ['upload'],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: '要上传的图片文件（JPG/PNG/GIF/WebP 等，最大 10MB）',
                  },
                },
                required: ['file'],
              },
            },
          },
        },
      },
    },
  )

  // 图片资源中转：下载远程 URL 并缓存到本地
  // 测试: GET /api/upload/proxy?url=https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png
  // 测试: GET /api/upload/proxy?url=https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png&retries=5&retryDelay=500&timeout=15000&maxRetries=5&maxRetryDelay=2000&minTimeout=2000&maxTimeout=20000
  .get(
    '/proxy',
    async ({ query }) => {
      const {
        url,
        retries = PROXY_DEFAULT_RETRIES,
        retryDelay = PROXY_DEFAULT_RETRY_DELAY,
        timeout = PROXY_DEFAULT_TIMEOUT,
        maxRetries = PROXY_MAX_RETRIES,
        maxRetryDelay = PROXY_MAX_RETRY_DELAY,
        minTimeout = PROXY_MIN_TIMEOUT,
        maxTimeout = PROXY_MAX_TIMEOUT,
      } = query as {
        url?: string;
        retries?: number; retryDelay?: number; timeout?: number;
        maxRetries?: number; maxRetryDelay?: number; minTimeout?: number; maxTimeout?: number;
      };

      if (!url) {
        return new Response(
          JSON.stringify({ error: '未提供 url 参数', code: 400 }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return new Response(
          JSON.stringify({ error: '无效的 URL', code: 400 }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return new Response(
          JSON.stringify({ error: '仅支持 http/https 协议', code: 400 }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // 计算各参数的有效边界（query 可收紧，但不能突破绝对限制）
      const effectiveMaxRetries = Math.min(Number(maxRetries), PROXY_MAX_RETRIES);
      const effectiveMaxRetryDelay = Math.min(Number(maxRetryDelay), PROXY_MAX_RETRY_DELAY);
      const effectiveMinTimeout = Math.max(Number(minTimeout), PROXY_MIN_TIMEOUT);
      const effectiveMaxTimeout = Math.min(Number(maxTimeout), PROXY_MAX_TIMEOUT);

      const maxRetriesVal = Math.min(Math.max(Number(retries) || 0, 0), effectiveMaxRetries);
      const baseDelay = Math.min(Math.max(Number(retryDelay) || PROXY_DEFAULT_RETRY_DELAY, 0), effectiveMaxRetryDelay);
      const reqTimeout = Math.min(Math.max(Number(timeout) || PROXY_DEFAULT_TIMEOUT, effectiveMinTimeout), effectiveMaxTimeout);

      const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

      let res: Response | null = null;
      let lastError: unknown = null;

      for (let attempt = 0; attempt <= maxRetriesVal; attempt++) {
        if (attempt > 0) {
          const waitMs = baseDelay * attempt; // 线性退避: 1x, 2x, 3x ...
          logger.debug(`中转重试 ${attempt}/${maxRetriesVal}，等待 ${waitMs}ms: ${url}`);
          await sleep(waitMs);
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), reqTimeout);

        try {
          res = await fetch(url, { signal: controller.signal });
          clearTimeout(timer);

          if (res.ok) break; // 成功，退出重试

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
        logger.error(`中转下载失败 (重试 ${maxRetriesVal} 次): ${url} — ${msg}`);
        return new Response(
          JSON.stringify({ error: `下载远程资源失败: ${msg}`, code: 502 }),
          { status: 502, headers: { 'Content-Type': 'application/json' } },
        );
      }

      const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
      if (!SUPPORTED_MIME_TYPES.has(contentType)) {
        return new Response(
          JSON.stringify({ error: '不支持的远程资源格式', code: 415 }),
          { status: 415, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // 通过 Content-Length 提前拦截超大文件，避免无效下载
      const contentLength = res.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > PROXY_MAX_FILE_SIZE) {
        return new Response(
          JSON.stringify({ error: '远程文件过大，最大支持 100MB', code: 413 }),
          { status: 413, headers: { 'Content-Type': 'application/json' } },
        );
      }

      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > PROXY_MAX_FILE_SIZE) {
        return new Response(
          JSON.stringify({ error: '远程文件过大，最大支持 100MB', code: 413 }),
          { status: 413, headers: { 'Content-Type': 'application/json' } },
        );
      }

      const hash = createHash('md5').update(Buffer.from(buffer)).digest('hex');
      const urlExt = extname(parsedUrl.pathname);
      const ext = urlExt || MIME_TO_EXT[contentType] || '';
      const filename = `${hash}${ext}`;
      const filePath = join(UPLOAD_DIR, filename);

      if (!existsSync(filePath)) {
        await Bun.write(filePath, buffer);
        logger.info(`中转缓存: ${filename} (${buffer.byteLength} bytes) <- ${url}`);
      } else {
        logger.debug(`中转命中缓存: ${filename}`);
      }

      return {
        url: `/api/upload/${hash}`,
        created: Date.now(),
      };
    },
    {
      query: t.Object({
        url: t.String({ description: '要中转的图片 URL（http/https）' }),
        retries: t.Optional(t.Numeric({ minimum: 0, maximum: PROXY_MAX_RETRIES, description: `重试次数，默认 ${PROXY_DEFAULT_RETRIES}` })),
        retryDelay: t.Optional(t.Numeric({ minimum: 0, maximum: PROXY_MAX_RETRY_DELAY, description: `基础重试间隔 ms（线性退避），默认 ${PROXY_DEFAULT_RETRY_DELAY}` })),
        timeout: t.Optional(t.Numeric({ minimum: PROXY_MIN_TIMEOUT, maximum: PROXY_MAX_TIMEOUT, description: `单次请求超时 ms，默认 ${PROXY_DEFAULT_TIMEOUT}` })),
        maxRetries: t.Optional(t.Numeric({ minimum: 0, maximum: PROXY_MAX_RETRIES, description: `重试次数上限，默认 ${PROXY_MAX_RETRIES}（绝对上限）` })),
        maxRetryDelay: t.Optional(t.Numeric({ minimum: 0, maximum: PROXY_MAX_RETRY_DELAY, description: `重试间隔上限 ms，默认 ${PROXY_MAX_RETRY_DELAY}（绝对上限）` })),
        minTimeout: t.Optional(t.Numeric({ minimum: PROXY_MIN_TIMEOUT, maximum: PROXY_MAX_TIMEOUT, description: `超时下限 ms，默认 ${PROXY_MIN_TIMEOUT}（绝对下限）` })),
        maxTimeout: t.Optional(t.Numeric({ minimum: PROXY_MIN_TIMEOUT, maximum: PROXY_MAX_TIMEOUT, description: `超时上限 ms，默认 ${PROXY_MAX_TIMEOUT}（绝对上限）` })),
      }),
      detail: {
        summary: '图片资源中转',
        description: '下载指定 URL 的图片资源并缓存到本地，返回本地访问路径。支持重试策略与超时控制。',
        tags: ['upload'],
      },
    },
  )

  // 获取已上传的文件
  .get(
    '/:hash',
    async ({ params }) => {
      const { hash } = params;

      if (!/^[a-f0-9]{32}$/i.test(hash)) {
        return new Response(
          JSON.stringify({ error: '无效的文件标识', code: 400 }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      try {
        const files = await readdir(UPLOAD_DIR);
        const match = files.find(f => f.startsWith(hash));

        if (!match) {
          return new Response(
            JSON.stringify({ error: '文件不存在', code: 404 }),
            { status: 404, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(Bun.file(join(UPLOAD_DIR, match)));
      } catch (error) {
        logger.error(`获取文件失败: ${hash}`, error);
        return new Response(
          JSON.stringify({ error: '服务器内部错误', code: 500 }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
      }
    },
    {
      params: t.Object({ hash: t.String() }),
      detail: {
        summary: '获取已上传的文件',
        tags: ['upload'],
      },
    },
  );
