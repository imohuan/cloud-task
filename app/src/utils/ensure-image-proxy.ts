/**
 * 图片代理转存工具
 *
 * 确保图片 URL 托管在 imageproxy.zhongzhuan.chat。
 * 若来源 host 已是目标域名则直接返回；否则下载原图后重新上传，
 * 返回代理域名下的新 URL。
 *
 * 上传接口参考：https://imageproxy.zhongzhuan.chat/api/upload
 * - POST multipart/form-data，字段名 "file"
 * - 响应: { url } 或 { data: { url } } 或 { imageUrl } 等
 */

import * as https from 'node:https';
import * as http from 'node:http';
import { randomBytes } from 'node:crypto';
import { Logger } from './logger';

const logger = new Logger('EnsureImageProxy');

const IMAGE_PROXY_HOST = 'imageproxy.zhongzhuan.chat';

export interface EnsureImageProxyOptions {
  /** 下载超时 ms，默认 60000 */
  downloadTimeoutMs?: number;
  /** 上传超时 ms，默认 30000 */
  uploadTimeoutMs?: number;
}

/**
 * 确保单个图片 URL 托管在 imageproxy.zhongzhuan.chat。
 * 若 host 已是目标域名则原样返回；否则下载后重新上传并返回新 URL。
 */
export async function ensureImageProxyUrl(
  imageUrl: string,
  options: EnsureImageProxyOptions = {},
): Promise<string> {
  const { downloadTimeoutMs = 60000, uploadTimeoutMs = 30000 } = options;

  // 将本地相对路径转换为完整 localhost URL
  if (imageUrl.startsWith('/')) {
    const port = process.env.PORT ?? 3000;
    imageUrl = `http://localhost:${port}${imageUrl}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    logger.warn(`无效的图片 URL，原样返回: ${imageUrl}`);
    return imageUrl;
  }

  if (parsed.hostname === IMAGE_PROXY_HOST) {
    return imageUrl;
  }

  logger.debug(`图片来源非代理域名，开始下载并转存: ${imageUrl}`);

  const { buffer, contentType } = await downloadBuffer(imageUrl, downloadTimeoutMs);
  const proxyUrl = await uploadToImageProxy(buffer, contentType, uploadTimeoutMs);

  logger.debug(`图片转存完成: ${imageUrl} -> ${proxyUrl}`);
  return proxyUrl;
}

/**
 * 批量确保图片 URL 列表均托管在 imageproxy.zhongzhuan.chat，并发执行。
 */
export async function ensureImageProxyUrls(
  imageUrls: string[],
  options: EnsureImageProxyOptions = {},
): Promise<string[]> {
  return Promise.all(imageUrls.map((url) => ensureImageProxyUrl(url, options)));
}

const DOWNLOAD_RETRIES = 3;
const DOWNLOAD_RETRY_DELAY_MS = 1000;

/** 下载远程 URL 为 Buffer（使用 node:http/https，线性退避重试 3 次） */
async function downloadBuffer(url: string, timeoutMs: number): Promise<{ buffer: Buffer; contentType: string }> {
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  let lastError: Error = new Error('下载失败');

  for (let attempt = 0; attempt <= DOWNLOAD_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(DOWNLOAD_RETRY_DELAY_MS * attempt); // 线性退避: 1x, 2x, 3x
      logger.debug(`图片下载重试 ${attempt}/${DOWNLOAD_RETRIES}: ${url}`);
    }

    try {
      const result = await attemptDownload(url, timeoutMs);
      return result;
    } catch (error: any) {
      lastError = error;
      // 4xx 客户端错误不重试
      if (error?.statusCode >= 400 && error?.statusCode < 500) {
        break;
      }
      // 5xx / 网络异常继续重试
    }
  }

  throw lastError;
}

/** 单次下载尝试，HTTP 错误时附带 statusCode */
function attemptDownload(url: string, timeoutMs: number): Promise<{ buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqModule = parsedUrl.protocol === 'https:' ? https : http;

    const req = reqModule.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
      },
      (res) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          const err = Object.assign(new Error(`图片下载失败: HTTP ${res.statusCode}`), { statusCode: res.statusCode });
          res.resume();
          reject(err);
          return;
        }
        const contentType = (res.headers['content-type'] || 'image/jpeg').split(';')[0].trim();
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType }));
        res.on('error', reject);
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(Object.assign(new Error('图片下载超时'), { name: 'TimeoutError' }));
    });
    req.on('error', reject);
    req.end();
  });
}

/** 上传 Buffer 到 imageproxy.zhongzhuan.chat，返回完整的代理 URL */
async function uploadToImageProxy(buffer: Buffer, contentType: string, timeoutMs: number): Promise<string> {
  const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const filename = `image.${ext}`;
  const boundary = `----CloudTaskBoundary${randomBytes(8).toString('hex')}`;
  const CRLF = '\r\n';

  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}` +
      `Content-Type: ${contentType}${CRLF}${CRLF}`,
    ),
    buffer,
    Buffer.from(`${CRLF}--${boundary}--${CRLF}`),
  ]);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: IMAGE_PROXY_HOST,
        port: 443,
        path: '/api/upload',
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.byteLength,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`图片上传失败: HTTP ${res.statusCode}`));
            return;
          }
          try {
            const result = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            const rawUrl: string | undefined =
              result.url ?? result.data?.url ?? result.imageUrl ?? result.data?.imageUrl;
            if (!rawUrl) {
              reject(new Error('上传成功但未返回图片地址'));
              return;
            }
            const finalUrl = rawUrl.startsWith('http')
              ? rawUrl
              : `https://${IMAGE_PROXY_HOST}${rawUrl}`;
            resolve(finalUrl);
          } catch (e) {
            reject(e);
          }
        });
        res.on('error', reject);
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(Object.assign(new Error('图片上传超时'), { name: 'TimeoutError' }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
