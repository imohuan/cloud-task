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

      const origin = new URL(request.url).origin;
      return {
        url: `${origin}/api/upload/${hash}`,
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
