/**
 * Elysia HTTP 适配器
 * 
 * 【优化】
 * 1. 添加配置注入支持
 * 2. 完善健康检查端点，包含数据库连接状态
 * 3. 添加请求日志记录
 * 4. 添加错误处理中间件
 */

import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { staticPlugin } from '@elysiajs/static';
import { registryRoutes } from '@adapters/http-elysia/routes/registry.route';
import { invokeRoutes } from '@adapters/http-elysia/routes/invoke.route';
import { taskRoutes } from '@adapters/http-elysia/routes/task.route';
import { authProfileRoutes } from '@adapters/http-elysia/routes/auth-profile.route';
import { mcpRoutes } from '@adapters/http-elysia/routes/mcp.route';
import { logsRoutes } from '@adapters/http-elysia/routes/logs.route';
import { aiRoutes } from '@adapters/http-elysia/routes/ai.route';
import { openaiMockRoutes } from '@adapters/http-elysia/routes/openai-mock.route';
import { uploadRoutes } from '@adapters/http-elysia/routes/upload.route';
import { workspaceRoutes } from '@adapters/http-elysia/routes/workspace.route';
import type { AppConfig } from '../../config';
import { Logger } from '../../utils/logger';
import { getDbStatus } from '@adapters/persistence';
import { registry } from '@core/application/registry/registry-center';
import { circuitBreakerRegistry } from '../../utils/circuit-breaker';
import { isCompiledApp } from '@/utils/app-root';
import { STATIC_ASSETS } from '../../generated/static-assets';
import { join } from 'path';
import { randomBytes } from 'crypto';

