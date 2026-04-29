/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, PrecacheController, PrecacheRoute } from 'workbox-precaching';
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

// SPA 导航：所有 navigate 请求一律从 precache 返回 index.html，支持离线访问
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

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
