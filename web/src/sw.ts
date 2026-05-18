/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, PrecacheController, PrecacheRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

/**
 * Plugin that handles responses whose `Vary` header contains `*`.
 *
 * The browser's Cache API hard-rejects `cache.put()` with "Vary header
 * contains *".  Workbox v7 precaching also throws `bad-precaching-response`
 * when a precache entry is not written (i.e. returning null is NOT safe for
 * precaching).  The fix: strip the `Vary: *` header from the response clone
 * so the Cache API accepts it, instead of skipping the write.
 *
 * For runtime caching (NetworkFirst), responses with bad status are still
 * rejected via `return null`.
 */
const stripVaryStarPlugin = {
  cacheWillUpdate: async ({ request, response }: { request: Request; response: Response | null | undefined }) => {
    if (!response || response.status !== 200) return null;
    // Guard: reject HTML responses for non-HTML resource URLs.
    // Prevents the SPA index.html fallback (status 200, Content-Type: text/html)
    // from being stored under JS/CSS/image cache keys.
    const contentType = (response.headers.get('Content-Type') ?? '').toLowerCase();
    if (contentType.includes('text/html')) {
      const pathname = new URL(request.url).pathname;
      if (!pathname.endsWith('.html') && pathname !== '/') return null;
    }

    // 二进制响应（尤其图片）保持原样，避免重建 Response 导致内容损坏。
    const isBinaryResponse = contentType.startsWith('image/')
      || contentType.startsWith('video/')
      || contentType.startsWith('audio/')
      || contentType.includes('application/octet-stream')
      || contentType.includes('application/pdf');

    if (isBinaryResponse) {
      return response;
    }

    if (response.headers.get('Vary')?.includes('*')) {
      const headers = new Headers(response.headers);
      headers.delete('Vary');
      return new Response(await response.arrayBuffer(), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    return response;
  },
};

// Use PrecacheController directly so the plugin is applied during the SW
// install phase (precaching static assets), not only at runtime.
const precacheController = new PrecacheController({
  plugins: [stripVaryStarPlugin],
});
precacheController.addToCacheList(self.__WB_MANIFEST);

self.addEventListener('install', event => {
  (event as ExtendableEvent).waitUntil(
    precacheController.install(event as ExtendableEvent),
  );
});

self.addEventListener('activate', event => {
  (event as ExtendableEvent).waitUntil(
    precacheController.activate(event as ExtendableEvent),
  );
});

registerRoute(new PrecacheRoute(precacheController));

// SPA 路由全部在 pathname=/ 下（?view=xxx），只拦截根路径导航
// /docs /health /tasks 等 API 路径不在 allowlist 内，直接走网络
registerRoute(
  new NavigationRoute(
    async () => {
      const cached = await precacheController.matchPrecache('/index.html');
      if (cached) return cached;
      try {
        return await fetch('/index.html');
      } catch {
        return new Response(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>离线</title></head>' +
          '<body style="font-family:sans-serif;text-align:center;margin-top:80px">' +
          '<h2>当前处于离线状态</h2><p>请检查网络连接后刷新页面</p></body></html>',
          { status: 503, headers: { 'Content-Type': 'text/html;charset=utf-8' } },
        );
      }
    },
    { allowlist: [/^\/$/] },  // 仅匹配 pathname 为 / 的导航请求
  ),
);

// 图片资源缓存：/api/upload/:hash（内容寻址，永不过期） 和 /api/upload/proxy（type=resource）
// CacheFirst：优先使用缓存，网络不可用时不影响已缓存图片的展示
registerRoute(
  ({ url, request }) => {
    if (url.origin !== self.location.origin || request.mode === 'navigate') return false;

    const isHashFile = /^\/api\/upload\/[a-f0-9]{32}(\.[a-z0-9]+)?$/.test(url.pathname);
    const isProxyImageResource = url.pathname === '/api/upload/proxy' && url.searchParams.get('type') === 'resource';

    return isHashFile || isProxyImageResource;
  },
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      stripVaryStarPlugin,
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 5, // 30 天
      }),
      {
        handlerDidError: async () =>
          new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }),
      },
    ],
  }),
);

// 同源 API 请求缓存（排除静态资源和导航请求，避免 no-response）
registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    request.mode !== 'navigate' &&
    !url.pathname.startsWith('/assets/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      stripVaryStarPlugin,
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 7,
      }),
      {
        // 网络 + 缓存均不可用时返回 503，避免整个 FetchEvent 变成 network error
        handlerDidError: async () =>
          new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }),
      },
    ],
  }),
);