function serveStatic(path: string) {
  const asset = STATIC_ASSETS[path];
  if (!asset) {
    return new Response('Not Found', { status: 404 });
  }
  return new Response(asset.content, {
    headers: {
      'Content-Type': asset.contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

interface AuthSession {
  token: string;
  expiresAt: number;
}

function maskIp(ip?: string | null) {
  if (!ip) return 'unknown';
  return ip.length > 6 ? `${ip.slice(0, 3)}***${ip.slice(-2)}` : '***';
}

/**
 * 创建 Elysia 应用
 */
export function createElysiaApp(config?: AppConfig) {
  const logger = new Logger('HTTP');
  const loginPassword = process.env.APP_LOGIN_PASSWORD || '';
  const parsedTtlMs = Number(process.env.APP_LOGIN_TTL_MS || 1000 * 60 * 60 * 24 * 7);
  const sessionTtlMs = Number.isFinite(parsedTtlMs) && parsedTtlMs > 0 ? parsedTtlMs : 1000 * 60 * 60 * 24 * 7;
  const sessions = new Map<string, AuthSession>();

  const app = new Elysia()
    // 请求日志中间件
    .onRequest(({ request }) => {
      try {
        const url = new URL(request.url);
        logger.debug(`${request.method} ${url.pathname}${url.search}`);
      } catch { }
    })

    // 错误处理中间件
    .onError(({ code, error, path }) => {
      logger.error(`请求错误 [${code}]: ${path}`, error);
      return {
        success: false,
        error: {
          code: code || 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '未知错误',
        },
      };
    });

  // 静态文件服务：开发环境使用本地 public 目录，打包后使用嵌入资源
  if (!isCompiledApp()) {
    const publicDir = join(process.cwd(), 'public');
    const indexHtmlFile = join(publicDir, 'index.html');

    // SW 和 Manifest 必须禁止长期 HTTP 缓存，且必须在 staticPlugin / * 兜底之前注册，
    // 避免被 * 路由错误地返回 index.html（会导致 SW 注册失败）
    app.get('/sw.js', () =>
      new Response(Bun.file(join(publicDir, 'sw.js')), {
        headers: {
          'Content-Type': 'application/javascript',
          'Cache-Control': 'public, no-cache',
        },
      }),
    );
    app.get('/manifest.webmanifest', () =>
      new Response(Bun.file(join(publicDir, 'manifest.webmanifest')), {
        headers: {
          'Content-Type': 'application/manifest+json',
          'Cache-Control': 'public, no-cache',
        },
      }),
    );

    app.use(staticPlugin({
      assets: './public',
      prefix: '/',
      indexHTML: true,
      alwaysStatic: true
    }));
    app.get('/', () => Bun.file(indexHtmlFile));
    app.get('/index.html', () => Bun.file(indexHtmlFile));
  } else {
    app.get('/', () => serveStatic('/index.html'));
    app.get('/index.html', () => serveStatic('/index.html'));
    app.get('/logs.html', () => serveStatic('/logs.html'));
  }

  app
    // CORS 支持
    .use(cors())

    // Swagger 文档
    .use(swagger({
      documentation: {
        info: {
          title: 'Cloud Task API',
          version: '1.0.0',
          description: '第三方 API 接入中台',
        },
        tags: [
          { name: 'registry', description: '平台与接口注册查询' },
          { name: 'invoke', description: 'API 调用' },
          { name: 'tasks', description: '异步任务管理' },
          { name: 'auth-profiles', description: '认证配置管理' },
          { name: 'mcp', description: 'MCP 工具导出' },
          { name: 'logs', description: '日志管理' },
          { name: 'upload', description: '文件上传' },
          { name: 'openai-mock', description: 'OpenAI v1 兼容 Mock 接口' },
        ],
      },
      path: '/docs',
    }))


    // 健康检查 - 包含详细状态
    .get('/health', async () => {
      const dbStatus = getDbStatus();
      const platforms = registry.getPlatforms();

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
          database: dbStatus ? {
            status: 'connected',
            connections: dbStatus,
          } : {
            status: 'disconnected',
          },
          registry: {
            platforms: platforms.length,
            platformList: platforms.map(p => p.id),
          },
        },
        config: config ? {
          worker: config.worker.enabled,
          env: config.env,
        } : undefined,
      };
    })

    // 熔断器状态端点（用于监控）
    .get('/health/circuit-breakers', () => {
      return {
        status: 'ok',
        data: circuitBreakerRegistry.getAllMetrics(),
      };
    })

    // 登录验证接口
    .post('/api/auth/login', ({ body, request }) => {
      if (!loginPassword) {
        return {
          success: false,
          error: {
            code: 'AUTH_NOT_CONFIGURED',
            message: '服务端未配置登录密码',
          },
        };
      }

      if (body.password !== loginPassword) {
        logger.warn(`登录失败，来源 IP: ${maskIp(request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'))}`);
        return {
          success: false,
          error: {
            code: 'AUTH_INVALID_PASSWORD',
            message: '密码错误',
          },
        };
      }

      const token = randomBytes(32).toString('hex');
      const expiresAt = Date.now() + sessionTtlMs;
      sessions.set(token, { token, expiresAt });

      return {
        success: true,
        data: {
          token,
          expiresAt,
          ttlMs: sessionTtlMs,
        },
      };
    }, {
      body: t.Object({
        password: t.String({ minLength: 1 }),
      }),
    })

    // 鉴权状态检查
    .get('/api/auth/session', ({ request }) => {
      const authHeader = request.headers.get('authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      const session = token ? sessions.get(token) : undefined;
      const now = Date.now();

      if (!session || session.expiresAt <= now) {
        if (token) sessions.delete(token);
        return {
          success: false,
          error: {
            code: 'AUTH_SESSION_EXPIRED',
            message: '登录已过期，请重新登录',
          },
        };
      }

      return {
        success: true,
        data: {
          expiresAt: session.expiresAt,
          ttlMs: session.expiresAt - now,
        },
      };
    })

    // /api 路由鉴权（登录、健康检查、文档等白名单除外）
    .onBeforeHandle(({ request, path }) => {
      const now = Date.now();
      for (const [token, session] of sessions) {
        if (session.expiresAt <= now) sessions.delete(token);
      }

      const isApi = path.startsWith('/api/');
      if (!isApi) return;

      const isPublicUploadProxy = request.method === 'GET' && path === '/api/upload/proxy';
      const isPublicUploadedFile = request.method === 'GET' && /^\/api\/upload\/[a-f0-9]{32}$/i.test(path);
      const isPublicLogSse = request.method === 'GET' && /^\/api\/logs\/[^/]+\.log\/sse$/i.test(path);

      const whiteList = [
        '/api/auth/login',
        '/api/auth/session',
        '/api/health',
        '/api/chat',
      ];
      if (
        whiteList.some(p => path === p || path.startsWith(`${p}/`))
        || isPublicUploadProxy
        || isPublicUploadedFile
        || isPublicLogSse
      ) return;

      const authHeader = request.headers.get('authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      const session = token ? sessions.get(token) : undefined;

      if (!session || session.expiresAt <= Date.now()) {
        if (token) sessions.delete(token);
        return {
          success: false,
          error: {
            code: 'AUTH_UNAUTHORIZED',
            message: '未登录或登录已过期',
          },
        };
      }
    })

    // 注册路由
    .use(registryRoutes)
    .use(invokeRoutes)
    .use(taskRoutes)
    .use(authProfileRoutes)
    .use(mcpRoutes)
    .use(logsRoutes)
    .use(aiRoutes)
    .use(openaiMockRoutes)
    .use(uploadRoutes)
    .use(workspaceRoutes);

  // SPA 兜底：未匹配到的 GET 请求回退到 index.html，支持前端 Vue Router history 模式
  if (!isCompiledApp()) {
    const publicDir = join(process.cwd(), 'public');
    app.get('*', ({ path }) =>
      path.startsWith('/assets/')
        ? new Response('Not Found', { status: 404 })
        : Bun.file(join(publicDir, 'index.html')),
    );
  } else {
    app.get('*', ({ path }) => {
      if (STATIC_ASSETS[path]) return serveStatic(path);
      if (path.startsWith('/assets/')) return new Response('Not Found', { status: 404 });
      return serveStatic('/index.html');
    });
  }

  // 心跳日志：每10秒写入一条包含 [TASK_REFRESH] 的日志
  // 作用：① 保持日志文件持续写入，防止 chokidar 长期无变化后失活
  //       ② SSE 端点 search=[TASK_REFRESH] 过滤器会放行此日志，前端可据此检测连接存活
  const heartbeatLogger = new Logger('Heartbeat');
  const heartbeatInterval = setInterval(() => {
    heartbeatLogger.info('[TASK_REFRESH] [HEARTBEAT] server-alive');
  }, 10_000);
  process.once('beforeExit', () => clearInterval(heartbeatInterval));

  return app;
}
