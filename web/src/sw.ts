/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, PrecacheController, PrecacheRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
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
  cacheWillUpdate: async ({ response }: { response: Response | null | undefined }) => {
    if (!response || response.status !== 200) return null;
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
