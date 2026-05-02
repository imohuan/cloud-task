/**
 * 工作区文件服务路由
 *
 * GET /workspace        列出 WORKSPACE_DIR 根目录
 * GET /workspace/*path  path 是文件则返回内容，是目录则返回 JSON 列表
 */

import { Elysia } from 'elysia';
import { existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join, resolve, extname, sep } from 'node:path';
import { Logger } from '../../../utils/logger';
import { getConfig } from '../../../config';

const logger = new Logger('WorkspaceRoute');

const MIME_MAP: Record<string, string> = {
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jsonc': 'application/json; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.tsx': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
  '.toml': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
};

function getMimeType(ext: string): string {
  return MIME_MAP[ext.toLowerCase()] ?? 'application/octet-stream';
}

async function handleWorkspacePath(relativePath: string): Promise<Response> {
  const workspaceDir = getConfig().workspaceDir;
  if (!workspaceDir) {
    return new Response(
      JSON.stringify({ error: 'WORKSPACE_DIR 未配置', code: 500 }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const rootResolved = resolve(workspaceDir);
  const targetPath = resolve(workspaceDir, relativePath);

  // 防止路径穿越攻击
  if (!targetPath.startsWith(rootResolved + sep) && targetPath !== rootResolved) {
    logger.warn(`路径穿越尝试: ${relativePath}`);
    return new Response(
      JSON.stringify({ error: '非法路径', code: 403 }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!existsSync(targetPath)) {
    return new Response(
      JSON.stringify({ error: '路径不存在', code: 404 }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const info = await stat(targetPath);

  if (info.isDirectory()) {
    const entries = await readdir(targetPath, { withFileTypes: true });
    const items = entries.map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'directory' : 'file',
      path: join(relativePath, e.name).replace(/\\/g, '/'),
      size: undefined as number | undefined,
    }));

    // 附加文件大小（目录不含）
    await Promise.all(
      items.map(async (item) => {
        if (item.type === 'file') {
          const s = await stat(join(targetPath, item.name));
          item.size = s.size;
        }
      }),
    );

    return new Response(
      JSON.stringify({ path: relativePath || '/', items }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // 文件：直接返回内容
  const ext = extname(targetPath);
  return new Response(Bun.file(targetPath), {
    headers: { 'Content-Type': getMimeType(ext) },
  });
}

export const workspaceRoutes = new Elysia({ prefix: '/workspace' })
  .get('/', () => handleWorkspacePath(''))
  .get('/*', ({ params }) => handleWorkspacePath((params as Record<string, string>)['*'] ?? ''));
