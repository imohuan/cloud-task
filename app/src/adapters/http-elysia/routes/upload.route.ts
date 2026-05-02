/**
 * 文件上传路由
 *
 * POST /api/upload       上传文件，以 MD5 hash 作为文件名去重
 * GET  /api/upload/:hash 获取已上传的文件
 */

import { Elysia, t } from 'elysia';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { Logger } from '../../../utils/logger';
import {
  downloadAndCacheImage,
  DownloadImageError,
  DOWNLOAD_CACHE_DIR,
  SUPPORTED_IMAGE_MIME_TYPES,
} from '../../../utils/download-image';

const logger = new Logger('UploadRoute');

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB（上传接口限制）

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

      if (!SUPPORTED_IMAGE_MIME_TYPES.has(file.type)) {
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
      const filePath = join(DOWNLOAD_CACHE_DIR, filename);

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
  // 测试: GET /api/upload/proxy?url=...&retries=5&retryDelay=500&timeout=15000&maxRetries=5&maxRetryDelay=2000&minTimeout=2000&maxTimeout=20000
  .get(
    '/proxy',
    async ({ query }) => {
      const {
        url,
        type = 'redirect',
        retries,
        retryDelay,
        timeout,
        maxRetries,
        maxRetryDelay,
        minTimeout,
        maxTimeout,
        force,
      } = query as {
        url?: string;
        type?: 'json' | 'resource' | 'redirect';
        retries?: number; retryDelay?: number; timeout?: number;
        maxRetries?: number; maxRetryDelay?: number; minTimeout?: number; maxTimeout?: number;
        force?: boolean;
      };

      if (!url) {
        return new Response(
          JSON.stringify({ error: '未提供 url 参数', code: 400 }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // 计算各参数的有效边界（query 可收紧，但不能突破绝对限制）
      const effectiveMaxRetries = maxRetries !== undefined ? Math.min(Number(maxRetries), 10) : 10;
      const effectiveMaxRetryDelay = maxRetryDelay !== undefined ? Math.min(Number(maxRetryDelay), 10000) : 10000;
      const effectiveMinTimeout = minTimeout !== undefined ? Math.max(Number(minTimeout), 1000) : 1000;
      const effectiveMaxTimeout = maxTimeout !== undefined ? Math.min(Number(maxTimeout), 60000) : 60000;

      const clampedRetries = retries !== undefined ? Math.min(Math.max(Number(retries), 0), effectiveMaxRetries) : undefined;
      const clampedDelay = retryDelay !== undefined ? Math.min(Math.max(Number(retryDelay), 0), effectiveMaxRetryDelay) : undefined;
      const clampedTimeout = timeout !== undefined ? Math.min(Math.max(Number(timeout), effectiveMinTimeout), effectiveMaxTimeout) : undefined;

      try {
        const result = await downloadAndCacheImage(url, {
          retries: clampedRetries,
          retryDelay: clampedDelay,
          timeout: clampedTimeout,
          force: force === true || (force as any) === 'true',
        });

        if (type === 'redirect') {
          return Response.redirect(result.url, 302);
        }

        if (type === 'resource') {
          const filePath = join(DOWNLOAD_CACHE_DIR, `${result.hash}${result.ext}`);
          return new Response(Bun.file(filePath), {
            headers: { 'Content-Type': result.contentType },
          });
        }

        return result;
      } catch (error) {
        if (error instanceof DownloadImageError) {
          return new Response(
            JSON.stringify({ error: error.message, code: error.status }),
            { status: error.status, headers: { 'Content-Type': 'application/json' } },
          );
        }
        logger.error('中转未知错误', error);
        return new Response(
          JSON.stringify({ error: '服务器内部错误', code: 500 }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
      }
    },
    {
      query: t.Object({
        url: t.String({ description: '要中转的图片 URL（http/https）' }),
        type: t.Optional(t.Union([t.Literal('json'), t.Literal('resource'), t.Literal('redirect')], { description: '返回类型: json（默认）/ resource（原始资源）/ redirect（302 跳转）' })),
        force: t.Optional(t.BooleanString({ description: '强制重新下载，忽略 URL 缓存，默认 false' })),
        retries: t.Optional(t.Numeric({ minimum: 0, maximum: 10, description: '重试次数，默认 3' })),
        retryDelay: t.Optional(t.Numeric({ minimum: 0, maximum: 10000, description: '基础重试间隔 ms（线性退避），默认 1000' })),
        timeout: t.Optional(t.Numeric({ minimum: 1000, maximum: 60000, description: '单次请求超时 ms，默认 30000' })),
        maxRetries: t.Optional(t.Numeric({ minimum: 0, maximum: 10, description: '重试次数上限（绝对上限 10）' })),
        maxRetryDelay: t.Optional(t.Numeric({ minimum: 0, maximum: 10000, description: '重试间隔上限 ms（绝对上限 10000）' })),
        minTimeout: t.Optional(t.Numeric({ minimum: 1000, maximum: 60000, description: '超时下限 ms（绝对下限 1000）' })),
        maxTimeout: t.Optional(t.Numeric({ minimum: 1000, maximum: 60000, description: '超时上限 ms（绝对上限 60000）' })),
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
        const files = await readdir(DOWNLOAD_CACHE_DIR);
        const match = files.find(f => f.startsWith(hash));

        if (!match) {
          return new Response(
            JSON.stringify({ error: '文件不存在', code: 404 }),
            { status: 404, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(Bun.file(join(DOWNLOAD_CACHE_DIR, match)));
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
